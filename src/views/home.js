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

/* Lo que hace AURYX. El dimensionamiento va destacado: es lo que nos diferencia. El texto de "Asesoría"
   y de la instalación no promete zona ni plazos (no están definidos). */
const HOME_SERVICES = [
  { id: "sizing", icon: "lightning", title: "Dimensionamiento automatizado", featured: true,
    text: "Cargás tu consumo y tu zona. El dimensionador elige paneles, inversor y baterías, arma los strings y verifica que todo sea compatible.",
    points: ["Equipos reales con precio en pesos", "Compatibilidad eléctrica verificada", "Ahorro y retorno estimados"],
    href: "#configurator", link: "Diseñar mi sistema" },
  { id: "sale", icon: "solar-panel", title: "Venta de equipos",
    text: "Paneles, inversores, baterías, protecciones y estructuras de marcas reconocidas, con IVA incluido.",
    href: "#store", link: "Ver productos" },
  { id: "advice", icon: "chat-circle-text", title: "Asesoría gratis",
    text: `No tiene ningún costo ni te compromete a comprar: una persona de <span translate="no">AURYX</span> revisa tu consumo, tu techo y los equipos antes de que compres.`,
    wa: "Hola, quiero que me asesoren con un sistema solar.", link: "Hablar con un asesor" },
  { id: "install", icon: "wrench", title: "Instalación",
    text: "La sumás al armar tu sistema y la coordinamos nosotros, con personal matriculado.",
    href: "#info", link: "Cómo trabajamos" },
];

function homeServiceLink(s) {
  return s.wa
    ? `<a class="link-arrow" href="${whatsappLink(s.wa)}" target="_blank" rel="noopener" data-context="home-asesoria">${s.link} ${icon("arrow-right")}</a>`
    : `<a class="link-arrow" href="${s.href}">${s.link} ${icon("arrow-right")}</a>`;
}

function homeServicesHTML() {
  return `<div class="services">
    ${HOME_SERVICES.map((s, i) => `
    <article class="service${s.featured ? " service-featured" : ""} service-${s.id}" data-reveal style="--i:${i}">
      <span class="service-icon">${icon(s.icon)}</span>
      <h3>${s.title}</h3>
      <p>${s.text}</p>
      ${s.points ? `<ul class="service-points">${s.points.map((p) => `<li>${icon("check")}${p}</li>`).join("")}</ul>` : ""}
      ${s.featured ? `<a href="${s.href}" class="btn btn-primary">${s.link} ${icon("arrow-right")}</a>` : homeServiceLink(s)}
    </article>`).join("")}
  </div>`;
}

/* Qué pasa después de armar el sistema. Lo usan la home, el carrito y la página de información. */
const PROCESS_STEPS = [
  { icon: "solar-panel", title: "Armás tu sistema", text: "En el configurador o eligiendo productos sueltos. Para armarlo no hace falta registrarte; para pagar online ingresás con Google." },
  { icon: "credit-card", title: "Pagás online", text: "Con Mercado Pago, en pocos pasos y desde tu cuenta. Recibís un código para seguir el pedido." },
  { icon: "clipboard-text", title: "Revisamos tu proyecto", text: "Una persona de Auryx revisa la compatibilidad y el dimensionamiento, y te consulta lo que haga falta: consumo, ubicación, techo." },
  { icon: "receipt", title: "Coordinamos envío e instalación", text: "Te contactamos para coordinar el envío o el retiro y, si la pediste, la visita técnica de la instalación." },
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
  // Solo las categorías con productos (sin datos de ninguna, se muestran todas)
  const counts = categoryCounts();
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
        <h1 id="hero-title" class="hero-title" style="--i:1">Tu sistema solar, <em>de punta a punta.</em></h1>
        <p class="hero-sub" style="--i:2">Vendemos los equipos, dimensionamos el sistema, te asesoramos gratis y coordinamos la instalación.</p>
        <div class="hero-ctas" style="--i:3">
          <a href="#configurator" class="btn btn-primary btn-lg">Diseñar mi sistema ${icon("arrow-right")}</a>
          <a href="${whatsappLink("Hola, quiero que me asesoren con un sistema solar.")}" class="btn btn-secondary btn-lg" target="_blank" rel="noopener" data-context="home-hero">${icon("whatsapp-logo", "", "fill")} Asesoría gratis</a>
        </div>
      </div>
      <div class="hero-media">
        <img src="${HOME_IMAGES.hero}" srcset="${heroSrcset()}" sizes="(min-width: 900px) 45vw, 100vw"
          alt="Paneles solares instalados en hileras sobre una ladera con árboles" width="1200" height="1800" fetchpriority="high" decoding="async" />
      </div>
    </div>
  </section>

  <section class="home-band" aria-labelledby="services-title">
    <div class="wrap">
      <h2 id="services-title" class="band-title">Qué hacemos</h2>
      ${homeServicesHTML()}
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
        <a class="link-arrow" href="${whatsappLink("Hola, tengo una consulta sobre un sistema solar.")}" target="_blank" rel="noopener" data-context="home">Hablar con un asesor ${icon("arrow-right")}</a>
      </div>
      <p class="band-lead">Pagás online con Mercado Pago. Los precios publicados incluyen IVA.</p>
      ${processStepsHTML("process-steps-tight")}
      <p class="home-revocation small"><a href="#arrepentimiento">${icon("arrow-u-up-left")}Botón de arrepentimiento</a><span class="dim">Tenés ${REVOCATION_TERM} para arrepentirte de una compra.</span></p>
    </div>
  </section>`;
}
