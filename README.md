# AURYX: Frontend

Sitio de https://auryx.com.ar: dimensionador y configurador de sistemas fotovoltaicos con verificación de
compatibilidad, calculadoras, guías, tienda (hoy oculta) con checkout por Mercado Pago, cuentas con Google y
panel de administración. Sin frameworks ni bundler: HTML + CSS + JavaScript plano con `<script defer>`
clásicos. Tipografía (Archivo + JetBrains Mono, vía Fontsource) e íconos (Phosphor) desde jsDelivr.

Publicado con GitHub Pages (dominio en Cloudflare). El backend es `craken06/compragamer-api` (NestJS +
Prisma + Neon) en Render: `API_BASE_URL` en `src/config.js`.

## Cómo correrlo

`index.html` usa rutas absolutas (`/src/…`), así que hay que servir la carpeta desde la raíz:

```bash
python -m http.server 8765
```

y abrir `http://127.0.0.1:8765`. Ojo: la API acepta solo el origen del sitio (CORS), así que localmente el
catálogo no carga. Calculadoras, guías (con los números del último build), legales e instaladores se ven
igual; tienda, ficha, carrito y dimensionador con catálogo real se prueban en el sitio publicado.

## Direcciones y páginas generadas

- La app navega sin recargar con direcciones limpias (`/calculadoras/ahorro/`, `/guias/<slug>/`,
  `/productos/<slug>/`…). `src/lib/routes.js` traduce ruta interna ↔ dirección; las vistas escriben
  `href="#ruta"` y `app.js` los reescribe. Los links viejos con `#` redirigen.
- `scripts/build-seo-pages.mjs` corre las vistas en Node (`vm`) con el catálogo de la API (solo GET) y
  genera una copia de `index.html` por dirección, con título, descripción, canonical, Open Graph, datos
  estructurados y el contenido ya dibujado; además `404.html` (la app, para `/pedido/…`), `sitemap.xml`,
  `version.json` y `src/data/catalog-summary.js`. **No editar a mano** esas carpetas ni esos archivos.
- GitHub Actions (`.github/workflows/seo-pages.yml`) lo corre en cada push a `main`, todos los días y a mano.
- Al publicar: subir el `?v=` de todos los scripts y estilos en `index.html`, correr
  `node scripts/build-seo-pages.mjs` y verificar en vivo `https://auryx.com.ar/version.json`
  (el CDN de GitHub Pages puede tardar hasta 10 minutos).

| Página | Dirección | Vista |
|---|---|---|
| Inicio | `/` | `views/home.js` |
| Diseñá tu sistema (dimensionador / paso a paso) | `/disena-tu-sistema/`, `/disena-tu-sistema/paso-a-paso/` | `views/sizer.js`, `views/configurator.js` |
| Calculadoras (índice y una página por calculadora) | `/calculadoras/`, `/calculadoras/{consumo,costo,ahorro,orientacion}/` | `views/calculators/*` |
| Guías | `/guias/`, `/guias/<slug>/` | `views/guides.js` |
| Para instaladores | `/para-instaladores/` | `views/installers.js` |
| Tienda, categorías, ficha, carrito | `/productos/`, `/categorias/<slug>/`, `/productos/<slug>/`, `/carrito/` | `views/store.js`, `views/productDetail.js`, `views/cart.js` |
| Cuenta y pedidos | `/ingresar/`, `/mi-cuenta/`, `/mis-pedidos/`, `/pedido/<código>/` | `views/account.js` |
| Información, contacto, legales, arrepentimiento (en el pie) | `/informacion/`, `/contacto/`, `/terminos/`, `/privacidad/`, `/arrepentimiento/` | `views/infoContact.js`, `views/legal.js` |
| Administración | `/admin/` | `admin/index.html` + `admin/backend.js` |

## Estructura

```
index.html                     → shell, CSP, orden de carga de scripts (con ?v= de caché)
css/styles.css                 → tokens de color (navy + amarillo, claro/oscuro), radios, componentes
admin/                         → panel de administración (llama a la API directo)
scripts/build-seo-pages.mjs    → páginas estáticas, sitemap y version.json
src/
├── config.js                  → API_BASE_URL, WhatsApp, email, Google, GA4/Clarity, datos del vendedor
├── data/
│   ├── products.js            → catálogo en memoria (PRODUCTS tienda / SIZER_PRODUCTS dimensionador), categorías, tipos de sistema
│   ├── tariffs.js             → tarifas residenciales por distribuidora (IIEP-UBA + cuadros oficiales)
│   └── catalog-summary.js     → productos por categoría al último build (lo genera el script)
├── lib/
│   ├── routes.js              → ruta interna ↔ dirección limpia (también lo usa el build)
│   ├── api.js                 → cliente de la API y adaptación de productos
│   ├── compatibilityEngine.js → motor de compatibilidad local (respaldo del de la API)
│   ├── share.js               → "Compartir mi resultado" y "Mandame este sistema por WhatsApp"
│   ├── analytics.js           → GA4 / Clarity con consentimiento, origen de la visita y "Ref:" de WhatsApp
│   ├── session.js             → sesión del cliente (Google)
│   └── theme-init.js          → tema antes de pintar
├── utils/
│   ├── format.js              → esc(), Intl, precios, íconos, whatsappLink(), nombres de producto
│   └── calculatorHelpers.js   → campos, tarjetas de resultado, sección de calculadora
├── views/                     → una función render por vista (devuelve HTML)
└── app.js                     → estado, router, delegación de eventos, catálogo, arranque
```

## Convenciones

- **Eventos**: nada de `onclick` inline. Los botones declaran `data-action="..."` y los campos
  `data-bind="..."`; `app.js` los resuelve con un listener por tipo.
- **Escape**: todo texto que viene de la API o de la dirección pasa por `esc()` antes de ir al HTML.
- **URL = estado**: filtros de la tienda (`/categorias/paneles-solares/?marca=X`), modo del dimensionador
  (`?modo=personalizado`) y los resultados compartidos de calculadoras y dimensionador
  (`/calculadoras/costo/?consumo=300&provincia=cordoba&distribuidora=epec`). Los parámetros compartidos
  se validan en `lib/share.js` (lista cerrada, rangos, ids existentes): un valor inválido se descarta.
- **Catálogo**: se pide solo en las vistas que lo usan (`CATALOG_VIEWS` y las guías con precios). Mientras
  carga, las páginas generadas dejan a la vista su contenido ya dibujado.
- **Números en textos**: los ejemplos de las calculadoras y las tablas de las guías se calculan con las
  mismas funciones del sitio (dimensionador, `tariffs.js`); no se escriben a mano.
- **Dimensionador**: el cálculo que vale es el de la API (`POST /sizer`); `views/sizer.js` es una copia
  idéntica que se muestra al instante. Los cambios de cálculo van en los dos lados.
- **WhatsApp**: `whatsappLink()` agrega `Ref: <origen>-<página>` y cada link lleva `data-context` para el
  evento `generate_lead`. Las condiciones comerciales (gremio, referidos) no se publican.
- **Tema**: oscuro (marca) por defecto; respeta `prefers-color-scheme` y el botón del header guarda la elección.

## Datos y fuentes

- Tarifas: Observatorio de Tarifas y Subsidios IIEP-UBA (`TARIFF_DATE` en `src/data/tariffs.js`) y cuadros
  tarifarios oficiales (`TARIFF_CUADROS`, con resolución y vigencia). El retorno del dimensionador usa
  `SIZER_TARIFF_LEVELS` en `src/views/sizer.js` (promedio país, con su propia fecha).
- Precios: los de la base (admin). Las guías fechan los precios con la última actualización del catálogo.
