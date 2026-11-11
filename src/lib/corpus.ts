// Documento de ejemplo: las políticas de una tienda FICTICIA. Es el "archivo" que entra al RAG.
export const DOC_TITLE = 'Políticas de la Tienda Demo.pdf'

export const DOC_TEXT = `
Políticas de la Tienda Demo. Esta guía resume cómo funciona nuestra tienda para que compres con tranquilidad.
ENVÍOS. Enviamos a todo el país por transportadora aliada. Los pedidos en Bogotá llegan en uno a dos días hábiles; a otras ciudades, en tres a cinco días hábiles. Cuando tu paquete salga de bodega recibirás el número de rastreo por correo.
PAGOS. Aceptamos tarjeta de crédito, tarjeta débito, PSE y efectivo contra entrega en Bogotá. El precio que ves en el catálogo ya incluye impuestos; el costo del envío se calcula al pagar.
DEVOLUCIONES. Tienes 30 días calendario desde la entrega para pedir un cambio o una devolución. El reembolso se hace al mismo medio de pago en un plazo de 10 días hábiles después de recibir el producto.
GARANTÍA. Todo producto tiene 12 meses de garantía por defectos de fabricación. Si el producto llega dañado, repórtalo dentro de las 48 horas siguientes a la entrega con una foto del empaque, y lo reemplazamos sin costo.
CUENTAS. Para recuperar tu contraseña usa el enlace "Olvidé mi clave" en la página de acceso y revisa tu correo.
SOPORTE. Nuestro equipo atiende por WhatsApp y chat de lunes a sábado, de 8 a.m. a 6 p.m. Respondemos en menos de dos horas hábiles.
PRODUCTOS. Cada producto muestra su talla, color y stock disponible, que se actualiza en tiempo real.
`.trim()

// Preguntas sugeridas. La última no tiene nada que ver con la tienda: el RAG debe decir que no lo encuentra.
export const SAMPLE_QUESTIONS = [
  '¿Cuánto tarda el envío a Medellín?',
  '¿Puedo devolver un producto?',
  '¿Cómo recupero mi contraseña?',
  '¿Cuál es el horario de atención?',
  '¿Qué pasa si el producto llega dañado?',
  '¿Cuál es la capital de Francia?',
]

export const DEFAULTS = {
  size: 260,
  overlap: 40,
  k: 3,
  threshold: 0.2,
}
