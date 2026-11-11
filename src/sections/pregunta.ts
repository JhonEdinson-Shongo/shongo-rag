import { SAMPLE_QUESTIONS } from '../lib/corpus'
import { MODEL_NAME, unit, embedRaw } from '../lib/embed'
import { on, setQuery, state } from '../lib/state'
import { $, esc, pulse, renderTokens, renderVector, vecText } from '../ui/dom'

// Sección 04: la pregunta del usuario se convierte en vector con el MISMO modelo que los fragmentos.
export function initPregunta() {
  const input = $<HTMLInputElement>('#q-input')
  $('#q-model-name').textContent = MODEL_NAME

  $('#q-chips').innerHTML = SAMPLE_QUESTIONS.map((q) => `<button type="button" class="q-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')
  $('#q-chips').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-q]')
    if (!b) return
    input.value = b.dataset.q ?? ''
    setQuery(input.value)
  })

  input.value = state.query
  input.addEventListener('input', () => setQuery(input.value))

  on(['query'], render)
  render()
}

function render() {
  const text = state.query
  renderTokens($('#q-tokens'), text)
  const vec = unit(embedRaw(text))
  renderVector($('#q-bars'), vec, { max: 1 })
  $('#q-array').textContent = vecText(vec)
  pulse($('#q-model'))
  $('#q-chips').querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.classList.toggle('is-active', b.dataset.q === text))
}
