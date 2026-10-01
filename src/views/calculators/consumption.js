/* AURYX: calculadora de consumo. Depende de: utils/format.js, utils/calculatorHelpers.js. */

function consumptionTotals(items) {
  const dailyWh = items.reduce((s, it) => s + it.power * it.qty * it.hours, 0);
  return {
    daily: `${fmtNum(dailyWh / 1000, 2)} kWh`,
    monthly: `${fmtNum((dailyWh * 30) / 1000, 1)} kWh`,
    yearly: `${fmtNum((dailyWh * 365) / 1000)} kWh`,
  };
}

function consumptionRowHTML(it, i) {
  const cell = (field, label, value, extra = "") => `
    <div>
      <span class="mini-label" aria-hidden="true">${label}</span>
      <input class="input num-input" type="number" inputmode="decimal" min="0" value="${esc(value)}"
        name="equipo-${i}-${field}" autocomplete="off" aria-label="${label}, equipo ${i + 1}"
        data-bind="consumption" data-i="${i}" data-field="${field}" ${extra} />
    </div>`;
  return `<div class="appliance-row">
    <div class="name-cell">
      <span class="mini-label" aria-hidden="true">Equipo</span>
      <input class="input" type="text" value="${esc(it.name)}" placeholder="Ej.: heladera…" name="equipo-${i}-nombre"
        autocomplete="off" aria-label="Nombre del equipo ${i + 1}" data-bind="consumption" data-i="${i}" data-field="name" />
    </div>
    ${cell("power", "Potencia (W)", it.power)}
    ${cell("qty", "Cantidad", it.qty, 'inputmode="numeric"')}
    ${cell("hours", "Horas por día", it.hours, 'max="24"')}
    <div class="del-cell">
      <button type="button" class="icon-btn icon-btn-danger" data-action="calc-consumption-remove" data-i="${i}"
        aria-label="Quitar ${esc(it.name || `equipo ${i + 1}`)}">${icon("trash")}</button>
    </div>
  </div>`;
}

function renderConsumptionCalculator(state) {
  const items = state.calc.consumption;
  const t = consumptionTotals(items);
  const inputs = `
    ${explainerHTML(`La energía de cada equipo es <strong class="mono">potencia (W) × cantidad × horas de uso</strong>. Se suman todos y el total en Wh se divide por 1000 para pasarlo a kWh, la unidad con la que factura la distribuidora.`)}
    <div class="appliance-head" aria-hidden="true"><span>Equipo</span><span>Potencia (W)</span><span>Cantidad</span><span>Horas por día</span><span></span></div>
    <div class="appliance-list">
      ${items.length ? items.map(consumptionRowHTML).join("") : `<p class="small dim">No hay equipos cargados. Agregá el primero para empezar.</p>`}
    </div>
    <div><button type="button" class="btn btn-secondary btn-sm" data-action="calc-consumption-add" data-fid="consumption-add">${icon("plus")} Agregar equipo</button></div>`;
  const result = resultCardHTML({
    id: "consumption-result",
    main: { id: "consumption-monthly", label: "Consumo mensual", value: t.monthly },
    rest: [
      { id: "consumption-daily", label: "Por día", value: t.daily },
      { id: "consumption-yearly", label: "Por año", value: t.yearly },
    ],
  });
  return calcSectionHTML("consumo", "Consumo energético", "Cuánta energía usan tus equipos por día, mes y año.", inputs, result);
}
