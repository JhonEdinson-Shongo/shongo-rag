import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { $ } from '../ui/dom'

// Diagrama de un RAG simple. Arriba: cómo se prepara la base (una vez). Abajo: cómo responde una pregunta.
// Mismas piezas que el dibujo de referencia (documentos, chunks, modelo de embeddings, base vectorial,
// consulta, contenido recuperado, prompt, LLM y respuesta), con los colores de cada etapa.
const W = 1000
const H = 600
const INK = 'var(--color-ink-dim)'
const ACID = 'var(--color-acid)'
const CORAL = 'var(--color-coral)'

const step = (inner: string) => `<g class="dg-step">${inner}</g>`

const node = (x: number, y: number, w: number, h: number, color: string, rx = 14) =>
  `<rect class="dg-node" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" style="--c:${color}"/>`

// Documentos o trozos apilados: tres hojas, la de delante en (x, y).
const stack = (x: number, y: number, w: number, h: number, color: string) =>
  [
    [0.24 * w, -0.16 * h],
    [0.12 * w, -0.08 * h],
    [0, 0],
  ]
    .map(([dx, dy]) => node(x + dx, y + dy, w, h, color, 6))
    .join('')

// Base vectorial: un cilindro de 110 de ancho y 120 de alto, centrado en cx y con la tapa en `top`.
const cylinder = (cx: number, top: number, color: string) => {
  const rx = 55
  const ry = 14
  const bottom = top + 120
  const body = `M${cx - rx} ${top + ry} V${bottom - ry} A${rx} ${ry} 0 0 0 ${cx + rx} ${bottom - ry} V${top + ry} Z`
  return `<path class="dg-node" d="${body}" style="--c:${color}"/>
    <ellipse class="dg-node" cx="${cx}" cy="${top + ry}" rx="${rx}" ry="${ry}" style="--c:${color}"/>`
}

const arrow = (d: string, color: string, dashed = false) =>
  `<path class="dg-arrow${dashed ? ' dg-arrow--dash' : ''}" d="${d}" style="--c:${color}" marker-end="url(#dg-m-${color === ACID ? 'acid' : color === CORAL ? 'coral' : 'ink'})"/>`

const text = (x: number, y: number, t: string, cls = 'dg-text', anchor = '') =>
  `<text class="${cls}" x="${x}" y="${y}"${anchor ? ` style="text-anchor:${anchor}"` : ''}>${t}</text>`

function svgMarkup(): string {
  const parts = [
    // Banda superior: preparación
    step(text(20, 60, 'PREPARACIÓN · una vez por documento', 'dg-band', 'start')),
    // Documentos → chunks → modelo de embeddings → base vectorial
    step(stack(60, 110, 70, 84, 'var(--color-ingesta)')),
    step(text(103, 216, 'Documentos', 'dg-sub')),
    step(arrow('M152 152 H232', INK)),
    step(stack(240, 130, 44, 52, 'var(--color-ingesta)')),
    step(text(267, 204, 'Chunks', 'dg-sub')),
    step(arrow('M300 152 H406', INK)),
    step(node(410, 116, 170, 72, 'var(--color-embed)')),
    step(text(495, 147, 'Modelo de', 'dg-text') + text(495, 168, 'embeddings', 'dg-text')),
    step(arrow('M580 152 H660 V253', INK)),
    step(text(672, 196, 'chunks +', 'dg-sub', 'start')),
    step(text(672, 212, 'embeddings', 'dg-sub', 'start')),
    step(cylinder(660, 255, 'var(--color-db)')),
    step(text(660, 402, 'Base vectorial', 'dg-sub')),

    // Banda inferior: consulta
    step(text(20, 262, 'CONSULTA · cada pregunta', 'dg-band', 'start')),
    // Usuario → consulta → mismo modelo → base vectorial → contenido recuperado
    step(node(30, 305, 90, 50, ACID, 12)),
    step(text(75, 336, 'Usuario')),
    step(arrow('M120 330 H184', INK)),
    step(node(190, 275, 96, 110, ACID, 8)),
    step(text(238, 303, 'Consulta')),
    step(arrow('M286 330 H374', INK)),
    step(text(331, 306, 'mismo', 'dg-sub') + text(331, 320, 'modelo', 'dg-sub')),
    step(node(380, 294, 170, 72, 'var(--color-embed)')),
    step(text(465, 324, 'Modelo de', 'dg-text') + text(465, 344, 'embeddings', 'dg-text')),
    step(arrow('M550 330 H600', INK)),
    step(arrow('M715 330 H794', INK)),
    step(stack(800, 290, 70, 70, 'var(--color-sky)')),
    step(text(843, 268, 'Contenido recuperado', 'dg-sub')),
    // Respuesta del contenido recuperado al prompt
    step(arrow('M835 364 V426', INK)),
    // La pregunta original también llega al prompt
    step(arrow('M238 385 V458 H756', ACID, true)),
    step(text(520, 448, 'la pregunta original también llega al prompt', 'dg-sub')),
    step(node(760, 430, 150, 56, CORAL)),
    step(text(835, 463, 'Prompt')),
    step(arrow('M835 486 V516', INK)),
    step(node(760, 520, 150, 56, CORAL)),
    step(text(835, 553, 'LLM')),
    // Respuesta: del LLM de vuelta al usuario
    step(arrow('M760 548 H75 V356', CORAL)),
    step(text(420, 538, 'respuesta', 'dg-sub')),
  ]

  const defs = [
    ['ink', INK],
    ['acid', ACID],
    ['coral', CORAL],
  ]
    .map(
      ([id, fill]) =>
        `<marker id="dg-m-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" style="fill:${fill}"/></marker>`,
    )
    .join('')

  return `
    <svg class="dg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="dg-title">
      <title id="dg-title">Diagrama de un RAG simple: los documentos se dividen en chunks, se convierten en embeddings y se guardan en una base vectorial. Una consulta usa el mismo modelo, recupera contenido, arma un prompt con el LLM y devuelve la respuesta al usuario.</title>
      <defs>${defs}</defs>
      ${parts.join('\n      ')}
    </svg>`
}

// Dibuja el diagrama y lo revela con una cascada suave la primera vez que entra en pantalla.
export function initDiagrama() {
  const mount = $('#diagrama')
  mount.innerHTML = svgMarkup()
  const svg = mount.querySelector<SVGSVGElement>('svg')!
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.from(svg.querySelectorAll('.dg-step'), {
    opacity: 0,
    duration: 0.6,
    stagger: 0.05,
    ease: 'power2.out',
    scrollTrigger: { trigger: svg, start: 'top 80%', once: true },
  })
  ScrollTrigger.refresh()
}
