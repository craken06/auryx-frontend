/* AURYX: página de inicio. Depende de: data/products.js, utils/format.js. */

const HOME_IMAGES = {
  hero: "https://images.unsplash.com/photo-1592833159155-c62df1b65634?w=1200&q=75&auto=format&fit=crop",
};

/* Versiones más livianas de la foto del hero para celulares (la de 1200 px es el src de siempre). */
function heroSrcset() {
  return [480, 800, 1200].map((w) => `${HOME_IMAGES.hero.replace(/w=\d+/, `w=${w}`)} ${w}w`).join(", ");
}

/* Calculadoras: las usa la página de calculadoras (subnav). */
const CALCULATOR_LINKS = [
  { id: "consumo", icon: "gauge", name: "Consumo", text: "Cuánta energía usan tus equipos por día, mes y año." },
  { id: "costo", icon: "receipt", name: "Costo de energía", text: "Cuánto representa ese consumo en tu factura." },
  { id: "ahorro", icon: "piggy-bank", name: "Ahorro", text: "Cuánto dejás de pagar con lo que genera el sistema." },
  { id: "orientacion", icon: "compass", name: "Orientación y ángulo", text: "Hacia dónde y con qué inclinación instalar los paneles." },
];

/* Qué pasa después de armar el sistema. Lo usan la home, el carrito y la página de información. */
const PROCESS_STEPS = [
  { icon: "solar-panel", title: "Armás tu sistema", text: "En el configurador o eligiendo productos sueltos. Para armarlo no hace falta registrarte; para pagar online ingresás con Google." },
  { icon: "chat-circle-text", title: "Pagás o pedís la cotización", text: "Pagás online con Mercado Pago, o con un clic armás el mensaje con tu pedido y lo enviás por WhatsApp." },
  { icon: "clipboard-text", title: "Revisamos tu proyecto", text: "Una persona de Auryx revisa la compatibilidad y el dimensionamiento, y te consulta lo que haga falta: consumo, ubicación, techo." },
  { icon: "receipt", title: "Coordinamos envío e instalación", text: "Con stock, envío e instalación confirmados. Si pediste cotización, recién ahí decidís si avanzás." },
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

  // Solo las categorías con productos (si el catálogo todavía no cargó, se muestran todas)
  const counts = PRODUCTS.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {});
  const withProducts = Object.entries(CATEGORY_META).filter(([key]) => counts[key]);
  const catTiles = (withProducts.length ? withProducts : Object.entries(CATEGORY_META)).map(([key, meta]) => `
    <li><a href="#store/${key}" class="cat-tile">
      ${icon(meta.icon)}
      <span><strong>${meta.label}</strong><span class="small dim">${counts[key] ? `${counts[key]} ${counts[key] === 1 ? "producto" : "productos"}` : "Ver categoría"}</span></span>
    </a></li>`).join("");

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
        <img src="${HOME_IMAGES.hero}" srcset="${heroSrcset()}" sizes="(min-width: 900px) 45vw, 100vw"
          alt="Paneles solares instalados en hileras sobre una ladera con árboles" width="1200" height="1800" fetchpriority="high" decoding="async" />
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
      <ul class="snap-row" role="list">${catTiles}</ul>
    </div>
  </section>

  <section class="home-band" aria-labelledby="process-title">
    <div class="wrap">
      <div class="band-head">
        <h2 id="process-title" class="band-title">Cómo sigue después de armarlo</h2>
        <a class="link-arrow" href="${whatsappLink("Hola, tengo una consulta sobre un sistema solar.")}" target="_blank" rel="noopener" data-context="home">Consultanos por WhatsApp ${icon("arrow-right")}</a>
      </div>
      <p class="band-lead">Pagá online con Mercado Pago o pedí una cotización sin compromiso. Los precios publicados incluyen IVA.</p>
      ${processStepsHTML("process-steps-tight")}
      <p class="home-revocation small"><a href="#arrepentimiento">${icon("arrow-u-up-left")}Botón de arrepentimiento</a><span class="dim">Tenés ${REVOCATION_TERM} para arrepentirte de una compra.</span></p>
    </div>
  </section>`;
}
