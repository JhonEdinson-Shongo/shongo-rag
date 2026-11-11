// Panel flotante de lectura y accesibilidad: tamaño del texto, espaciado, modo lectura, contraste alto
// y reducir movimiento. Las preferencias se guardan en este navegador. El script de <head> las aplica
// antes del primer pintado para que la página no parpadee.
export const ACCESS_KEY = 'shongo-rag-access'
const SIZES = [90, 100, 115, 130, 150, 175] // porcentaje del tamaño base del texto

export interface Prefs {
  fs: number
  spacing: boolean
  reading: boolean
  contrast: boolean
  motion: boolean
}

const DEFAULTS: Prefs = { fs: 100, spacing: false, reading: false, contrast: false, motion: false }
const listeners = new Set<(p: Prefs) => void>()

export function onAccessChange(fn: (p: Prefs) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Las animaciones se detienen si la persona lo pidió en el panel o si su sistema lo pide.
export function reduceMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches
}

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(ACCESS_KEY) ?? '{}') as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(p: Prefs) {
  try {
    localStorage.setItem(ACCESS_KEY, JSON.stringify(p))
  } catch {
    /* modo privado: los ajustes valen para esta visita */
  }
}

function apply(p: Prefs) {
  const r = document.documentElement
  r.style.fontSize = `${p.fs}%`
  r.dataset.reading = p.reading ? 'on' : 'off'
  r.dataset.spacing = p.spacing ? 'wide' : 'normal'
  r.dataset.contrast = p.contrast ? 'high' : 'normal'
  r.dataset.motion = p.motion ? 'reduce' : 'normal'
  listeners.forEach((fn) => fn(p))
}

type Toggle = 'spacing' | 'reading' | 'contrast' | 'motion'
const TOGGLES: [Toggle, string, string][] = [
  ['spacing', 'Espaciado amplio', 'Más espacio entre líneas y letras.'],
  ['reading', 'Modo lectura', 'Quita fondos, brillos y el 3D. Deja solo el texto.'],
  ['contrast', 'Contraste alto', 'Textos más marcados y líneas más visibles.'],
  ['motion', 'Reducir movimiento', 'Detiene las animaciones y el fondo en movimiento.'],
]

const PANEL = `
  <div class="flex items-start justify-between gap-3">
    <p class="font-display text-lg font-bold">Lectura y accesibilidad</p>
    <button type="button" class="btn btn--ghost btn--small" data-close>Cerrar</button>
  </div>
  <div class="mt-5">
    <p class="text-sm font-medium">Tamaño del texto <span id="a-fs-out" class="font-mono text-xs text-ink-dim"></span></p>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" class="btn btn--ghost btn--small" data-fs="down" aria-label="Reducir el tamaño del texto">A−</button>
      <button type="button" class="btn btn--ghost btn--small" data-fs="reset">Normal</button>
      <button type="button" class="btn btn--ghost btn--small" data-fs="up" aria-label="Aumentar el tamaño del texto">A+</button>
    </div>
  </div>
  <ul class="mt-5 space-y-4">
    ${TOGGLES.map(
      ([key, label, desc]) => `
      <li class="flex items-center justify-between gap-4">
        <span>
          <span id="a-lbl-${key}" class="block text-sm font-medium text-ink">${label}</span>
          <span class="block text-xs leading-relaxed text-ink-dim">${desc}</span>
        </span>
        <button type="button" role="switch" class="a-switch" aria-checked="false" aria-labelledby="a-lbl-${key}" data-key="${key}"></button>
      </li>`,
    ).join('')}
  </ul>
  <p class="mt-5 text-xs leading-relaxed text-ink-faint">Tus ajustes se guardan en este navegador.</p>`

export function initAccess() {
  let prefs = load()
  apply(prefs)

  const fab = document.createElement('button')
  fab.id = 'a11y-fab'
  fab.type = 'button'
  fab.className = 'a11y-fab'
  fab.setAttribute('aria-expanded', 'false')
  fab.setAttribute('aria-controls', 'a11y-panel')
  fab.title = 'Lectura y accesibilidad'
  // Símbolo universal de accesibilidad: una persona con los brazos abiertos dentro de un círculo.
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="12" cy="6.6" r="1.7" fill="currentColor"/>' +
    '<path d="M7.2 9.6h9.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M12 9.6v4.6M12 14.2l-2.7 4.2M12 14.2l2.7 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg><span class="sr-only">Lectura y accesibilidad</span>'

  const panel = document.createElement('section')
  panel.id = 'a11y-panel'
  panel.className = 'a11y-panel'
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Opciones de lectura y accesibilidad')
  panel.setAttribute('data-lenis-prevent', '') // la rueda dentro del panel la usa el panel, no la página
  panel.innerHTML = PANEL
  document.body.append(fab, panel)

  const open = (on: boolean) => {
    panel.hidden = !on
    fab.setAttribute('aria-expanded', String(on))
    if (on) panel.querySelector<HTMLButtonElement>('[data-close]')?.focus()
  }
  const close = () => {
    open(false)
    fab.focus()
  }

  const sync = (p: Prefs) => {
    panel.querySelector('#a-fs-out')!.textContent = `${p.fs}%`
    panel.querySelectorAll<HTMLButtonElement>('.a-switch').forEach((b) => {
      b.setAttribute('aria-checked', String(p[b.dataset.key as Toggle]))
    })
  }

  const change = (next: Prefs) => {
    prefs = next
    save(prefs)
    apply(prefs)
    sync(prefs)
  }

  fab.addEventListener('click', () => open(panel.hidden === true))
  panel.querySelector('[data-close]')!.addEventListener('click', close)
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) close()
  })

  panel.querySelectorAll<HTMLButtonElement>('[data-fs]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Math.max(0, SIZES.indexOf(prefs.fs))
      const kind = b.dataset.fs
      const idx = kind === 'up' ? Math.min(SIZES.length - 1, i + 1) : kind === 'down' ? Math.max(0, i - 1) : SIZES.indexOf(100)
      change({ ...prefs, fs: SIZES[idx] })
    }),
  )
  panel.querySelectorAll<HTMLButtonElement>('.a-switch').forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.key as Toggle
      change({ ...prefs, [key]: !prefs[key] })
    }),
  )

  sync(prefs)
}
