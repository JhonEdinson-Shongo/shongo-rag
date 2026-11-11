// Ingesta: parte un texto largo en fragmentos (chunks) de un tamaño fijo,
// con un solapamiento entre fragmentos para no cortar una idea en dos sin que ninguno la tenga completa.

export interface Span {
  start: number // posición en el texto limpio
  end: number
  text: string
}

// Limpia el texto: un solo espacio entre palabras. Así las posiciones son predecibles.
export const cleanText = (text: string): string => text.replace(/\s+/g, ' ').trim()

export function chunkSpans(text: string, size: number, overlap: number): Span[] {
  const clean = cleanText(text)
  const spans: Span[] = []
  let start = 0

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length)

    // Cortar en un espacio para no partir palabras, si hay uno razonablemente cerca.
    if (end < clean.length) {
      const space = clean.lastIndexOf(' ', end)
      if (space > start + size * 0.5) end = space
    }

    const piece = clean.slice(start, end).trim()
    if (piece) spans.push({ start, end, text: piece })
    if (end >= clean.length) break

    // El siguiente fragmento empieza `overlap` caracteres antes del final de este.
    let next = end - overlap
    if (next <= start) next = end
    const space = clean.indexOf(' ', next)
    start = space === -1 || space > end ? next : space + 1
  }

  return spans
}

export const chunkText = (text: string, size: number, overlap: number): string[] =>
  chunkSpans(text, size, overlap).map((s) => s.text)
