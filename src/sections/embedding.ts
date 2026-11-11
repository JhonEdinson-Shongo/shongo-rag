import { DIMS, MODEL_NAME, embed, embedRaw } from '../lib/embed'
import { $, pulse, renderTokens, renderVector, vecText } from '../ui/dom'

// Sección 02: el texto entra al modelo y sale un vector. Aquí puedes escribir cualquier frase.
export function initEmbedding() {
  const input = $<HTMLTextAreaElement>('#emb-input')
  $('#emb-model-name').textContent = MODEL_NAME
  const run = () => {
    const text = input.value
    renderTokens($('#emb-tokens'), text)
    const raw = embedRaw(text)
    // Conteo crudo: cuántas palabras cayeron en cada concepto.
    $('#emb-raw').innerHTML = DIMS.map((d, i) =>
      raw[i] > 0 ? `<span class="count-chip" style="--c:${d.color}">${d.key} ×${raw[i]}</span>` : '',
    )
      .filter(Boolean)
      .join('') || '<span class="text-ink-faint text-sm">Ningún concepto reconocido: el vector queda en cero.</span>'
    const vec = embed(text)
    renderVector($('#emb-bars'), vec, { max: 1 })
    $('#emb-array').textContent = vecText(vec)
    pulse($('#emb-model'))
  }
  input.addEventListener('input', run)
  run()
}
