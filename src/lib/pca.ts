// Proyección a 3D para dibujar el "espacio vectorial". Los vectores tienen 8 números; no podemos verlos,
// así que buscamos las 3 direcciones donde más varían los fragmentos (PCA) y dibujamos sobre ellas.
// Es una vista aproximada: la búsqueda siempre usa los 8 números completos.

export interface Projector {
  mean: number[]
  basis: number[][] // 3 vectores de longitud D
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)

// Valor y vector propio dominante por "power iteration", y luego se elimina de la matriz (deflación).
function topEigen(m: number[][], iters = 200): { value: number; vector: number[] } {
  const d = m.length
  let v = Array.from({ length: d }, (_, i) => 1 / (i + 1))
  for (let k = 0; k < iters; k++) {
    const w = m.map((row) => dot(row, v))
    const n = Math.hypot(...w) || 1
    v = w.map((x) => x / n)
  }
  const mv = m.map((row) => dot(row, v))
  return { value: dot(v, mv), vector: v }
}

export function fitProjector(vectors: number[][], components = 3): Projector {
  const n = vectors.length
  const d = vectors[0]?.length ?? 0
  const mean = Array.from({ length: d }, (_, j) => vectors.reduce((s, v) => s + v[j], 0) / Math.max(n, 1))

  // Matriz de covarianza.
  let cov = Array.from({ length: d }, () => new Array<number>(d).fill(0))
  for (const v of vectors) {
    const c = v.map((x, j) => x - mean[j])
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) cov[i][j] += (c[i] * c[j]) / Math.max(n, 1)
  }

  const basis: number[][] = []
  for (let k = 0; k < components; k++) {
    const { value, vector } = topEigen(cov)
    basis.push(value > 1e-12 ? vector : Array.from({ length: d }, (_, i) => (i === k ? 1 : 0)))
    // Deflación: quitamos esa dirección para buscar la siguiente.
    cov = cov.map((row, i) => row.map((x, j) => x - value * vector[i] * vector[j]))
  }
  return { mean, basis }
}

export function project(p: Projector, v: number[]): [number, number, number] {
  const c = v.map((x, j) => x - p.mean[j])
  const [a, b, e] = p.basis.map((bv) => dot(c, bv))
  return [a, b, e]
}
