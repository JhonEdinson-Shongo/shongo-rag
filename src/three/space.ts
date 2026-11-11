import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { gsap } from 'gsap'
import { fitProjector, project, type Projector } from '../lib/pca'
import { readPalette, type Accent } from '../lib/theme'
import { currentMode, onModeChange } from '../ui/mode'
import { reduceMotion } from '../ui/access'

export interface SpaceHit {
  index: number
  cos: number
  inTop: boolean
  selected: boolean
}

const MAX_CHUNKS = 40
const MAX_LINES = 8
const AXIS_ACCENTS: Accent[] = ['ingesta', 'embed', 'db']

// Espacio vectorial en 3D: cada fragmento es un punto, la pregunta es un punto lima,
// y las líneas muestran qué fragmentos quedaron más cerca.
export class VectorSpace {
  private renderer: THREE.WebGLRenderer
  private css: CSS2DRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  private controls: OrbitControls
  private projector: Projector | null = null
  private scale = 1
  private running = true
  private lineTargets: number[] = []
  private lastHits: SpaceHit[] = []

  private dots: THREE.Mesh[] = []
  private labels: CSS2DObject[] = []
  private labelEls: HTMLElement[] = []
  private lines: THREE.Line[] = []

  private query: THREE.Mesh
  private queryMat: THREE.MeshStandardMaterial
  private ring: THREE.Mesh
  private ringMat: THREE.MeshBasicMaterial
  private rim: THREE.PointLight
  private grid?: THREE.GridHelper
  private axisMats: THREE.LineBasicMaterial[] = []

  constructor(container: HTMLElement) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.domElement.classList.add('space-gl')
    container.append(this.renderer.domElement)

    this.css = new CSS2DRenderer()
    this.css.domElement.classList.add('space-css')
    container.append(this.css.domElement)

    this.camera.position.set(3.6, 2.4, 5.4)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 3.5
    this.controls.maxDistance = 11
    this.controls.autoRotate = !reduced
    this.controls.autoRotateSpeed = 0.5

    // Luces: una blanca de relleno, una de frente y una lima que sale de la pregunta (su color se fija al pintar).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.3)
    key.position.set(3, 5, 4)
    this.scene.add(key)
    this.rim = new THREE.PointLight(0xffffff, 1.1, 9)
    this.rim.position.set(-2, 2, 3)
    this.scene.add(this.rim)

    // Los tres ejes principales (PC1, PC2, PC3).
    const axisEnds: number[][] = [
      [3, 0, 0],
      [0, 3, 0],
      [0, 0, 3],
    ]
    axisEnds.forEach((end, i) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...end)])
      const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 })
      this.axisMats.push(mat)
      this.scene.add(new THREE.Line(g, mat))
      const el = document.createElement('div')
      el.className = 'axis-label'
      el.textContent = `PC${i + 1}`
      const lbl = new CSS2DObject(el)
      lbl.position.set(end[0] * 1.08, end[1] * 1.08, end[2] * 1.08)
      this.scene.add(lbl)
    })

    // Pool de puntos y etiquetas: se reutilizan al cambiar el número de fragmentos.
    const dotGeo = new THREE.SphereGeometry(0.085, 24, 18)
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.2, roughness: 0.35 })
      const dot = new THREE.Mesh(dotGeo, mat)
      dot.visible = false
      this.scene.add(dot)
      const el = document.createElement('div')
      el.className = 'pt-label'
      const lbl = new CSS2DObject(el)
      lbl.position.set(0, 0.24, 0)
      dot.add(lbl)
      this.dots.push(dot)
      this.labels.push(lbl)
      this.labelEls.push(el)
    }

    for (let i = 0; i < MAX_LINES; i++) {
      const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 }),
      )
      line.visible = false
      this.scene.add(line)
      this.lines.push(line)
    }

    // La pregunta: una esfera lima con un anillo que siempre mira a la cámara.
    this.queryMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.9 })
    this.query = new THREE.Mesh(new THREE.SphereGeometry(0.11, 28, 20), this.queryMat)
    this.scene.add(this.query)
    this.ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.23, 48), this.ringMat)
    this.scene.add(this.ring)
    const qEl = document.createElement('div')
    qEl.className = 'pt-label pt-label--query'
    qEl.textContent = 'Pregunta'
    const qLbl = new CSS2DObject(qEl)
    qLbl.position.set(0, 0.46, 0)
    this.query.add(qLbl)
    if (!reduced) gsap.to(this.ring.scale, { x: 1.5, y: 1.5, duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut' })

    // Dimensiones: se ajustan al contenedor.
    new ResizeObserver(() => this.resize(container)).observe(container)
    this.resize(container)

    // Solo renderiza cuando la sección está en pantalla.
    new IntersectionObserver(([e]) => (this.running = e.isIntersecting), { threshold: 0.01 }).observe(container)

    // Colores del modo activo, y de nuevo cada vez que cambie.
    this.repaint()
    onModeChange(() => this.repaint())

    this.loop()
  }

  private resize(container: HTMLElement) {
    const w = container.clientWidth
    const h = container.clientHeight
    this.renderer.setSize(w, h, false)
    this.css.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // Pinta todo lo que depende del modo: piso, ejes, luz, pregunta y los resultados.
  private repaint() {
    const p = readPalette()
    const light = currentMode() === 'light'

    if (this.grid) {
      this.scene.remove(this.grid)
      this.grid.geometry.dispose()
      ;(this.grid.material as THREE.Material).dispose()
    }
    this.grid = new THREE.GridHelper(7, 14, light ? '#c4c3bb' : '#2b313c', light ? '#dad9d2' : '#171b22')
    this.grid.position.y = -2.4
    ;(this.grid.material as THREE.Material).transparent = true
    this.scene.add(this.grid)

    AXIS_ACCENTS.forEach((name, i) => this.axisMats[i].color.set(p[name]))
    this.rim.color.set(p.acid)
    this.queryMat.color.set(p.acid)
    this.queryMat.emissive.set(p.acid)
    this.ringMat.color.set(p.acid)
    this.paintHits(p)
  }

  // Los vectores (8 números) se proyectan a 3D con PCA para poder dibujarlos.
  setChunks(vectors: number[][]) {
    this.projector = vectors.length >= 2 ? fitProjector(vectors, 3) : null
    const pts = vectors.map((v) => (this.projector ? project(this.projector, v) : [0, 0, 0]))
    const maxAbs = Math.max(1e-6, ...pts.flat().map(Math.abs))
    this.scale = 2.6 / maxAbs

    this.dots.forEach((dot, i) => {
      const p = pts[i]
      dot.visible = i < pts.length
      this.labels[i].visible = i < pts.length
      if (!p) return
      dot.position.set(p[0] * this.scale, p[1] * this.scale, p[2] * this.scale)
      this.labelEls[i].textContent = `c_${String(i + 1).padStart(2, '0')}`
    })
  }

  setQuery(vector: number[]) {
    if (!this.projector) return
    const p = project(this.projector, vector)
    const s = this.scale
    gsap.to(this.query.position, { x: p[0] * s, y: p[1] * s, z: p[2] * s, duration: 0.9, ease: 'power3.out' })
  }

  // Guarda los resultados y los dibuja: colores de punto, etiquetas y líneas hacia el top-k.
  setHits(hits: SpaceHit[]) {
    this.lastHits = hits
    const hitBy = new Map(hits.map((h) => [h.index, h]))
    this.dots.forEach((dot, i) => {
      const h = hitBy.get(i)
      gsap.to(dot.scale, { x: h?.inTop ? 1.3 : 1, y: h?.inTop ? 1.3 : 1, z: h?.inTop ? 1.3 : 1, duration: 0.4, ease: 'back.out(2)' })
      const el = this.labelEls[i]
      if (h) el.textContent = `c_${String(i + 1).padStart(2, '0')} · ${h.cos.toFixed(2)}`
      el.classList.toggle('is-selected', !!h?.selected)
      el.classList.toggle('is-muted', !h?.inTop)
    })
    this.lineTargets = hits.filter((h) => h.inTop).map((h) => h.index)
    this.paintHits()
  }

  // Colores de los resultados según el modo: celeste = pasa al prompt, rojo brasa = bajo el umbral, gris = fuera.
  private paintHits(p = readPalette()) {
    const muted = currentMode() === 'light' ? '#b8bcc6' : '#3a404d'
    const hitBy = new Map(this.lastHits.map((h) => [h.index, h]))
    this.dots.forEach((dot, i) => {
      const h = hitBy.get(i)
      const color = !h || !h.inTop ? muted : h.selected ? p.sky : p.brasa
      const mat = dot.material as THREE.MeshStandardMaterial
      mat.color.set(color)
      mat.emissive.set(color)
      mat.emissiveIntensity = h?.inTop ? 0.6 : 0.12
    })

    const top = this.lastHits.filter((h) => h.inTop)
    this.lines.forEach((line, j) => {
      const h = top[j]
      line.visible = !!h && j < MAX_LINES
      if (!h) return
      const mat = line.material as THREE.LineBasicMaterial
      mat.color.set(h.selected ? p.sky : p.brasa)
      mat.opacity = 0.25 + 0.7 * Math.max(0, h.cos)
    })
  }

  private updateLines() {
    this.lineTargets.forEach((idx, j) => {
      const line = this.lines[j]
      if (!line || !line.visible || !this.dots[idx]) return
      line.geometry.setFromPoints([this.query.position, this.dots[idx].position])
    })
  }

  private loop = () => {
    requestAnimationFrame(this.loop)
    if (!this.running) return
    this.controls.autoRotate = !reduceMotion()
    this.controls.update()
    this.ring.position.copy(this.query.position)
    this.ring.quaternion.copy(this.camera.quaternion)
    this.updateLines()
    this.renderer.render(this.scene, this.camera)
    this.css.render(this.scene, this.camera)
  }
}
