/* AURYX: página de inicio. Depende de: data/products.js, lib/compatibilityEngine.js, utils/format.js. */

const HOME_IMAGES = {
  hero: "https://images.unsplash.com/photo-1592833159155-c62df1b65634?w=1200&q=75&auto=format&fit=crop",
  install: "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=900&q=70&auto=format&fit=crop",
  roof: "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=1200&q=70&auto=format&fit=crop",
};

const CALCULATOR_LINKS = [
  { id: "consumo", icon: "gauge", name: "Consumo", text: "Cuánta energía usan tus equipos por día, mes y año." },
  { id: "costo", icon: "receipt", name: "Costo de energía", text: "Cuánto representa ese consumo en tu factura." },
  { id: "ahorro", icon: "piggy-bank", name: "Ahorro", text: "Cuánto dejás de pagar con lo que genera el sistema." },
  { id: "orientacion", icon: "compass", name: "Orientación y ángulo", text: "Hacia dónde y con qué inclinación instalar los paneles." },
];

/* ---------------------------------------------------------------------- */
/* Demo de compatibilidad: usa el motor real contra el catálogo de demo.   */
/* Se re-renderiza sola (App.renderHomeDemo) sin tocar el resto de la home. */
/* ---------------------------------------------------------------------- */
function homeDemoProducts() {
  return {
    panels: DEMO_PRODUCTS.filter((p) => p.category === "panel"),
    converter: DEMO_PRODUCTS.find((p) => p.id === "inv-growatt-5k"),
  };
}

function renderHomeDemo(demo) {
  const { panels, converter } = homeDemoProducts();
  const panel = panels.find((p) => p.id === demo.panelId) || panels[0];
  if (!panel || !converter) return "";
  const ev = evaluatePanelToConverter(panel, demo.qty, "series", converter, 24);
  const t = ev.totals;
  const readouts = [
    { label: "Tensión del string (Voc)", value: `${fmtNum(t.totalVoc, 1)} V`, limit: `máx. ${fmtNum(converter.specs.maxPvVoltage)} V`, bad: t.totalVoc > converter.specs.maxPvVoltage },
    { label: "Corriente (Isc)", value: `${fmtNum(t.totalIsc, 1)} A`, limit: `máx. ${fmtNum(converter.specs.maxInputCurrentPerMppt, 1)} A por MPPT`, bad: t.totalIsc > converter.specs.maxInputCurrentPerMppt },
    { label: "Potencia FV", value: `${fmtNum(t.totalPower)} W`, limit: `máx. ${fmtNum(converter.specs.maxPvPower)} W`, bad: t.totalPower > converter.specs.maxPvPower },
  ];

  return `
    <div class="demo-controls">
      <label class="field">
        <span class="field-label">Panel</span>
        <select class="select" data-bind="demo-panel" name="demo-panel">
          ${panels.map((p) => `<option value="${esc(p.id)}" ${p.id === panel.id ? "selected" : ""}>${esc(p.brand)} ${esc(p.name)}</option>`).join("")}
        </select>
      </label>
      <div class="field">
        <span class="field-label" id="demo-qty-label">Paneles en serie</span>
        <div class="stepper" role="group" aria-labelledby="demo-qty-label">
          <button type="button" class="icon-btn" data-action="demo-step" data-delta="-1" data-fid="demo-minus" aria-label="Quitar un panel" ${demo.qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
          <span class="stepper-value" aria-live="polite">${demo.qty}</span>
          <button type="button" class="icon-btn" data-action="demo-step" data-delta="1" data-fid="demo-plus" aria-label="Agregar un panel" ${demo.qty >= 14 ? "disabled" : ""}>${icon("plus")}</button>
        </div>
      </div>
    </div>
    <p class="small dim">Inversor: <span class="muted">${esc(converter.brand)} ${esc(converter.name)}</span></p>
    <dl class="demo-readouts">
      ${readouts.map((r) => `
        <div class="readout${r.bad ? " is-bad" : ""}">
          <dt>${r.label}</dt>
          <dd>${r.value}<span class="limit">${r.limit}</span></dd>
        </div>`).join("")}
    </dl>
    <div class="demo-verdict" aria-live="polite">
      <div>${statusBadgeHTML(ev.status)}</div>
      <ul>${ev.messages.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    </div>`;
}

/* Qué pasa después de armar el sistema. Lo usan la home, el carrito y la página de información. */
const PROCESS_STEPS = [
  { icon: "solar-panel", title: "Armás tu sistema", text: "En el configurador o eligiendo productos sueltos. No hace falta registrarte." },
  { icon: "chat-circle-text", title: "Pedís la cotización", text: "Con un clic se arma el mensaje con tu pedido y lo enviás por WhatsApp o por el formulario." },
  { icon: "clipboard-text", title: "Revisamos tu proyecto", text: "Una persona de Auryx revisa la compatibilidad y el dimensionamiento, y te consulta lo que haga falta: consumo, ubicación, techo." },
  { icon: "receipt", title: "Recibís la cotización final", text: "Con precio, stock, envío e instalación confirmados. Recién ahí decidís si avanzás." },
];

function processStepsHTML() {
  return `<ol class="process-steps">
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
  const systemRows = SYSTEM_TYPES.map((s, i) => `
    <article class="system-row" data-reveal style="--i:${i}">
      <span class="system-icon">${icon(s.icon)}</span>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="system-meta">
        <span class="dim">${s.needsBattery ? "Con batería" : "Sin batería"}, usa ${s.sourceCategory === "regulador" ? "regulador MPPT" : "inversor"}</span>
        <a href="#configurator?tipo=${s.id}" class="link-arrow">Diseñar un sistema ${s.name.split(" ")[0]} ${icon("arrow-right")}</a>
      </div>
    </article>`).join("");

  const toolLinks = CALCULATOR_LINKS.map((c, i) => `
    <a href="#calculators/${c.id}" class="tool-link" data-reveal style="--i:${i}">
      ${icon(c.icon)}
      <span><strong>${c.name}</strong><span>${c.text}</span></span>
      ${icon("arrow-right", "go")}
    </a>`).join("");

  const counts = PRODUCTS.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {});
  const catTiles = Object.entries(CATEGORY_META).map(([key, meta]) => `
    <a href="#store/${key}" class="cat-tile">
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

  <section class="systems" aria-labelledby="systems-title">
    <div class="wrap systems-grid">
      <div class="systems-intro">
        <h2 id="systems-title" class="section-title">¿Qué sistema necesitás?</h2>
        <p class="section-lead">Todo empieza por el tipo de instalación. De eso dependen el equipo que convierte la energía y si hace falta almacenamiento.</p>
      </div>
      <div>${systemRows}</div>
    </div>
  </section>

  <section class="compat" aria-labelledby="compat-title">
    <div class="wrap">
      <div class="compat-head">
        <p class="eyebrow">Motor de compatibilidad</p>
        <h2 id="compat-title" class="section-title">Cada combinación se calcula, no se supone.</h2>
      </div>
      <div class="bento">
        <div class="bento-cell bento-demo" data-reveal>
          <div>
            <h3>Probalo con un ejemplo</h3>
            <p class="muted small">Sumá paneles en serie y mirá cómo cambian los valores frente a los límites del inversor.</p>
          </div>
          <div id="home-demo">${renderHomeDemo(state.homeDemo)}</div>
        </div>
        <div class="bento-cell bento-accent" data-reveal style="--i:1">
          ${icon("lightning", "bento-icon")}
          <h3>Tensión</h3>
          <p>La suma de Voc de los paneles en serie no puede superar la tensión máxima del inversor o regulador.</p>
        </div>
        <div class="bento-cell bento-photo" data-reveal style="--i:2">
          <img src="${HOME_IMAGES.install}" alt="" width="900" height="504" loading="lazy" decoding="async" />
          <h3>Corriente</h3>
          <p>La corriente de cortocircuito de cada string tiene que entrar en lo que admite cada MPPT.</p>
        </div>
        <div class="bento-cell bento-plain" data-reveal style="--i:3">
          ${icon("battery-high", "bento-icon icon-accent")}
          <h3>Potencia y batería</h3>
          <p>Controlamos la potencia FV máxima, el sobredimensionamiento y que la batería trabaje en el rango de tensión del equipo.</p>
        </div>
      </div>
      ${techNoteHTML("tech-note-spaced")}
    </div>
  </section>

  <section class="tools" aria-labelledby="tools-title">
    <div class="wrap tools-grid">
      <div class="tools-media" data-reveal>
        <img src="${HOME_IMAGES.roof}" alt="Techo industrial cubierto de paneles solares al atardecer" width="1200" height="812" loading="lazy" decoding="async" />
      </div>
      <div>
        <h2 id="tools-title" class="section-title">Calculá antes de decidir.</h2>
        <p class="section-lead">Cuatro calculadoras de uso libre, sin registro. Cada una explica cómo llega al resultado.</p>
        <div class="tool-list">${toolLinks}</div>
      </div>
    </div>
  </section>

  <section class="catalog" aria-labelledby="catalog-title">
    <div class="wrap">
      <div class="catalog-head">
        <h2 id="catalog-title" class="section-title">Todo lo que lleva una instalación.</h2>
        <a href="#store" class="link-arrow">Ver todos los productos ${icon("arrow-right")}</a>
      </div>
      <div class="snap-row" role="list">${catTiles.replace(/<a /g, '<a role="listitem" ')}</div>
    </div>
  </section>

  <section class="process" aria-labelledby="process-title">
    <div class="wrap">
      <div class="process-head">
        <p class="eyebrow">Cómo sigue</p>
        <h2 id="process-title" class="section-title">Después de pedir la cotización.</h2>
        <p class="section-lead">No hay pago online ni compromiso: primero armás y consultás, y nosotros confirmamos que todo cierre antes de que compres. Los precios publicados incluyen IVA.</p>
      </div>
      ${processStepsHTML()}
    </div>
  </section>

  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap">
      <div class="closing-inner" data-reveal>
        <div>
          <h2 id="closing-title" class="section-title">Armá tu sistema y pedí la cotización.</h2>
          <p class="section-lead">Sin registrarte. Te contactamos para confirmar precios, stock e instalación. ¿Dudas? <a class="link-arrow" style="display:inline-flex" href="${whatsappLink("Hola, tengo una consulta sobre un sistema solar.")}" target="_blank" rel="noopener">Escribinos por WhatsApp</a></p>
        </div>
        <a href="#configurator" class="btn btn-primary btn-lg">Diseñar mi sistema ${icon("arrow-right")}</a>
      </div>
    </div>
  </section>`;
}
