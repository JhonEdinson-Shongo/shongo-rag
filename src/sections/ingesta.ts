import { gsap } from 'gsap'
import { CLEAN_DOC, on, setChunking, state, type Chunk } from '../lib/state'
import { DOC_TITLE } from '../lib/corpus'
import { chunkColor } from '../lib/theme'
import { $, esc } from '../ui/dom'

// Sección 01: el archivo se corta en fragmentos. Se ve dónde cae cada corte y dónde se solapan.
export function initIngesta() {
  const size = $<HTMLInputElement>('#size')
  const overlap = $<HTMLInputElement>('#overlap')
  const sizeOut = $('#size-out')
  const overlapOut = $('#overlap-out')

  const apply = () => {
    const s = Number(size.value)
    const o = Math.min(Number(overlap.value), Math.floor(s / 2))
    overlap.max = String(Math.floor(s / 2))
    sizeOut.textContent = `${s} caracteres`
    overlapOut.textContent = `${o} caracteres`
    setChunking(s, o)
  }
  size.addEventListener('input', apply)
  overlap.addEventListener('input', apply)

  on(['chunks'], render)
  render()
}

function render() {
  $('#doc-title').textContent = DOC_TITLE
  renderDoc($('#doc-view'), state.chunks)
  renderCards($('#chunk-list'), state.chunks)
  const n = state.chunks.length
  const avg = Math.round(state.chunks.reduce((s, c) => s + c.text.length, 0) / Math.max(1, n))
  $('#ingesta-stats').innerHTML = `
    <span><b>${n}</b> fragmentos</span>
    <span><b>${avg}</b> caracteres en promedio</span>
    <span><b>${CLEAN_DOC.length}</b> caracteres en total</span>`
}

// Pinta el documento. Cada carácter sabe cuántos fragmentos lo contienen:
// 1 = color del fragmento; 2 o más = zona de solapamiento (rayada).
function renderDoc(el: HTMLElement, chunks: Chunk[]) {
  const n = CLEAN_DOC.length
  const owners: number[][] = Array.from({ length: n }, () => [])
  for (const c of chunks) for (let p = c.start; p < c.end && p < n; p++) owners[p].push(c.index)

  let html = ''
  let p = 0
  while (p < n) {
    const key = owners[p].join(',')
    let q = p + 1
    while (q < n && owners[q].join(',') === key) q++
    const text = esc(CLEAN_DOC.slice(p, q))
    const list = owners[p]
    if (list.length === 0) html += text
    else if (list.length === 1) html += `<mark class="seg" style="--c:${chunkColor(list[0])}">${text}</mark>`
    else html += `<mark class="seg seg--overlap" style="--c:${chunkColor(list[0])}">${text}</mark>`
    p = q
  }
  el.innerHTML = html
  gsap.fromTo(el, { opacity: 0.4 }, { opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
}

function renderCards(el: HTMLElement, chunks: Chunk[]) {
  el.innerHTML = chunks
    .map(
      (c) => `
      <article class="chunk-card" style="--c:${chunkColor(c.index)}">
        <header class="flex items-center justify-between gap-3">
          <b class="font-mono text-xs">${c.id}</b>
          <span class="font-mono text-[0.6875rem] text-ink-faint">${c.text.length} car. · pos ${c.start}–${c.end}</span>
        </header>
        <p class="text-sm leading-relaxed text-ink-dim">${esc(c.text)}</p>
      </article>`,
    )
    .join('')
  gsap.from($$cards(el), { opacity: 0, y: 14, duration: 0.5, stagger: 0.06, ease: 'power2.out', overwrite: 'auto' })
}

const $$cards = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.chunk-card')]
