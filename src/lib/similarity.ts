// Funciones de proximidad: cómo medimos "qué tan cerca está" un fragmento de la pregunta.

export type Metric = 'coseno' | 'punto' | 'euclidiana'

export const METRICS: Record<Metric, { label: string; formula: string; desc: string; higherIsBetter: boolean }> = {
  coseno: {
    label: 'Coseno',
    formula: 'cos θ = (A · B) / (‖A‖ · ‖B‖)',
    desc: 'Mide el ángulo entre los dos vectores, no su tamaño. 1 = misma dirección; 0 = sin relación.',
    higherIsBetter: true,
  },
  punto: {
    label: 'Producto punto',
    formula: 'A · B = Σ aᵢ · bᵢ',
    desc: 'Multiplica dimensión por dimensión y suma. Un texto largo con muchos conceptos puede ganar solo por tamaño.',
    higherIsBetter: true,
  },
  euclidiana: {
    label: 'Distancia euclidiana',
    formula: 'd = √Σ (aᵢ − bᵢ)²',
    desc: 'Distancia en línea recta entre las puntas de los dos vectores. Menor = más cerca.',
    higherIsBetter: false,
  },
}

export const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i], 0)
export const norm = (a: number[]): number => Math.hypot(...a)

export function cosine(a: number[], b: number[]): number {
  const d = norm(a) * norm(b)
  return d === 0 ? 0 : dot(a, b) / d
}

export function euclid(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0))
}

export function metricValue(metric: Metric, a: number[], b: number[]): number {
  if (metric === 'coseno') return cosine(a, b)
  if (metric === 'punto') return dot(a, b)
  return euclid(a, b)
}

// Ordena los fragmentos según la métrica elegida. Devuelve índices y valores, del más cercano al menos cercano.
export function rank(query: number[], vectors: number[][], metric: Metric) {
  const higher = METRICS[metric].higherIsBetter
  return vectors
    .map((v, index) => ({ index, value: metricValue(metric, query, v) }))
    .sort((x, y) => (higher ? y.value - x.value : x.value - y.value))
}

// Métricas adicionales: se explican en la página de métricas. La demo del recorrido sigue usando coseno.
export const manhattan = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0)
export const chebyshev = (a: number[], b: number[]): number => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0)
export const minkowski = (a: number[], b: number[], p: number): number =>
  Math.pow(a.reduce((s, x, i) => s + Math.pow(Math.abs(x - b[i]), p), 0), 1 / p)
// Ángulo entre los vectores, en radianes: 0 = misma dirección.
export const angular = (a: number[], b: number[]): number => Math.acos(Math.max(-1, Math.min(1, cosine(a, b))))
// Solo tienen sentido con vectores de 0 y 1.
export const hamming = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + (x !== b[i] ? 1 : 0), 0)
export const jaccard = (a: number[], b: number[]): number => {
  let inter = 0
  let union = 0
  a.forEach((x, i) => {
    const on = x === 1
    const other = b[i] === 1
    if (on && other) inter++
    if (on || other) union++
  })
  return union === 0 ? NaN : inter / union
}
