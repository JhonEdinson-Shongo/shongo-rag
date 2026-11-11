import { gsap } from 'gsap'
import { embed } from '../lib/embed'
import { cosine } from '../lib/similarity'
import { on, queryEmbedding, retrieve, state, type Hit } from '../lib/state'
import { chunkColor } from '../lib/theme'
import { $, esc } from '../ui/dom'

// Instrucciones fijas del sistema: el "contrato" con el modelo.
const SYSTEM =
  'Eres el asistente de la Tienda Demo. Responde SOLO con la información del CONTEXTO. ' +
  'Cita la fuente con su número [n]. Si el CONTEXTO no responde la pregunta, dilo con claridad.'

let typing: gsap.core.Tween | null = null

// Sección 06: con los fragmentos que pasaron el filtro se arma el prompt, y el LLM redacta la respuesta.
export function initRespuesta() {
  // Al desplazar la caja del prompt, se actualiza el desvanecido y el aviso.
  $('#prompt-view').addEventListener('scroll', syncPromptScroll, { passive: true })
  on(['chunks', 'query', 'options'], render)
  render()
}

// Indica si la caja del prompt tiene más contenido del que se ve, y si ya llegamos al final.
function syncPromptScroll() {
  const view = $('#prompt-view')
  const wrap = $('.prompt-wrap')
  const overflow = view.scrollHeight > view.clientHeight + 2
  const atEnd = view.scrollTop + view.clientHeight >= view.scrollHeight - 4
  wrap.dataset.overflow = String(overflow)
  wrap.dataset.end = String(!overflow || atEnd)
  $('#prompt-hint').hidden = !overflow || atEnd
}

function render() {
  const selected = retrieve().filter((h) => h.selected)
  renderPrompt(selected)
  renderAnswer(selected)
}

function renderPrompt(selected: Hit[]) {
  const ctx = selected.length
    ? selected.map((h, i) => `[${i + 1}] (${h.chunk.id}) ${h.chunk.text}`).join('\n\n')
    : '(vacío: ningún fragmento superó el umbral)'
  $('#prompt-view').innerHTML =
    `<span class="p-sec p-sys">SISTEMA</span>\n${esc(SYSTEM)}\n\n` +
    `<span class="p-sec p-ctx">CONTEXTO</span>\n${esc(ctx)}\n\n` +
    `<span class="p-sec p-q">PREGUNTA</span>\n${esc(state.query)}`
  $('#prompt-count').textContent = `${selected.length} fragmento${selected.length === 1 ? '' : 's'} en el contexto`
  $('#prompt-view').scrollTop = 0
  syncPromptScroll()
}

// Respuesta ILUSTRATIVA: no llamamos a ningún LLM. Tomamos la frase de los fragmentos
// más parecida a la pregunta, y la citamos. Un modelo real redactaría la respuesta a partir del prompt.
function bestSentence(selected: Hit[]) {
  const q = queryEmbedding().vec
  let best = { text: '', score: -1, source: 0 }
  selected.forEach((h, i) => {
    for (const s of h.chunk.text.split(/(?<=[.!?])\s+/)) {
      if (s.length < 12) continue
      const score = cosine(q, embed(s))
      if (score > best.score) best = { text: s, score, source: i + 1 }
    }
  })
  return best.text ? best : null
}

function renderAnswer(selected: Hit[]) {
  const box = $('#answer-box')
  const cites = $('#citations')
  const best = bestSentence(selected)

  if (!best) {
    box.dataset.state = 'none'
    cites.innerHTML = ''
    $('#answer-status').textContent = 'Sin contexto que supere el umbral'
    typeOut($('#answer'), 'No encuentro esa información en los documentos de la tienda.')
    return
  }

  box.dataset.state = 'ok'
  cites.innerHTML = selected
    .map(
      (h, i) =>
        `<span class="cite" style="--c:${chunkColor(h.chunk.index)}">[${i + 1}] ${h.chunk.id} · coseno ${h.cos.toFixed(2)}</span>`,
    )
    .join('')
  $('#answer-status').textContent = `Respuesta basada en ${selected.length} fragmento${selected.length === 1 ? '' : 's'}`
  // Si la frase no termina en punto, el fragmento se cortó ahí: la continuación está en otro fragmento.
  const complete = /[.!?]$/.test(best.text)
  typeOut($('#answer'), `${best.text}${complete ? '' : '…'} [${best.source}]`)
}

function typeOut(el: HTMLElement, text: string) {
  typing?.kill()
  const progress = { n: 0 }
  typing = gsap.to(progress, {
    n: text.length,
    duration: Math.min(1.8, 0.012 * text.length + 0.2),
    ease: 'none',
    onUpdate: () => {
      el.textContent = text.slice(0, Math.round(progress.n))
    },
  })
}
