// Paleta "Shongo RAG". Los valores viven en styles/main.css (uno por modo). Aquí solo se leen,
// para que el 3D y el HTML usen siempre el mismo color del modo activo.
export const ACCENTS = ['ingesta', 'embed', 'db', 'sky', 'acid', 'coral', 'brasa', 'gold'] as const
export type Accent = (typeof ACCENTS)[number]

// Color de cada fragmento (c_01, c_02…). Se usa igual en el documento, en las tarjetas, en la base y en el 3D.
const CHUNK_ACCENTS: Accent[] = ['ingesta', 'embed', 'db', 'sky', 'acid', 'coral']

// Para estilos en línea: una referencia a la variable CSS, así el color cambia con el modo.
export const chunkColor = (i: number) => `var(--color-${CHUNK_ACCENTS[i % CHUNK_ACCENTS.length]})`

// Para Three.js: el valor concreto del modo activo (hex).
export function readPalette(): Record<Accent, string> {
  const cs = getComputedStyle(document.documentElement)
  const out = {} as Record<Accent, string>
  for (const name of ACCENTS) out[name] = cs.getPropertyValue(`--color-${name}`).trim()
  return out
}
