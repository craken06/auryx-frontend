/* AURYX: página de inicio. Depende de: data/products.js, utils/format.js. */

const HOME_IMAGES = {
  hero: "https://images.unsplash.com/photo-1592833159155-c62df1b65634?w=1200&q=75&auto=format&fit=crop",
};

/* Calculadoras: las usa la página de calculadoras (subnav). */
const CALCULATOR_LINKS = [
  { id: "consumo", icon: "gauge", name: "Consumo", text: "Cuánta energía usan tus equipos por día, mes y año." },
  { id: "costo", icon: "receipt", name: "Costo de energía", text: "Cuánto representa ese consumo en tu factura." },
  { id: "ahorro", icon: "piggy-bank", name: "Ahorro", text: "Cuánto dejás de pagar con lo que genera el sistema." },
  { id: "orientacion", icon: "compass", name: "Orientación y ángulo", text: "Hacia dónde y con qué inclinación instalar los paneles." },
];

/* Qué pasa después de armar el sistema. Lo usan la home, el carrito y la página de información. */
const PROCESS_STEPS = [
  { icon: "solar-panel", title: "Armás tu sistema", text: "En el configurador o eligiendo productos sueltos. No hace falta registrarte." },
  { icon: "chat-circle-text", title: "Pedís la cotización", text: "Con un clic se arma el mensaje con tu pedido y lo enviás por WhatsApp o por el formulario." },
  { icon: "clipboard-text", title: "Revisamos tu proyecto", text: "Una persona de Auryx revisa la compatibilidad y el dimensionamiento, y te consulta lo que haga falta: consumo, ubicación, techo." },
  { icon: "receipt", title: "Recibís la cotización final", text: "Con precio, stock, envío e instalación confirmados. Recién ahí decidís si avanzás." },
];

function processStepsHTML(extraClass = "") {
  return `<ol class="process-steps${extraClass ? " " + extraClass : ""}">
    ${PROCESS_STEPS.map((s, i) => `
      <li data-reveal style="--i:${i}">
        <span class="process-num" aria-hidden="true">${i + 1}</span>
        <div>
          <h3>${icon(s.icon)}${s.title}</h3>
          <p>${s.text}</p>
        </div>
      </li>`).join("")}
  </ol>`;
}

/* ---------------------------------------------------------------------- */
/* HOME                                                                    */
/* ---------------------------------------------------------------------- */
function renderHome(state) {
  const systemLinks = SYSTEM_TYPES.map((s, i) => `
    <a href="#configurator?tipo=${s.id}" class="system-link" data-reveal style="--i:${i}">
      <span class="system-icon">${icon(s.icon)}</span>
      <span class="system-text">
        <strong>${s.name}</strong>
        <span>${s.desc}</span>
        <span class="system-tag">${s.needsBattery ? "Con batería" : "Sin batería"}</span>
      </span>
      ${icon("arrow-right", "go")}
    </a>`).join("");

  const counts = PRODUCTS.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {});
  const catTiles = Object.entries(CATEGORY_META).map(([key, meta]) => `
    <a href="#store/${key}" class="cat-tile" role="listitem">
      ${icon(meta.icon)}
      <span><strong>${meta.label}</strong><span class="small dim">${counts[key] ? `${counts[key]} ${counts[key] === 1 ? "producto" : "productos"}` : "Ver categoría"}</span></span>
    </a>`).join("");

  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow" style="--i:0">Energía solar para casas y PyMEs</p>
        <h1 id="hero-title" class="hero-title" style="--i:1">Armá tu sistema solar, <em>componente por componente.</em></h1>
        <p class="hero-sub" style="--i:2">Elegí panel, inversor y batería. Verificamos tensión, corriente y potencia de cada combinación antes de que compres.</p>
        <div class="hero-ctas" style="--i:3">
          <a href="#configurator" class="btn btn-primary btn-lg">Diseñar mi sistema ${icon("arrow-right")}</a>
          <a href="#store" class="btn btn-secondary btn-lg">Ver productos</a>
        </div>
      </div>
      <div class="hero-media">
        <img src="${HOME_IMAGES.hero}" alt="Paneles solares instalados en hileras sobre una ladera con árboles" width="1200" height="1800" fetchpriority="high" decoding="async" />
      </div>
    </div>
  </section>

  <section class="home-band" aria-labelledby="systems-title">
    <div class="wrap">
      <h2 id="systems-title" class="band-title">¿Qué sistema necesitás?</h2>
      <div class="system-links">${systemLinks}</div>
    </div>
  </section>

  <section class="home-band" aria-labelledby="catalog-title">
    <div class="wrap">
      <div class="band-head">
        <h2 id="catalog-title" class="band-title">Todo lo que lleva una instalación</h2>
        <a href="#store" class="link-arrow">Ver todos los productos ${icon("arrow-right")}</a>
      </div>
      <div class="snap-row" role="list">${catTiles}</div>
    </div>
  </section>

  <section class="home-band" aria-labelledby="process-title">
    <div class="wrap">
      <div class="band-head">
        <h2 id="process-title" class="band-title">Cómo sigue después de armarlo</h2>
        <a class="link-arrow" href="${whatsappLink("Hola, tengo una consulta sobre un sistema solar.")}" target="_blank" rel="noopener">Consultanos por WhatsApp ${icon("arrow-right")}</a>
      </div>
      <p class="band-lead">Sin pago online ni compromiso. Los precios publicados incluyen IVA.</p>
      ${processStepsHTML("process-steps-tight")}
    </div>
  </section>`;
}
