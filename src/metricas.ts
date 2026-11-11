// Fuentes (mismas que el recorrido): cada página carga sus propias.
import '@fontsource/syne/latin-700.css'
import '@fontsource/syne/latin-800.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/main.css'

import { initMode } from './ui/mode'
import { initAccess } from './ui/access'
import { $ } from './ui/dom'
import { angular, chebyshev, cosine, dot, euclid, hamming, jaccard, manhattan, minkowski, norm } from './lib/similarity'

initAccess()
initMode()

// ---------- Calculadora ----------

const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '—')

// Lee tres números; si algún campo está vacío, devuelve null.
function readVec(prefix: 'a' | 'b'): number[] | null {
  const out: number[] = []
  for (const i of [1, 2, 3]) {
    const raw = $<HTMLInputElement>(`#${prefix}${i}`).value.trim()
    if (raw === '') return null
    out.push(Number(raw))
  }
  return out.every(Number.isFinite) ? out : null
}

function calc() {
  const out = $('#calc-out')
  const a = readVec('a')
  const b = readVec('b')
  if (!a || !b) {
    out.innerHTML = '<tr><td colspan="3" class="py-3">Escribe tres números para cada vector.</td></tr>'
    return
  }
  const p = Number($<HTMLInputElement>('#calc-p').value)
  const zero = norm(a) === 0 || norm(b) === 0
  const binary = [...a, ...b].every((x) => x === 0 || x === 1)
  const ang = angular(a, b)

  const rows: [string, string, string][] = [
    ['Producto punto', fmt(dot(a, b)), 'Mayor = más parecido. Crece con el tamaño de los vectores.'],
    ['Coseno', zero ? '—' : fmt(cosine(a, b)), '1 = misma dirección. Ignora el tamaño.'],
    ['Euclidiana', fmt(euclid(a, b)), 'Menor = más cerca.'],
    ['Manhattan', fmt(manhattan(a, b)), 'Menor = más cerca.'],
    ['Chebyshev', fmt(chebyshev(a, b)), 'Menor = más cerca. Solo cuenta la diferencia más grande.'],
    [`Minkowski (p = ${p})`, fmt(minkowski(a, b, p)), 'Menor = más cerca.'],
    ['Angular', zero ? '—' : `${fmt(ang)} rad (${((ang * 180) / Math.PI).toFixed(1)}°)`, 'Menor = más cerca. 0 = misma dirección.'],
  ]
  if (binary) {
    rows.push(['Hamming', String(hamming(a, b)), 'Menor = más cerca. Cuenta los bits distintos.'])
    rows.push(['Jaccard', fmt(jaccard(a, b)), 'Mayor = más parecido. Qué parte comparten.'])
  } else {
    rows.push(['Hamming y Jaccard', '—', 'Solo se calculan con números 0 o 1.'])
  }

  out.innerHTML = rows
    .map(
      ([name, value, hint]) => `
      <tr class="border-b border-line">
        <th scope="row" class="py-3 pr-4 font-medium text-ink">${name}</th>
        <td class="py-3 pr-4 font-mono">${value}</td>
        <td class="py-3">${hint}</td>
      </tr>`,
    )
    .join('')
}

$('#calc-inputs').addEventListener('input', calc)
$('#calc-p').addEventListener('input', () => {
  $('#calc-p-out').textContent = $<HTMLInputElement>('#calc-p').value
  calc()
})
calc()

// ---------- Bolas unitarias ----------

// Puntos con |x|^p + |y|^p = 1: la forma de "distancia 1" para la métrica Lp.
function ballPath(p: number): string {
  const N = 240
  const pts: string[] = []
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p)
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(4)} ${(-y).toFixed(4)}`)
  }
  return `${pts.join(' ')} Z`
}

const ballP = $<HTMLInputElement>('#ball-p')
function drawBall() {
  const p = Number(ballP.value)
  $('#ball-main').setAttribute('d', ballPath(p))
  $('#ball-label').textContent = `p = ${p}`
}

// Referencias fijas: p = 1 (rombo, Manhattan) y p = 2 (círculo, euclidiana).
$('#ball-ref1').setAttribute('d', ballPath(1))
$('#ball-ref2').setAttribute('d', ballPath(2))
ballP.addEventListener('input', drawBall)
drawBall()
