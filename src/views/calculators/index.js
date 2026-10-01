/* AURYX: página de calculadoras (subnav + una sección visible a la vez). Depende de: views/calculators/*.js, views/home.js (CALCULATOR_LINKS). */

const CALCULATOR_RENDERERS = {
  consumo: renderConsumptionCalculator,
  costo: renderCostCalculator,
  ahorro: renderSavingsCalculator,
  orientacion: renderOrientationCalculator,
};

function renderCalculators(state) {
  const active = CALCULATOR_RENDERERS[state.calcSection] ? state.calcSection : CALCULATOR_LINKS[0].id;
  return `
  <div class="wrap" style="padding-top:56px">
    <div class="page-head" style="margin-bottom:28px">
      <h1 class="page-title">Calculadoras</h1>
      <p class="page-lead">De uso libre y sin registro. Cada una explica cómo llega al resultado, así también sirven para aprender.</p>
    </div>
  </div>
  <nav class="subnav" aria-label="Calculadoras">
    <div class="wrap subnav-row">
      ${CALCULATOR_LINKS.map((c) => `<a href="#calculators/${c.id}"${active === c.id ? ' aria-current="true"' : ""}>${icon(c.icon)}${c.name}</a>`).join("")}
    </div>
  </nav>
  <div class="wrap" style="padding-bottom:48px">
    ${CALCULATOR_RENDERERS[active](state)}
    ${techNoteHTML("tech-note-spaced")}
  </div>`;
}
