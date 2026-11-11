import { DEFAULTS, DOC_TEXT, SAMPLE_QUESTIONS } from './corpus'
import { chunkSpans, cleanText } from './chunk'
import { embedRaw, unit, MODEL_NAME } from './embed'
import { sha256 } from './hash'
import { cosine, rank, type Metric } from './similarity'

// Una fila de la "base de datos": lo que de verdad se guarda por cada fragmento.
export interface Chunk {
  index: number
  id: string // clave primaria
  start: number // dónde empieza en el documento (para mostrar el solapamiento)
  end: number
  text: string // texto plano del fragmento
  hash: string // SHA-256 del texto: huella para detectar cambios
  model: string // qué modelo generó el vector
  raw: number[] // vector sin normalizar (como sale de contar conceptos)
  vec: number[] // vector normalizado (longitud 1)
  createdAt: string
}

// Resultado de buscar la pregunta contra un fragmento.
export interface Hit {
  chunk: Chunk
  rank: number // 1 = el más cercano según la métrica elegida
  value: number // valor de la métrica elegida
  cos: number // coseno: siempre se muestra porque es el que usamos para el umbral
  inTop: boolean // está entre los k primeros
  selected: boolean // está en top-k y supera el umbral: viaja al prompt
}

export type Topic = 'chunks' | 'hashes' | 'query' | 'options'

export const state = {
  size: DEFAULTS.size,
  overlap: DEFAULTS.overlap,
  k: DEFAULTS.k,
  threshold: DEFAULTS.threshold,
  metric: 'coseno' as Metric,
  normalized: true,
  query: SAMPLE_QUESTIONS[0],
  chunks: [] as Chunk[],
  overrides: {} as Record<number, string>, // textos editados a mano, por índice de fragmento
}

const subs: { topics: Topic[]; fn: (t: Topic) => void }[] = []
export function on(topics: Topic[], fn: (t: Topic) => void) {
  subs.push({ topics, fn })
}
const emit = (t: Topic) => subs.forEach((s) => s.topics.includes(t) && s.fn(t))

// Texto limpio del documento: las posiciones de los fragmentos apuntan a este texto.
export const CLEAN_DOC = cleanText(DOC_TEXT)

let generation = 0

// Ingesta completa: partir el documento, generar vectores y calcular huellas.
export function rebuildChunks() {
  const spans = chunkSpans(DOC_TEXT, state.size, state.overlap)
  const stamp = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  state.chunks = spans.map((s, i) => {
    const text = state.overrides[i] ?? s.text
    const raw = embedRaw(text)
    return {
      index: i,
      id: `c_${String(i + 1).padStart(2, '0')}`,
      start: s.start,
      end: s.end,
      text,
      hash: '…',
      model: MODEL_NAME,
      raw,
      vec: unit(raw),
      createdAt: stamp,
    }
  })
  emit('chunks')
  void computeHashes()
}

// La huella SHA-256 es asíncrona: se calcula en segundo plano y avisa cuando termina.
async function computeHashes() {
  const my = ++generation
  for (const c of state.chunks) {
    const h = await sha256(c.text)
    if (my !== generation) return
    c.hash = h
  }
  emit('hashes')
}

export function setChunking(size: number, overlap: number) {
  state.size = size
  state.overlap = overlap
  state.overrides = {} // al cambiar el corte, los textos editados ya no corresponden
  rebuildChunks()
}

// Editar un fragmento: cambia su texto, su huella y su vector (como cuando re-embebes una fila).
export function setChunkText(index: number, text: string) {
  state.overrides[index] = text
  rebuildChunks()
}

export function clearChunkText(index: number) {
  delete state.overrides[index]
  rebuildChunks()
}

export function setOptions(patch: Partial<Pick<typeof state, 'k' | 'threshold' | 'metric' | 'normalized'>>) {
  Object.assign(state, patch)
  emit('options')
}

export function setQuery(query: string) {
  state.query = query
  emit('query')
}

// Embedding de la pregunta: el MISMO modelo que los fragmentos.
export function queryEmbedding() {
  const raw = embedRaw(state.query)
  return { raw, vec: unit(raw) }
}

// Búsqueda: compara la pregunta con todos los fragmentos según la métrica elegida.
export function retrieve(): Hit[] {
  const q = queryEmbedding()
  const qUse = state.normalized ? q.vec : q.raw
  const docs = state.chunks.map((c) => (state.normalized ? c.vec : c.raw))
  return rank(qUse, docs, state.metric).map((r, pos) => {
    const chunk = state.chunks[r.index]
    const cos = cosine(q.vec, chunk.vec)
    const inTop = pos < state.k
    return { chunk, rank: pos + 1, value: r.value, cos, inTop, selected: inTop && cos >= state.threshold }
  })
}

export function initState() {
  rebuildChunks()
}
