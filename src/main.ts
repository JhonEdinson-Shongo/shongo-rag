// Fuentes propias (latin cubre el español): ninguna petición a terceros bloquea el primer render.
import '@fontsource/syne/latin-700.css'
import '@fontsource/syne/latin-800.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import 'lenis/dist/lenis.css'
import './styles/main.css'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { initState } from './lib/state'
import { $ } from './ui/dom'
import { initMode } from './ui/mode'
import { initChrome } from './sections/chrome'
import { initIngesta } from './sections/ingesta'
import { initEmbedding } from './sections/embedding'
import { initDatabase } from './sections/database'
import { initPregunta } from './sections/pregunta'
import { initProximidad } from './sections/proximidad'
import { initRespuesta } from './sections/respuesta'
import { initMapa } from './sections/mapa'
import { initAccess, onAccessChange, reduceMotion } from './ui/access'
import { initDiagrama } from './sections/diagrama'

gsap.registerPlugin(ScrollTrigger)

// Scroll suave con Lenis, sincronizado con el reloj de GSAP (como en shongo-memoria).
// Se apaga con "Reducir movimiento" y vuelve a encenderse al desactivarlo.
let lenis: Lenis | null = null
const tick = (time: number) => lenis?.raf(time * 1000)
function syncSmooth() {
  const want = !reduceMotion()
  if (want && !lenis) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(tick)
  } else if (!want && lenis) {
    gsap.ticker.remove(tick)
    lenis.destroy()
    lenis = null
  }
}
gsap.ticker.lagSmoothing(0)

const scrollTo = (href: string) => {
  const el = document.querySelector<HTMLElement>(href)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: -64 })
  else el.scrollIntoView({ behavior: 'smooth' })
}

// El fondo 3D es decoración: se descarga y dibuja cuando la página ya está lista, sin frenar el primer pintado.
function scheduleBackground() {
  const later = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300))
  const start = () =>
    later(() => {
      void import('./three/background').then(({ initBackground }) => {
        const canvas = $<HTMLCanvasElement>('#bg')
        initBackground(canvas)
        canvas.classList.add('is-on')
      })
    })
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

function boot() {
  // Primero las preferencias de lectura y accesibilidad: afectan al resto del sitio.
  initAccess()
  syncSmooth()
  onAccessChange(syncSmooth)
  // El modo va primero: los módulos de dibujo leen sus colores del modo activo al arrancar.
  initMode()
  scheduleBackground()

  // Primero el estado (documento, fragmentos, vectores), luego cada sección lo pinta.
  initState()
  initIngesta()
  initEmbedding()
  initDatabase()
  initPregunta()
  initProximidad()
  initRespuesta()
  // Antes de initChrome: así sus estaciones también usan el desplazamiento suave.
  initMapa()
  initDiagrama()
  initChrome(scrollTo)

  document.body.classList.add('is-ready')
  void document.fonts.ready.then(() => ScrollTrigger.refresh())
}

boot()
