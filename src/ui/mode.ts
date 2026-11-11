// Modo claro / oscuro. Por defecto sigue al sistema; si el usuario elige, se recuerda en su navegador.
// (El script de index.html fija el modo antes del primer pintado para que no parpadee.)
export type Mode = 'dark' | 'light'

const KEY = 'shongo-rag-theme'
const listeners = new Set<(m: Mode) => void>()

export const currentMode = (): Mode => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

// Las partes que dibujan con código (Three.js) se vuelven a pintar al cambiar de modo.
export function onModeChange(fn: (m: Mode) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function savedMode(): Mode | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function apply(mode: Mode, remember: boolean) {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#f5f4ef' : '#07080a')
  if (remember) {
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* modo privado: la elección no se recuerda, pero el cambio funciona */
    }
  }
  const btn = document.getElementById('theme-toggle')
  if (btn) btn.querySelector('#theme-label')!.textContent = mode === 'light' ? 'Modo oscuro' : 'Modo claro'
  listeners.forEach((fn) => fn(mode))
}

export function initMode() {
  const btn = document.getElementById('theme-toggle')
  btn?.addEventListener('click', () => apply(currentMode() === 'light' ? 'dark' : 'light', true))

  // Sin elección guardada, el modo acompaña al sistema operativo.
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!savedMode()) apply(e.matches ? 'light' : 'dark', false)
  })

  // Solo sincroniza el texto del botón y el color de la barra del navegador.
  apply(currentMode(), false)
}
