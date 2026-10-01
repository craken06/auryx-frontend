# AURYX: Frontend

Plataforma de sistemas fotovoltaicos: tienda, configurador "Diseñá tu sistema"
con motor de compatibilidad, y 4 calculadoras técnicas. Sin frameworks ni
build step: HTML + CSS + JavaScript plano. Tipografía (Archivo + JetBrains
Mono, vía Fontsource) e íconos (Phosphor) se cargan desde jsDelivr.
## Cómo correrlo

Al usar `<script>` clásicos (no ES modules), podés simplemente **abrir
`index.html` con doble clic** y funciona.

Si preferís levantarlo con un servidor local (recomendado si más adelante
agregás `fetch` a un backend, por temas de CORS):

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Y abrís `http://localhost:8000`.

## Estructura

```
auryx/
├── index.html                 → shell, tema inicial (claro/oscuro) y orden de carga de scripts
├── css/styles.css             → sistema de diseño: tokens de color (navy + amarillo), radios, componentes
└── src/
    ├── config.js              → API_BASE_URL, USD_ARS_RATE, CONTACT_EMAIL
    ├── data/products.js       → catálogo de demo, categorías, tipos de sistema, etiquetas de specs
    ├── lib/
    │   ├── compatibilityEngine.js → reglas panel↔inversor/regulador y batería↔inversor
    │   └── api.js                 → carga y adapta productos de la API real
    ├── utils/
    │   ├── format.js              → esc(), Intl, precios, íconos, badges, miniaturas
    │   └── calculatorHelpers.js   → campos, tarjetas de resultado, geometría del ángulo
    ├── views/                     → una función render por vista (devuelve HTML)
    └── app.js                     → estado, router por hash, delegación de eventos, arranque
```

### Convenciones

- **Eventos**: nada de `onclick` inline. Los botones declaran `data-action="..."`
  y los campos `data-bind="..."`; `app.js` los resuelve con un listener por tipo.
- **Escape**: todo texto que viene de la API pasa por `esc()` antes de ir al HTML.
- **URL = estado**: filtros y orden de la tienda (`#store/panel?marca=X&orden=price-asc`),
  la calculadora activa (`#calculators/ahorro`) y el tipo preseleccionado del
  configurador (`#configurator?tipo=hybrid`) se pueden compartir como link.
- **Tema**: oscuro (marca) por defecto; respeta `prefers-color-scheme` y el
  botón del header guarda la elección en `localStorage`.

## Cómo está armado (para cuando conectemos el backend)

- **`PRODUCTS`** (en `data/products.js`) es el catálogo completo, hoy hardcodeado.
  Cuando exista el backend, esto se reemplaza por un `fetch('/api/products')`
  y se guarda el resultado en `App.state` de la misma forma.
- **`evaluatePanelToConverter` / `evaluateBatteryToConverter`** (en `lib/compatibilityEngine.js`)
  son el motor de compatibilidad. Hoy corren en el cliente contra `PRODUCTS`;
  en la arquitectura backend definida antes, esta misma lógica se traslada
  al servicio de compatibilidad (Node/NestJS) y el cliente pasa a consumir
  un endpoint en lugar de calcular localmente; la forma de la función
  (input → `{status, messages}`) puede mantenerse igual.
- **`App.state.cart`** hoy vive solo en memoria del navegador. Es el punto
  de enganche natural para persistir el carrito en el backend (o en
  `localStorage`/`window.storage` si se agrega esa capa antes del backend).
- No hay build step ni bundler a propósito: mantiene el proyecto legible y
  fácil de tocar mientras se termina de definir el backend. Si más adelante
  se migra a Next.js (como se definió en el documento de arquitectura), la
  estructura de `data/products.js` (specs, categorías) y `lib/compatibilityEngine.js` (reglas) se
  traslada casi sin cambios al backend/paquete `compatibility-engine`.

## Estado de esta versión (frontend, sin backend)

- El carrito no persiste entre recargas de página (no hay backend ni
  almacenamiento local todavía).
- El carrito no procesa pagos: termina en "Solicitar cotización".
- Los precios en ARS/USD son estimaciones de mercado, no un feed en tiempo real.
- El motor de compatibilidad es la versión simplificada (sin corrección
  térmica) acordada para el MVP.
