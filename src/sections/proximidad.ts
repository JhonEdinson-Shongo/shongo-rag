import { METRICS, type Metric } from '../lib/similarity'
import { on, queryEmbedding, retrieve, setOptions, state, type Hit } from '../lib/state'
import { chunkColor } from '../lib/theme'
import type { VectorSpace } from '../three/space'
import { $, $$, esc, f2 } from '../ui/dom'

// El espacio 3D se crea cuando hace falta (ver initProximidad); null mientras no se haya descargado.
let space: VectorSpace | null = null

// Sección 05: calcular qué tan cerca está cada fragmento de la pregunta, elegir el top-k y aplicar umbral.
export function initProximidad() {
  const container = $('#space')

  // El 3D (Three.js) es pesado y decorativo: se descarga cuando la sección está por entrar en pantalla.
  const loadSpace = async () => {
    const { VectorSpace: Space } = await import('../three/space')
    space = new Space(container)
    space.setChunks(state.chunks.map((c) => c.vec))
    refresh()
  }
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      void loadSpace()
    },
    { rootMargin: '400px 0px' },
  )
  io.observe(container)

  // Métricas.
  $$<HTMLButtonElement>('[data-metric]').forEach((b) =>
    b.addEventListener('click', () => setOptions({ metric: b.dataset.metric as Metric })),
  )

  // Normalización.
  $('#norm-toggle').addEventListener('click', () => setOptions({ normalized: !state.normalized }))

  // Top-k y umbral.
  const k = $<HTMLInputElement>('#k-range')
  const th = $<HTMLInputElement>('#th-range')
  k.addEventListener('input', () => {
    $('#k-out').textContent = `${k.value} fragmento${k.value === '1' ? '' : 's'}`
    setOptions({ k: Number(k.value) })
  })
  th.addEventListener('input', () => {
    $('#th-out').textContent = f2(Number(th.value))
    setOptions({ threshold: Number(th.value) })
  })

  on(['chunks'], () => {
    space?.setChunks(state.chunks.map((c) => c.vec))
    refresh()
  })
  on(['query', 'options'], () => refresh())
  refresh()
  syncControls()
}

function syncControls() {
  $('#k-out').textContent = `${state.k} fragmento${state.k === 1 ? '' : 's'}`
  $<HTMLInputElement>('#k-range').value = String(state.k)
  $('#th-out').textContent = f2(state.threshold)
  $<HTMLInputElement>('#th-range').value = String(state.threshold)
}

function refresh() {
  syncControls()
  const hits = retrieve()
  const q = queryEmbedding()

  // 3D (si ya cargó): la pregunta y los resultados.
  space?.setQuery(q.vec)
  space?.setHits(hits.map((h) => ({ index: h.chunk.index, cos: h.cos, inTop: h.inTop, selected: h.selected })))

  // Métricas activas.
  $$<HTMLButtonElement>('[data-metric]').forEach((b) => {
    const on = b.dataset.metric === state.metric
    b.classList.toggle('is-active', on)
    b.setAttribute('aria-pressed', String(on))
  })
  const norm = $('#norm-toggle')
  norm.setAttribute('aria-checked', String(state.normalized))
  norm.classList.toggle('is-on', state.normalized)

  const m = METRICS[state.metric]
  $('#formula').textContent = m.formula
  $('#metric-desc').textContent = m.desc
  $('#metric-note').textContent = note()
  $('#metric-note').dataset.kind = state.normalized || state.metric === 'coseno' ? 'ok' : 'warn'
  renderRank(hits)
  $('#selected-count').textContent = String(hits.filter((h) => h.selected).length)
}

// Explica en lenguaje simple lo que se está viendo con la combinación actual.
function note(): string {
  if (state.metric === 'coseno') return 'El coseno ignora el tamaño del texto y mira solo la dirección. Es la métrica más usada en RAG.'
  if (state.normalized)
    return 'Con vectores normalizados, el producto punto y la euclidiana dan el mismo orden que el coseno. Cambia el número, no el ranking.'
  return 'Sin normalizar, el orden puede cambiar: los fragmentos más largos (más conceptos) tienen números más grandes y se cuelan arriba.'
}

const SHORT_NAME = { coseno: 'coseno', punto: 'punto', euclidiana: 'distancia' } as const

function renderRank(hits: Hit[]) {
  const higher = METRICS[state.metric].higherIsBetter
  const values = hits.map((h) => h.value)
  const maxRaw = Math.max(1e-9, ...values)
  const minRaw = Math.min(...values)
  const name = SHORT_NAME[state.metric]

  $('#rank-list').innerHTML = hits
    .map((h) => {
      const status = h.selected ? 'selected' : h.inTop ? 'below' : 'outside'
      const label = h.selected ? 'Pasa al prompt' : h.inTop ? 'Bajo el umbral' : 'Fuera del top-k'
      // Barra: con coseno o punto, crece con el valor; con distancia, crece cuando la distancia es menor.
      const raw = higher ? Math.max(0, h.value) / maxRaw : (maxRaw - h.value) / Math.max(1e-9, maxRaw - minRaw)
      const width = Math.round(Math.min(1, Math.max(0.02, raw)) * 100)
      const metricLine =
        state.metric === 'coseno' ? '' : `<div><span class="text-ink-faint">${name}</span> ${f2(h.value)}</div>`
      return `
        <li class="rank-row is-${status}" style="--c:${chunkColor(h.chunk.index)}">
          <span class="rank-pos">${h.rank}</span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <b class="font-mono text-xs" style="color:var(--c)">${h.chunk.id}</b>
              <span class="rank-tag">${label}</span>
            </div>
            <p class="truncate text-xs text-ink-faint">${esc(h.chunk.text)}</p>
            <div class="rank-track"><div class="rank-fill" style="width:${width}%"></div></div>
          </div>
          <div class="rank-values font-mono text-[0.6875rem] text-right">
            ${metricLine}
            <div><span class="text-ink-faint">coseno</span> ${f2(h.cos)}</div>
          </div>
        </li>`
    })
    .join('')
}
