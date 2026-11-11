import { gsap } from 'gsap'
import { clearChunkText, on, setChunkText, state, type Chunk } from '../lib/state'
import { DOC_TITLE } from '../lib/corpus'
import { sha256 } from '../lib/hash'
import { chunkColor } from '../lib/theme'
import { $, $$, esc, vecText } from '../ui/dom'

// Sección 03: cómo se guarda cada fragmento. Cada fila tiene id, huella, modelo, texto y vector.
let selected = 0
let checkTimer = 0
let checkRun = 0

export function initDatabase() {
  const edit = $<HTMLTextAreaElement>('#db-edit')
  edit.addEventListener('input', () => {
    clearTimeout(checkTimer)
    checkTimer = window.setTimeout(() => void checkHash(edit.value), 120)
  })
  $('#db-save').addEventListener('click', () => {
    const text = edit.value.trim()
    if (text) setChunkText(selected, text)
  })
  $('#db-reset').addEventListener('click', () => {
    clearChunkText(selected)
  })

  on(['chunks', 'hashes'], () => render(false))
  render(true)
}

function render(resetEdit: boolean) {
  const chunks = state.chunks
  if (selected >= chunks.length) selected = 0
  const current = chunks[selected]
  if (!current) return

  // Selector de fila.
  $('#db-select').innerHTML = chunks
    .map(
      (c) =>
        `<button type="button" data-i="${c.index}" class="sel-chip ${c.index === selected ? 'is-active' : ''}" style="--c:${chunkColor(c.index)}">${c.id}</button>`,
    )
    .join('')
  $$<HTMLButtonElement>('#db-select [data-i]').forEach((b) =>
    b.addEventListener('click', () => {
      selected = Number(b.dataset.i)
      render(true)
    }),
  )

  renderAnatomy(current)
  renderTable(chunks)

  const edit = $<HTMLTextAreaElement>('#db-edit')
  if (resetEdit || document.activeElement !== edit) edit.value = current.text
  $('#db-hash-old').textContent = current.hash
  void checkHash(edit.value)
  $('#db-reset').hidden = state.overrides[selected] === undefined
}

function renderAnatomy(c: Chunk) {
  const rows: [string, string, string][] = [
    ['id', c.id, 'Clave primaria: identifica la fila sin ambigüedad.'],
    ['documento', DOC_TITLE, 'De qué archivo viene. Sirve para citar la fuente.'],
    ['hash_sha256', short(c.hash, 26), 'Huella del texto. Si el texto cambia, la huella cambia.'],
    ['modelo', c.model, 'Qué modelo generó el vector. Preguntas y fragmentos deben usar el mismo.'],
    ['texto', c.text.length > 150 ? c.text.slice(0, 150) + '…' : c.text, 'El texto plano: es lo que el LLM leerá después.'],
    ['embedding', vecText(c.vec), 'El vector. En pgvector sería VECTOR(8); con modelos reales, 1 024–3 072 números.'],
    ['creado_en', c.createdAt, 'Cuándo se calculó. Sirve para saber qué recalcular.'],
  ]
  $('#db-anatomy').innerHTML = rows
    .map(
      ([k, v, why]) => `
      <div class="field">
        <dt class="font-mono text-[0.75rem] text-db">${k}</dt>
        <dd>
          <code class="field-value">${esc(v)}</code>
          <p class="field-why">${esc(why)}</p>
        </dd>
      </div>`,
    )
    .join('')
  gsap.from('#db-anatomy .field', { opacity: 0, x: -10, duration: 0.4, stagger: 0.05, ease: 'power2.out', overwrite: 'auto' })
}

function renderTable(chunks: Chunk[]) {
  $('#db-table').innerHTML = chunks
    .map(
      (c) => `
      <tr class="${c.index === selected ? 'is-selected' : ''}" data-row="${c.index}">
        <td class="font-mono" style="color:${chunkColor(c.index)}">${c.id}</td>
        <td class="font-mono text-ink-dim">${esc(short(c.hash, 12))}</td>
        <td class="font-mono text-ink-dim">${esc(c.model)}</td>
        <td class="text-ink-dim">${esc(c.text.slice(0, 54))}…</td>
        <td class="font-mono text-ink-dim">${esc(vecText(c.vec, 3))}</td>
        <td class="font-mono text-ink-faint">${esc(c.createdAt)}</td>
      </tr>`,
    )
    .join('')
  $$<HTMLTableRowElement>('#db-table [data-row]').forEach((tr) =>
    tr.addEventListener('click', () => {
      selected = Number(tr.dataset.row)
      render(true)
    }),
  )
}

// Experimento del hash: se calcula la huella del texto editado y se compara con la guardada.
async function checkHash(text: string) {
  const run = ++checkRun
  const current = state.chunks[selected]
  const newEl = $('#db-hash-new')
  const verdict = $('#db-verdict')
  if (!current) return
  if (text.trim() === '') {
    newEl.textContent = '—'
    verdict.textContent = 'Escribe algo para calcular la huella.'
    verdict.dataset.state = 'idle'
    return
  }
  const h = await sha256(text)
  if (run !== checkRun) return
  newEl.textContent = h
  const same = h === current.hash
  verdict.dataset.state = same ? 'same' : 'changed'
  verdict.textContent = same
    ? 'Mismo hash: se reutiliza el vector guardado. Cero llamadas al modelo.'
    : 'Hash distinto: hay que volver a calcular el embedding de este fragmento y actualizar la fila.'
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)
