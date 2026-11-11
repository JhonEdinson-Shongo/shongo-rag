import { fnv1a } from './text'

// SHA-256 real del texto (Web Crypto). Es la "huella" que se guarda en la base de datos:
// si el texto cambia aunque sea una coma, la huella cambia.
export async function sha256(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    // Sin contexto seguro (por ejemplo, abrir el HTML desde el disco): usamos FNV-1a para no romper la demo.
    return fnv1a(text).toString(16).padStart(8, '0') + '…fnv'
  }
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
