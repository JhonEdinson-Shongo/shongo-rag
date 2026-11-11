import { gsap } from 'gsap'
import { DIMS, tokenInfo } from '../lib/embed'

export function $<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel)
  if (!el) throw new Error(`Falta el elemento ${sel}`)
  return el
}

export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  [...root.querySelectorAll<T>(sel)]

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
// Todo texto que viene del usuario pasa por aquí antes de entrar al HTML.
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c])

export const f2 = (x: number) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2))

// Vector como lista: [0.71, 0.00, …]. Solo muestra las primeras dimensiones si se pide.
export const vecText = (v: number[], n = v.length) =>
  `[${v.slice(0, n).map(f2).join(', ')}${n < v.length ? ', …' : ''}]`

// Barras de las 8 dimensiones. Cada barra tiene el color de su concepto.
export function renderVector(el: HTMLElement, vec: number[], opts: { max?: number } = {}) {
  const max = opts.max ?? Math.max(1e-9, ...vec.map(Math.abs))
  el.innerHTML = DIMS.map(
    (d, i) => `
      <div class="dim-row">
        <span class="dim-label">${esc(d.label)}</span>
        <div class="dim-track"><div class="dim-fill" style="--c:${d.color}"></div></div>
        <span class="dim-value">${f2(vec[i])}</span>
      </div>`,
  ).join('')
  $$('.dim-fill', el).forEach((fill, i) =>
    gsap.fromTo(
      fill,
      { scaleX: 0 },
      { scaleX: Math.max(0.015, Math.min(1, Math.abs(vec[i]) / max)), duration: 0.7, ease: 'power3.out', delay: i * 0.03, overwrite: 'auto' },
    ),
  )
}

// Tokens del texto: cada palabra que el modelo conoce se pinta del color de su concepto.
export function renderTokens(el: HTMLElement, text: string) {
  const toks = tokenInfo(text)
  if (toks.length === 0) {
    el.innerHTML = '<span class="text-ink-faint text-sm">Escribe algo para ver los tokens.</span>'
    return
  }
  el.innerHTML = toks
    .map((t) => {
      const known = t.dim >= 0
      const color = known ? DIMS[t.dim].color : 'var(--color-ink-faint)'
      const tag = known ? `<i>${DIMS[t.dim].key}</i>` : '<i>sin concepto</i>'
      return `<span class="tok ${known ? 'is-known' : ''}" style="--c:${color}"><b>${esc(t.word)}</b>${tag}</span>`
    })
    .join('')
  gsap.fromTo($$('.tok', el), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.025, overwrite: 'auto' })
}

// Pequeño "latido" del modelo cuando procesa un texto.
export function pulse(el: HTMLElement) {
  gsap.fromTo(
    el,
    { boxShadow: '0 0 0 0 rgba(139,123,255,0.55)' },
    { boxShadow: '0 0 0 18px rgba(139,123,255,0)', duration: 0.8, ease: 'power2.out' },
  )
}
