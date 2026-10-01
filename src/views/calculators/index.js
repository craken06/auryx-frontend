/* AURYX — Contenedor de las 4 calculadoras (tabs). Depende de: views/calculators/*.js. */

function renderCalculators(state) {
  const sections = [
    { id: "consumo", label: "1. Consumo" },
    { id: "costo", label: "2. Costo" },
    { id: "ahorro", label: "3. Ahorro" },
    { id: "orientacion", label: "4. Orientación" },
  ];
  return `
  <div>
    <div class="max-w-5xl mx-auto px-5 pt-12">
      <h1 class="sf-display text-3xl font-semibold mb-2">Calculadoras</h1>
      <p class="text-sm mb-6" style="color:var(--text-mid)">De acceso libre, sin necesidad de crear una cuenta. Pensadas también para estudiantes: cada una incluye una breve explicación técnica de cómo se calcula el resultado.</p>
      <div class="flex gap-2 flex-wrap mb-4 sticky top-[73px] py-3 z-10" style="background:var(--bg)">
        ${sections.map((s) => `<a href="#${s.id}" class="sf-btn-outline px-3 py-1.5 text-sm inline-block">${s.label}</a>`).join("")}
      </div>
    </div>
    <div class="max-w-5xl mx-auto px-5">
      ${renderConsumptionCalculator(state)}
      ${renderCostCalculator(state)}
      ${renderSavingsCalculator(state)}
      ${renderOrientationCalculator(state)}
    </div>
  </div>`;
}
