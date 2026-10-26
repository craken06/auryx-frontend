/* AURYX: calculadoras. /calculadoras/ es el índice; cada calculadora tiene su página (/calculadoras/<id>/) con
   subnav, la calculadora y el texto de content.js debajo.
   Depende de: views/calculators/*.js, views/home.js (CALCULATOR_LINKS). */

const CALCULATOR_RENDERERS = {
  consumo: renderConsumptionCalculator,
  costo: renderCostCalculator,
  ahorro: renderSavingsCalculator,
  orientacion: renderOrientationCalculator,
};

/* Valores con los que abre cada calculadora (también los usa el build para las páginas estáticas). */
function defaultCalcState() {
  return {
    consumption: [{ name: "Heladera", power: 150, qty: 1, hours: 8 }],
    cost: { kwh: 300, province: "ba", dist: "edenor" },
    savings: { currentKwh: 350, solarKwh: 220, province: "ba", dist: "edenor" },
    orientation: { lat: -34.6, mode: "optimal", previewAngle: 35 },
  };
}

const CALC_DISCLAIMER = `<p class="tech-note tech-note-spaced">${icon("info")}<span><strong>Resultados orientativos.</strong> Usan valores promedio y fórmulas simplificadas. Para dimensionar una instalación real, el proyecto lo tiene que revisar un profesional matriculado.</span></p>`;

function calcIndexHTML() {
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">Calculadoras solares</h1>
      <p class="page-lead">De uso libre y sin registro. Cada una explica cómo llega al resultado, así también sirven para aprender.</p>
    </div>
    <div class="system-links calc-index">
      ${CALCULATOR_LINKS.map((c) => `
      <a href="#calculators/${c.id}" class="system-link">
        <span class="system-icon">${icon(c.icon)}</span>
        <span class="system-text"><strong>${CALC_CONTENT[c.id].h1}</strong><span>${c.text}</span></span>
        ${icon("arrow-right", "go")}
      </a>`).join("")}
    </div>
    <p class="calc-index-more">¿Querés ir directo al sistema? <a href="#configurator" class="link-arrow">Diseñá tu sistema ${icon("arrow-right")}</a></p>
    ${CALC_DISCLAIMER}
  </div>`;
}

function renderCalculators(state) {
  const active = CALCULATOR_RENDERERS[state.calcSection] ? state.calcSection : null;
  if (!active) return calcIndexHTML();
  const c = CALC_CONTENT[active];
  return `
  <div class="wrap calc-page-top">
    <div class="page-head calc-page-head">
      <h1 class="page-title" id="calc-page-title">${c.h1}</h1>
      <p class="page-lead">${c.lead}</p>
    </div>
  </div>
  <nav class="subnav" aria-label="Calculadoras">
    <div class="wrap subnav-row">
      ${CALCULATOR_LINKS.map((l) => `<a href="#calculators/${l.id}"${active === l.id ? ' aria-current="page"' : ""}>${icon(l.icon)}${l.name}</a>`).join("")}
    </div>
  </nav>
  <div class="wrap calc-page-bottom">
    ${CALCULATOR_RENDERERS[active](state)}
    ${calcContentHTML(active)}
    ${CALC_DISCLAIMER}
  </div>`;
}
