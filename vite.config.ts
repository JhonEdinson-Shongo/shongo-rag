import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// URL pública del sitio, p. ej. https://usuario.github.io/shongo-rag/. El workflow de GitHub Pages la pasa como SITE_URL.
// En local queda vacía y las etiquetas que necesitan una URL absoluta se omiten (igual que en shongo-memoria).
const SITE_URL = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/?$/, '/') : ''
const TODAY = new Date().toISOString().slice(0, 10)

interface Page {
  file: string // ruta dentro del sitio ('' = inicio)
  title: string
  description: string
  imageAlt: string
  website?: boolean // solo la portada declara el sitio completo
}

const PAGES: Record<'inicio' | 'metricas', Page> = {
  inicio: {
    file: '',
    title: 'Cómo funciona un RAG, paso a paso · Shongo',
    description:
      'Explicación interactiva de RAG: ingesta, embeddings, base de datos, proximidad y respuesta con citas. Paso a paso, en el navegador.',
    imageAlt: 'Mapa del RAG: fragmentos, vectores, base de datos y respuesta con citas.',
    website: true,
  },
  metricas: {
    file: 'metricas.html',
    title: 'Métricas de distancia para RAG: coseno, euclidiana, Manhattan y más · Shongo',
    description:
      'Cómo se mide qué tan cerca está un fragmento de una pregunta en RAG: coseno, producto punto, euclidiana, Manhattan, Chebyshev, angular, Jaccard y Hamming, con ejemplos y una calculadora.',
    imageAlt: 'Formas de los puntos a distancia 1 según la métrica: rombo, círculo y cuadrado.',
  },
}

// Etiquetas SEO de una página: canónica, Open Graph, Twitter y datos estructurados (JSON-LD).
function seoTags(page: Page): string {
  const url = `${SITE_URL}${page.file}`
  const image = SITE_URL ? `${SITE_URL}og-image.png` : './og-image.png'
  const graph: Record<string, unknown>[] = []
  if (page.website) graph.push({ '@type': 'WebSite', name: 'Shongo', inLanguage: 'es', ...(SITE_URL ? { url: SITE_URL } : {}) })
  graph.push({
    '@type': 'TechArticle',
    headline: page.title,
    description: page.description,
    inLanguage: 'es',
    dateModified: TODAY,
    image,
    about: { '@type': 'Thing', name: 'Retrieval-Augmented Generation' },
    author: { '@type': 'Organization', name: 'Shongo' },
    publisher: { '@type': 'Organization', name: 'Shongo' },
    ...(SITE_URL ? { mainEntityOfPage: url } : {}),
  })
  const jsonLd = { '@context': 'https://schema.org', '@graph': graph }
  return [
    SITE_URL && `<link rel="canonical" href="${url}" />`,
    `<meta name="author" content="Shongo" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:locale" content="es_CO" />`,
    `<meta property="og:site_name" content="Shongo" />`,
    `<meta property="og:title" content="${page.title}" />`,
    `<meta property="og:description" content="${page.description}" />`,
    SITE_URL && `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${page.imageAlt}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${page.title}" />`,
    `<meta name="twitter:description" content="${page.description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ')
}

const seo: Plugin = {
  name: 'shongo-seo',
  transformIndexHtml: (html) =>
    html.replace('<!--SEO-->', seoTags(PAGES.inicio)).replace('<!--SEO-METRICAS-->', seoTags(PAGES.metricas)),
  generateBundle() {
    const robots = ['User-agent: *', 'Allow: /', SITE_URL && `Sitemap: ${SITE_URL}sitemap.xml`].filter(Boolean).join('\n')
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots}\n` })
    if (SITE_URL) {
      const urls = Object.values(PAGES)
        .map(
          (page) =>
            `  <url>\n    <loc>${SITE_URL}${page.file}</loc>\n    <lastmod>${TODAY}</lastmod>\n` +
            (page.website ? `    <image:image><image:loc>${SITE_URL}og-image.png</image:loc></image:image>\n` : '') +
            `  </url>`,
        )
        .join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
          `${urls}\n</urlset>\n`,
      })
    }
  },
}

// `base: './'` mantiene las rutas relativas: el mismo build sirve en https://<usuario>.github.io/<repo>/ y en un dominio propio.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? './' : '/',
  plugins: [tailwindcss(), seo],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        metricas: fileURLToPath(new URL('./metricas.html', import.meta.url)),
      },
    },
  },
  server: { host: true },
  preview: { host: true },
}))
