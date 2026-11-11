import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { $$ } from '../ui/dom'

// Lo que envuelve la página: barra de progreso, mapa lateral de pasos y revelados al hacer scroll.
export function initChrome(scrollTo: (target: string) => void) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // Barra de progreso del scroll.
  gsap.to('#progress', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
  })

  // Marca el paso activo en el mapa lateral y en el menú superior.
  const setActive = (step: string) => {
    $$('[data-step-link]').forEach((a) => a.classList.toggle('is-active', a.dataset.stepLink === step))
  }
  $$('section[data-step]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => self.isActive && setActive(sec.dataset.step ?? ''),
    })
  })

  // Enlaces internos con scroll suave (Lenis, si está activo).
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') ?? ''
      if (href.length < 2) return
      e.preventDefault()
      scrollTo(href)
    }),
  )

  if (reduced) return

  // Revelado de bloques al entrar en pantalla.
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 28,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    })
  })

  // Revelado en cascada para grupos (tarjetas, pasos del resumen…).
  gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
    gsap.from(group.children, {
      opacity: 0,
      y: 24,
      duration: 0.8,
      stagger: 0.08,
      ease: 'power3.out',
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    })
  })
}
