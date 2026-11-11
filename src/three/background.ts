import * as THREE from 'three'
import { gsap } from 'gsap'
import { readPalette, type Accent } from '../lib/theme'
import { currentMode, onModeChange } from '../ui/mode'
import { reduceMotion } from '../ui/access'

const POINT_ACCENTS: Accent[] = ['ingesta', 'embed', 'db', 'sky', 'acid', 'coral']
// Cada punto se une con sus K vecinos más cercanos, si están a menos de MAX_DIST: una red, no líneas sueltas.
const NEIGHBORS = 3
const MAX_DIST = 2.0

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
  for (let i = 0; i < N; i++) {
    // Puntos repartidos en una cáscara esférica: parecen vectores apuntando en todas direcciones.
    const r = 5 + Math.random() * 7
    const u = Math.random() * 2 - 1
    const t = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3)
    assign[i] = (Math.random() * POINT_ACCENTS.length) | 0
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

  // Colores y opacidades del modo activo. En claro, la luz se apaga un poco para no lavar el fondo.
  const paint = () => {
    const p = readPalette()
    const swatches = POINT_ACCENTS.map((name) => new THREE.Color(p[name]))
    for (let i = 0; i < N; i++) {
      const c = swatches[assign[i]]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    for (let e = 0; e < E; e++) {
      for (let v = 0; v < 2; v++) {
        const idx = edges[e * 2 + v]
        const c = swatches[assign[idx]]
        lineCol.set([c.r, c.g, c.b], (e * 2 + v) * 3)
      }
    }
    colorAttr.needsUpdate = true
    lineColorAttr.needsUpdate = true
    const light = currentMode() === 'light'
    points.material.opacity = light ? 0.7 : 0.85
    lineMat.opacity = light ? 0.34 : 0.2
  }
  paint()
  onModeChange(paint)

  const resize = () => {
    const w = innerWidth
    const h = innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  addEventListener('resize', resize)
  resize()

  let scrollP = 0
  let mx = 0
  let my = 0
  addEventListener(
    'scroll',
    () => {
      scrollP = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
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

  const frame = () => {
    if (reduceMotion()) {
      renderer.render(scene, camera) // sin giros mientras esté activo
      return
    }
    group.rotation.y += 0.0008 + mx * 0.0004
    group.rotation.x += (scrollP * 0.9 + my * 0.06 - group.rotation.x) * 0.05
    camera.position.z += (16 - scrollP * 4 - camera.position.z) * 0.05
    renderer.render(scene, camera)
  }

  if (reduced) {
    frame()
  } else {
    gsap.ticker.add(frame)
  }
}
