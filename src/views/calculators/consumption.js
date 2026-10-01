/* AURYX — Calculadora de consumo. Depende de: utils/format.js, utils/calculatorHelpers.js. */

function consumptionRowHTML(it, i) {
  return `<div class="grid grid-cols-12 gap-2 items-center" data-row="${i}">
    <input value="${it.name}" oninput="App.calcConsumptionEdit(${i},'name',this.value)" class="sf-input col-span-4 text-sm" placeholder="Nombre del equipo" />
    <input type="number" value="${it.power}" oninput="App.calcConsumptionEdit(${i},'power',this.value)" class="sf-input col-span-2 text-sm" />
    <input type="number" value="${it.qty}" oninput="App.calcConsumptionEdit(${i},'qty',this.value)" class="sf-input col-span-2 text-sm" />
    <input type="number" value="${it.hours}" oninput="App.calcConsumptionEdit(${i},'hours',this.value)" class="sf-input col-span-3 text-sm" />
    <button onclick="App.calcConsumptionRemove(${i})" class="col-span-1" style="color:var(--bad)">${iconTag("trash-2", 14)}</button>
  </div>`;
}

function renderConsumptionCalculator(state) {
  const items = state.calc.consumption;
  const dailyWh = items.reduce((s, it) => s + it.power * it.qty * it.hours, 0);
  const body = `
    ${explainerHTML(`La energía consumida se calcula como <strong class="sf-mono">Potencia (W) × Cantidad × Horas de uso</strong>, sumando esto para cada equipo. El resultado en Wh se divide por 1000 para expresarlo en kWh (kilovatio-hora), la unidad que usan las empresas de electricidad para facturar.`)}
    <div class="grid grid-cols-12 gap-2 text-xs sf-mono mb-2 px-1" style="color:var(--text-dim)">
      <span class="col-span-4">Equipo</span><span class="col-span-2">Potencia (W)</span><span class="col-span-2">Cantidad</span><span class="col-span-3">Uso (hs/día)</span>
    </div>
    <div id="consumption-rows" class="space-y-3">${items.map(consumptionRowHTML).join("")}</div>
    <button onclick="App.calcConsumptionAdd()" class="sf-btn-outline text-sm px-3 py-1.5 mt-3 flex items-center gap-1.5">${iconTag("plus", 14)} Agregar equipo</button>
    <div id="consumption-result" class="mt-4 p-4 sf-card text-sm space-y-2" style="border-color:var(--line-yellow)">
      ${resultRowHTML("consumption-daily", "Consumo diario", `${(dailyWh / 1000).toFixed(2)} kWh`)}
      ${resultRowHTML("consumption-monthly", "Consumo mensual", `${((dailyWh * 30) / 1000).toFixed(1)} kWh`)}
      ${resultRowHTML("consumption-yearly", "Consumo anual", `${((dailyWh * 365) / 1000).toFixed(0)} kWh`)}
    </div>`;
  return calcSectionHTML("consumo", "1. Consumo energético", "Cuánta energía consumen tus equipos por día, mes y año", body);
}

