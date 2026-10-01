# AURYX — Frontend

Plataforma de sistemas fotovoltaicos: tienda, configurador "Diseñá tu sistema"
con motor de compatibilidad, y 4 calculadoras técnicas. Sin frameworks ni
build step: HTML + CSS + JavaScript plano, más Tailwind (CDN) para utilidades
de layout y Lucide (CDN) para íconos.

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
├── index.html          → shell de la página, carga todos los scripts en orden
├── css/
│   └── styles.css       → design tokens (negro/amarillo/blanco) y componentes
├── js/
│   ├── data.js           → catálogo de productos, categorías, tipos de sistema
│   ├── engine.js          → motor de compatibilidad + helpers de formato/HTML
│   ├── views.js            → funciones de renderizado de cada vista (HTML en strings)
│   └── app.js               → estado global `App` + orquestación de eventos y render
└── README.md
```

## Cómo está armado (para cuando conectemos el backend)

- **`PRODUCTS`** (en `data.js`) es el catálogo completo, hoy hardcodeado.
  Cuando exista el backend, esto se reemplaza por un `fetch('/api/products')`
  y se guarda el resultado en `App.state` de la misma forma.
- **`evaluatePanelToConverter` / `evaluateBatteryToConverter`** (en `engine.js`)
  son el motor de compatibilidad. Hoy corren en el cliente contra `PRODUCTS`;
  en la arquitectura backend definida antes, esta misma lógica se traslada
  al servicio de compatibilidad (Node/NestJS) y el cliente pasa a consumir
  un endpoint en lugar de calcular localmente — la forma de la función
  (input → `{status, messages}`) puede mantenerse igual.
- **`App.state.cart`** hoy vive solo en memoria del navegador. Es el punto
  de enganche natural para persistir el carrito en el backend (o en
  `localStorage`/`window.storage` si se agrega esa capa antes del backend).
- No hay build step ni bundler a propósito: mantiene el proyecto legible y
  fácil de tocar mientras se termina de definir el backend. Si más adelante
  se migra a Next.js (como se definió en el documento de arquitectura), la
  estructura de `data.js` (specs, categorías) y `engine.js` (reglas) se
  traslada casi sin cambios al backend/paquete `compatibility-engine`.

## Estado de esta versión (frontend, sin backend)

- El carrito no persiste entre recargas de página (no hay backend ni
  almacenamiento local todavía).
- El carrito no procesa pagos: termina en "Solicitar cotización".
- Los precios en ARS/USD son estimaciones de mercado, no un feed en tiempo real.
- El motor de compatibilidad es la versión simplificada (sin corrección
  térmica) acordada para el MVP.
