import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { readPalette, type Accent } from '../lib/theme'
import { currentMode, onModeChange } from '../ui/mode'
import { onAccessChange, reduceMotion } from '../ui/access'

const POINT_ACCENTS: Accent[] = ['ingesta', 'embed', 'db', 'sky', 'acid', 'coral']
// Cada punto se une con sus K vecinos más cercanos, si están a menos de MAX_DIST: una red, no líneas sueltas.
const NEIGHBORS = 3
const MAX_DIST = 2.0

// Lectura: en la portada la red es multicolor y protagonista. Dentro de las secciones se vuelve neutra
// y solo una parte de los nodos toma el color de la sección activa, para no competir con el texto.
const ACCENT_SHARE = 0.22 // fracción de nodos que toman el acento de la sección
const NEUTRAL_MIX = 0.5 // cuánto se acerca la tinta al fondo para el color neutro
// Presencia de la red (multiplica su opacidad): llena en la portada, baja mientras se lee
// y sube un poco mientras hay scroll (si te detienes, es que estás leyendo).
const PRESENCE_READING = 0.45
const PRESENCE_SCROLLING = 0.75
const SCROLL_IDLE_MS = 700

const cssColor = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Fondo fijo: una red de "fragmentos" flotando. Gira con el scroll y se mueve con el mouse.
export function initBackground(canvas: HTMLCanvasElement) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const small = innerWidth < 760

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.set(0, 0, 16)

  const N = small ? 420 : 900
  const pos = new Float32Array(N * 3)
  const assign = new Uint8Array(N) // acento de cada punto (se conserva al cambiar de modo)
  const takesAccent = new Uint8Array(N) // 1 = este punto toma el color de la sección activa
  for (let i = 0; i < N; i++) {
    // Puntos repartidos en una cáscara esférica: parecen vectores apuntando en todas direcciones.
    const r = 5 + Math.random() * 7
    const u = Math.random() * 2 - 1
    const t = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3)
    assign[i] = (Math.random() * POINT_ACCENTS.length) | 0
    takesAccent[i] = Math.random() < ACCENT_SHARE ? 1 : 0
  }

  // Vecinos: para cada punto, los K más cercanos dentro de MAX_DIST. Cada par se guarda una sola vez.
  const seen = new Set<number>()
  const edges: number[] = []
  const maxD2 = MAX_DIST * MAX_DIST
  for (let i = 0; i < N; i++) {
    const cand: { j: number; d2: number }[] = []
    for (let j = 0; j < N; j++) {
      if (j === i) continue
      const dx = pos[i * 3] - pos[j * 3]
      const dy = pos[i * 3 + 1] - pos[j * 3 + 1]
      const dz = pos[i * 3 + 2] - pos[j * 3 + 2]
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < maxD2) cand.push({ j, d2 })
    }
    cand.sort((a, b) => a.d2 - b.d2)
    for (const { j } of cand.slice(0, NEIGHBORS)) {
      const key = Math.min(i, j) * N + Math.max(i, j)
      if (seen.has(key)) continue
      seen.add(key)
      edges.push(i, j)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const col = new Float32Array(N * 3)
  const colorAttr = new THREE.BufferAttribute(col, 3)
  geo.setAttribute('color', colorAttr)

  // Sprite circular (un degradado en un canvas) para que cada punto se vea como una luz, no como un cuadrado.
  const spriteCanvas = document.createElement('canvas')
  spriteCanvas.width = spriteCanvas.height = 64
  const g = spriteCanvas.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.16,
      map: new THREE.CanvasTexture(spriteCanvas),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  )

  // Las aristas: dos extremos por arista, cada extremo con el color de su punto.
  const E = edges.length / 2
  const linePos = new Float32Array(E * 2 * 3)
  const lineCol = new Float32Array(E * 2 * 3)
  for (let e = 0; e < E; e++) {
    for (let v = 0; v < 2; v++) {
      const idx = edges[e * 2 + v]
      linePos.set([pos[idx * 3], pos[idx * 3 + 1], pos[idx * 3 + 2]], (e * 2 + v) * 3)
    }
  }
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
  const lineColorAttr = new THREE.BufferAttribute(lineCol, 3)
  lineGeo.setAttribute('color', lineColorAttr)
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })
  const lines = new THREE.LineSegments(lineGeo, lineMat)

  const group = new THREE.Group()
  group.add(points, lines)
  scene.add(group)

  // --- Color -------------------------------------------------------------------------------
  // multi: el color propio de cada punto (portada). neutral: tinta apagada hacia el fondo.
  // mix.mono va de 0 (red multicolor) a 1 (red neutra + acento de la sección); r/g/b es ese acento.
  const multi = new Float32Array(N * 3)
  const neutral = new THREE.Color()
  const mix = { mono: 0, r: 1, g: 1, b: 1 }
  let activeSection: HTMLElement | null = null
  let basePointOpacity = 0.85
  let baseLineOpacity = 0.2

  const sectionAccent = (el: HTMLElement | null) => {
    const c = el ? getComputedStyle(el).getPropertyValue('--c').trim() : ''
    return c ? new THREE.Color(c) : null
  }

  const recolor = () => {
    const k = mix.mono
    for (let i = 0; i < N; i++) {
      const tr = takesAccent[i] ? mix.r : neutral.r
      const tg = takesAccent[i] ? mix.g : neutral.g
      const tb = takesAccent[i] ? mix.b : neutral.b
      col[i * 3] = multi[i * 3] + (tr - multi[i * 3]) * k
      col[i * 3 + 1] = multi[i * 3 + 1] + (tg - multi[i * 3 + 1]) * k
      col[i * 3 + 2] = multi[i * 3 + 2] + (tb - multi[i * 3 + 2]) * k
    }
    for (let e = 0; e < E; e++) {
      for (let v = 0; v < 2; v++) {
        const idx = edges[e * 2 + v]
        lineCol.set([col[idx * 3], col[idx * 3 + 1], col[idx * 3 + 2]], (e * 2 + v) * 3)
      }
    }
    colorAttr.needsUpdate = true
    lineColorAttr.needsUpdate = true
    requestRender()
  }

  // Colores y opacidades del modo activo. En claro, la luz se apaga un poco para no lavar el fondo.
  const paint = () => {
    const p = readPalette()
    const swatches = POINT_ACCENTS.map((name) => new THREE.Color(p[name]))
    for (let i = 0; i < N; i++) {
      const c = swatches[assign[i]]
      multi.set([c.r, c.g, c.b], i * 3)
    }
    neutral.set(cssColor('--color-ink')).lerp(new THREE.Color(cssColor('--color-ground')), NEUTRAL_MIX)
    // El acento de la sección también cambia de valor con el modo.
    const accent = sectionAccent(activeSection)
    if (accent) Object.assign(mix, { r: accent.r, g: accent.g, b: accent.b })
    const light = currentMode() === 'light'
    basePointOpacity = light ? 0.7 : 0.85
    baseLineOpacity = light ? 0.34 : 0.2
    recolor()
  }

  // Al entrar en una sección: la red pasa a neutra con su acento. En la portada vuelve a multicolor.
  const setSection = (el: HTMLElement) => {
    activeSection = el
    const accent = sectionAccent(el)
    const to = accent ? { mono: 1, r: accent.r, g: accent.g, b: accent.b } : { mono: 0 }
    gsap.to(mix, { ...to, duration: reduceMotion() ? 0 : 1.2, ease: 'power2.inOut', overwrite: true, onUpdate: recolor })
  }

  // --- Movimiento y presencia ---------------------------------------------------------------
  const resize = () => {
    const w = innerWidth
    const h = innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    requestRender()
  }

  let scrollP = 0
  let mx = 0
  let my = 0
  let lastScroll = -Infinity
  let presence = 1
  addEventListener(
    'scroll',
    () => {
      scrollP = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
      lastScroll = performance.now()
    },
    { passive: true },
  )
  addEventListener(
    'pointermove',
    (e) => {
      mx = (e.clientX / innerWidth) * 2 - 1
      my = (e.clientY / innerHeight) * 2 - 1
    },
    { passive: true },
  )

  // Portada (mono 0) = presencia llena; dentro de las secciones, según si hay scroll o lectura.
  const targetPresence = () => {
    const inside = performance.now() - lastScroll < SCROLL_IDLE_MS ? PRESENCE_SCROLLING : PRESENCE_READING
    return 1 + (inside - 1) * mix.mono
  }

  const applyPresence = () => {
    points.material.opacity = basePointOpacity * presence
    lineMat.opacity = baseLineOpacity * presence
  }

  // Ahorro de GPU y batería: el canvas se oculta con modo lectura y "reducir movimiento" (no se dibuja),
  // la escena 3D de proximidad tiene su propio WebGL (el fondo se congela mientras está a la vista)
  // y mientras se lee la red cambia poco: basta con medio ritmo (~30 fps).
  const root = document.documentElement
  const canvasHidden = () => root.dataset.reading === 'on' || root.dataset.motion === 'reduce'
  let spaceVisible = false
  const spaceEl = document.getElementById('space')
  if (spaceEl) new IntersectionObserver(([e]) => (spaceVisible = e.isIntersecting), { threshold: 0.01 }).observe(spaceEl)
  let dirty = true // hay algo nuevo que dibujar (color, tamaño, modo)
  let tick = 0

  const frame = () => {
    if (canvasHidden()) return
    if (reduceMotion()) {
      // Sin transiciones ni giros: solo se dibuja cuando algo cambió.
      const p = targetPresence()
      if (!dirty && Math.abs(p - presence) < 0.001) return
      presence = p
      applyPresence()
      renderer.render(scene, camera)
      dirty = false
      return
    }
    const changing = dirty || gsap.isTweening(mix)
    // Congelado (ni se mueve ni se dibuja): así al volver no salta.
    if (spaceVisible && !changing) return
    const target = targetPresence()
    presence += (target - presence) * 0.05
    applyPresence()
    // El movimiento se calcula en cada tic (misma velocidad); lo que se salta es el dibujo.
    group.rotation.y += 0.0008 + mx * 0.0004
    group.rotation.x += (scrollP * 0.9 + my * 0.06 - group.rotation.x) * 0.05
    camera.position.z += (16 - scrollP * 4 - camera.position.z) * 0.05
    tick++
    const reading = Math.abs(target - PRESENCE_READING) < 0.01 && Math.abs(target - presence) < 0.01
    if (reading && !changing && tick % 2) return
    renderer.render(scene, camera)
    dirty = false
  }

  // Sin bucle (movimiento reducido del sistema), cada cambio de color o tamaño se dibuja a mano.
  let ready = false
  function requestRender() {
    dirty = true
    if (ready && reduced) frame()
  }

  // --- Arranque ------------------------------------------------------------------------------
  addEventListener('resize', resize)
  resize()
  paint()
  onModeChange(paint)
  // Al salir del modo lectura o de "reducir movimiento", el canvas vuelve a verse: redibujarlo.
  onAccessChange(requestRender)

  // La sección activa es la que cruza el 60% de la pantalla.
  document.querySelectorAll<HTMLElement>('main > section').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 60%',
      end: 'bottom 60%',
      onToggle: (self) => self.isActive && setSection(el),
    })
  })

  ready = true
  if (reduced) {
    frame()
  } else {
    gsap.ticker.add(frame)
  }
}
