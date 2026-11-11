import { normalize } from './text'

// MODELO DE EMBEDDINGS DIDÁCTICO.
// Un modelo real (text-embedding-3, Voyage, un modelo local...) aprende entre 384 y 3072 números
// leyendo millones de textos. Aquí usamos 8 "dimensiones" que son conceptos escritos a mano,
// para poder ver cada número y entender la idea sin magia:
// si un texto habla de envíos, la dimensión 0 sube; si habla de pagos, sube la 1; y así.
export const MODEL_NAME = 'shongo-didactico-8d'

export const DIMS = [
  {
    key: 'envio',
    label: 'Envíos y entrega',
    color: 'var(--color-ingesta)',
    words: ['envío', 'envíos', 'enviar', 'envía', 'enviamos', 'entrega', 'entregar', 'despacho', 'domicilio', 'paquete', 'paquetes', 'transportadora', 'llega', 'llegan', 'llegar', 'rastreo', 'recoger', 'recogida'],
  },
  {
    key: 'pago',
    label: 'Precio y pago',
    color: 'var(--color-gold)',
    words: ['pago', 'pagar', 'pagos', 'precio', 'precios', 'cuesta', 'costo', 'costos', 'tarjeta', 'factura', 'cobro', 'cobrar', 'efectivo', 'pse', 'valor', 'descuento', 'impuestos'],
  },
  {
    key: 'devolucion',
    label: 'Devoluciones y cambios',
    color: 'var(--color-coral)',
    words: ['devolución', 'devolver', 'devoluciones', 'devuelvo', 'reembolso', 'reembolsar', 'cambio', 'cambiar', 'cambios', 'retracto', 'retornar'],
  },
  {
    key: 'garantia',
    label: 'Garantía y defectos',
    color: 'var(--color-brasa)',
    words: ['garantía', 'defecto', 'defectos', 'dañado', 'dañados', 'roto', 'rota', 'falla', 'fallas', 'averiado', 'reparar', 'reparación', 'fabricación', 'fabricacion'],
  },
  {
    key: 'tiempo',
    label: 'Tiempos y horarios',
    color: 'var(--color-acid)',
    words: ['día', 'días', 'dia', 'horas', 'hora', 'horario', 'plazo', 'plazos', 'tarda', 'tardan', 'demora', 'demoran', 'semana', 'mes', 'meses', 'hábiles', 'habiles', 'calendario', 'lunes', 'sábado', 'sabado', 'tiempo', 'cuando', 'cuándo'],
  },
  {
    key: 'cuenta',
    label: 'Cuenta y acceso',
    color: 'var(--color-sky)',
    words: ['cuenta', 'contraseña', 'contrasena', 'clave', 'acceso', 'ingresar', 'ingreso', 'registro', 'usuario', 'perfil', 'correo', 'olvidé', 'olvide', 'recuperar', 'recupero', 'sesión', 'sesion'],
  },
  {
    key: 'producto',
    label: 'Producto y catálogo',
    color: 'var(--color-embed)',
    // "producto" a propósito NO está aquí: aparece en casi todo el texto y no distingue nada.
    words: ['referencia', 'referencias', 'talla', 'tallas', 'color', 'colores', 'stock', 'catálogo', 'catalogo', 'tamaño', 'tamano', 'artículo', 'articulo', 'articulos', 'bolsa', 'café', 'cafe'],
  },
  {
    key: 'soporte',
    label: 'Contacto y soporte',
    color: 'var(--color-db)',
    words: ['soporte', 'ayuda', 'asesor', 'asesora', 'teléfono', 'telefono', 'chat', 'whatsapp', 'atención', 'atencion', 'contactar', 'escribir', 'comunicarme', 'línea', 'linea'],
  },
] as const

export const DIM_COUNT = DIMS.length

// Diccionario: palabra normalizada -> índice de dimensión.
const LEX = new Map<string, number>()
DIMS.forEach((d, i) => d.words.forEach((w) => LEX.set(normalize(w), i)))

export interface TokenInfo {
  word: string
  dim: number // -1 si el modelo no conoce la palabra
}

// Paso 1 del embedding: partir el texto en tokens y mirar cuáles conoce el modelo.
export function tokenInfo(text: string): TokenInfo[] {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => ({
    word,
    dim: LEX.get(normalize(word)) ?? -1,
  }))
}

// Paso 2: cada token que el modelo conoce suma 1 en su dimensión. Es el vector "crudo":
// un texto más largo y con más conceptos tiene un vector con números más grandes.
export function embedRaw(text: string): number[] {
  const v = new Array<number>(DIM_COUNT).fill(0)
  for (const t of tokenInfo(text)) if (t.dim >= 0) v[t.dim] += 1
  return v
}

// Paso 3 (opcional, como hacen casi todos los modelos reales): normalizar a longitud 1.
// Con vectores de longitud 1, el producto punto ES el coseno. Lo vemos en la sección de proximidad.
export function unit(v: number[]): number[] {
  const n = Math.hypot(...v)
  return n === 0 ? v.slice() : v.map((x) => x / n)
}

export const embed = (text: string): number[] => unit(embedRaw(text))

export const round = (x: number, d = 2) => (Math.abs(x) < 1e-9 ? 0 : Number(x.toFixed(d)))
