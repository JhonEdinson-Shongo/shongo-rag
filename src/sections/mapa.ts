import { gsap } from 'gsap'
import { $, esc } from '../ui/dom'

// Mapa completo: un trazado con dos carriles. Un "paquete" recorre el sistema mientras haces scroll,
// y cada estación se enciende cuando el paquete llega a ella. Pulsar una estación lleva a su sección.

interface Stop {
  num: string
  title: string
  lines: string[]
  accent: string // nombre del token de color (ingesta, embed, db…)
  href: string
}

const STOPS: Stop[] = [
  { num: '01', title: 'Archivo', lines: ['PDF, Word o web', 'pasa a texto plano'], accent: 'ingesta', href: '#ingesta' },
  { num: '01', title: 'Fragmentos', lines: ['el texto se parte', 'con solapamiento'], accent: 'ingesta', href: '#ingesta' },
  { num: '02', title: 'Embedding', lines: ['cada fragmento', 'se vuelve un vector'], accent: 'embed', href: '#embedding' },
  { num: '03', title: 'Base de datos', lines: ['id, hash, modelo,', 'texto y vector'], accent: 'db', href: '#base-datos' },
  { num: '04', title: 'Pregunta', lines: ['pasa por el mismo', 'modelo que los fragmentos'], accent: 'acid', href: '#pregunta' },
  { num: '05', title: 'Proximidad', lines: ['coseno, top-k', 'y umbral'], accent: 'sky', href: '#proximidad' },
  { num: '06', title: 'Prompt', lines: ['instrucciones, fragmentos', 'numerados y la pregunta'], accent: 'coral', href: '#respuesta' },
  { num: '06', title: 'Respuesta', lines: ['con citas, o un', '"no lo encuentro"'], accent: 'coral', href: '#respuesta' },
]

const LANES = ['INGESTA · una vez por documento', 'CONSULTA · cada pregunta']

interface Geo {
  vertical: boolean
  w: number
  h: number
  r: number // radio de cada estación
  pos: [number, number][] // centro de cada estación
  labels: { x: number; titleY: number; lineY: number[]; anchor: 'start' | 'middle' }[]
  track: string // trazado (path SVG)
  lanes: { x: number; y: number; text: string; anchor: 'start' | 'middle' }[]
}

// Horizontal: ingesta de izquierda a derecha, un giro a la derecha y la consulta de regreso.
function horizontal(): Geo {
  const y1 = 150
  const y2 = 340
  const xs1 = [110, 360, 610, 860]
  const xs2 = [860, 610, 360, 110]
  const pos: [number, number][] = [
    ...xs1.map((x): [number, number] => [x, y1]),
    ...xs2.map((x): [number, number] => [x, y2]),
  ]
  const labels = pos.map(([x, y], i) =>
    i < 4
      ? { x, titleY: y - 80, lineY: [y - 58, y - 40], anchor: 'middle' as const }
      : { x, titleY: y + 52, lineY: [y + 74, y + 92], anchor: 'middle' as const },
  )
  return {
    vertical: false,
    w: 1000,
    h: 460,
    r: 24,
    pos,
    labels,
    track: `M${xs1[0]} ${y1} H${xs1[3]} C960 ${y1} 960 ${y2} ${xs2[0]} ${y2} H${xs2[3]}`,
    lanes: [
      { x: 24, y: 28, text: LANES[0], anchor: 'start' },
      { x: 24, y: 296, text: LANES[1], anchor: 'start' },
    ],
  }
}

// Vertical (celulares): una sola columna, el texto a la derecha de cada estación.
function vertical(): Geo {
  const x = 44
  const ys = [60, 152, 244, 336, 484, 576, 668, 760]
  return {
    vertical: true,
    w: 340,
    h: 800,
    r: 22,
    pos: ys.map((y): [number, number] => [x, y]),
    labels: ys.map((y) => ({ x: 80, titleY: y - 4, lineY: [y + 14, y + 31], anchor: 'start' as const })),
    track: `M${x} ${ys[0]} V${ys[ys.length - 1]}`,
    lanes: [
      { x: 80, y: 30, text: LANES[0], anchor: 'start' },
      { x: 80, y: 440, text: LANES[1], anchor: 'start' },
    ],
  }
}

function markup(g: Geo): string {
  const stops = STOPS.map((s, i) => {
    const [x, y] = g.pos[i]
    const L = g.labels[i]
    return `
      <a class="stop" href="${s.href}" aria-label="${esc(s.title)}, paso ${s.num}" style="--c:var(--color-${s.accent})">
        <circle class="stop-dot" cx="${x}" cy="${y}" r="${g.r}"/>
        <text class="stop-num" x="${x}" y="${y + 4.5}" text-anchor="middle">${s.num}</text>
        <text class="stop-title" x="${L.x}" y="${L.titleY}" text-anchor="${L.anchor}">${esc(s.title)}</text>
        ${s.lines.map((t, k) => `<text class="stop-line" x="${L.x}" y="${L.lineY[k]}" text-anchor="${L.anchor}">${esc(t)}</text>`).join('')}
      </a>`
  }).join('')
  const lanes = g.lanes
    .map((l) => `<text class="map-lane" x="${l.x}" y="${l.y}" text-anchor="${l.anchor}">${esc(l.text)}</text>`)
    .join('')
  const [sx, sy] = g.pos[0]
  return `
    <svg class="map-svg ${g.vertical ? 'map--v' : 'map--h'}" viewBox="0 0 ${g.w} ${g.h}" role="group" aria-labelledby="map-title">
      <title id="map-title">Mapa del RAG: primero la ingesta, después cada consulta</title>
      ${lanes}
      <path class="map-track" d="${g.track}"/>
      <path class="map-done" d="${g.track}" pathLength="1"/>
      ${stops}
      <circle class="map-packet" cx="${sx}" cy="${sy}" r="11"/>
    </svg>`
}

// Conecta el trazado con el scroll: el paquete avanza y las estaciones se encienden al pasar.
function bind(svg: SVGSVGElement, g: Geo): gsap.core.Tween | null {
  const track = svg.querySelector<SVGPathElement>('.map-track')!
  const done = svg.querySelector<SVGPathElement>('.map-done')!
  const packet = svg.querySelector<SVGCircleElement>('.map-packet')!
  const stops = [...svg.querySelectorAll<SVGAElement>('.stop')]
  const len = track.getTotalLength()

  // Dónde está cada estación a lo largo del trazado (0 = inicio, 1 = final).
  const at = g.pos.map(([x, y]) => {
    let best = 0
    let bestD = Infinity
    for (let k = 0; k <= 2000; k++) {
      const pt = track.getPointAtLength((len * k) / 2000)
      const d = (pt.x - x) ** 2 + (pt.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = k / 2000
      }
    }
    return best
  })

  const state = { p: 0 }
  const paint = () => {
    const p = state.p
    done.style.strokeDashoffset = String(1 - p)
    const pt = track.getPointAtLength(p * len)
    packet.setAttribute('cx', String(pt.x))
    packet.setAttribute('cy', String(pt.y))
    stops.forEach((s, i) => s.classList.toggle('is-lit', p >= at[i] - 0.001))
  }
  paint()

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.p = 1
    paint()
    return null
  }
  // El recorrido termina mientras el mapa sigue a la vista:
  // - Horizontal: arranca cuando el mapa asoma y acaba justo cuando queda completo en pantalla.
  // - Vertical: el paquete va a la altura de la línea de lectura (60 % de la pantalla) mientras bajas.
  const range = g.vertical ? { start: 'top 60%', end: 'bottom 60%' } : { start: 'top 85%', end: 'bottom 85%' }
  return gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: paint,
    scrollTrigger: { trigger: svg, ...range, scrub: 0.35, invalidateOnRefresh: true },
  })
}

// Dibuja el mapa en horizontal o en vertical según el ancho de la pantalla, y lo vuelve a dibujar al cambiar.
export function initMapa() {
  const mount = $('#mapa')
  const mq = matchMedia('(max-width: 859px)')
  let tween: gsap.core.Tween | null = null

  const render = () => {
    tween?.scrollTrigger?.kill()
    tween?.kill()
    const g = mq.matches ? vertical() : horizontal()
    mount.innerHTML = markup(g)
    tween = bind(mount.querySelector<SVGSVGElement>('svg')!, g)
  }

  render()
  mq.addEventListener('change', render)
}
