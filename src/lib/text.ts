// Normalización de texto: minúsculas y sin tildes, para que "Envío" y "envio" sean la misma palabra.
export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Parte el texto en palabras. Los signos y los espacios no cuentan como palabra.
export const tokenize = (s: string): string[] => normalize(s).match(/[a-z0-9]+/g) ?? []

// Huella FNV-1a de 32 bits. Sirve de respaldo cuando el navegador no ofrece SHA-256.
export function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
