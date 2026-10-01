/* AURYX — Calculadora de costo. Depende de: utils/calculatorHelpers.js. */

function renderCostCalculator(state) {
  const { kwh, pricePerKwh } = state.calc.cost;
  const cost = kwh * pricePerKwh;
  const body = `
    ${explainerHTML(`El costo se obtiene multiplicando el <strong class="sf-mono">consumo (kWh)</strong> por el <strong class="sf-mono">precio del kWh</strong> que cobra la distribuidora. Es la misma cuenta que aparece, en detalle y con impuestos, en cualquier factura de luz.`)}
    ${fieldHTML({ id: "cost-kwh", label: "Consumo del período", unit: "kWh", type: "number", value: kwh, oninput: "App.calcCostEdit('kwh', this.value)" })}
    ${fieldHTML({ id: "cost-price", label: "Precio del kilovatio-hora", unit: "$/kWh", type: "number", value: pricePerKwh, oninput: "App.calcCostEdit('pricePerKwh', this.value)" })}
    <div id="cost-result" class="mt-4 p-4 sf-card text-sm space-y-2" style="border-color:var(--line-yellow)">
      ${resultRowHTML("cost-total", "Costo estimado", `$ ${cost.toLocaleString("es-AR")}`)}
    </div>`;
  return calcSectionHTML("costo", "2. Costo de energía", "Cuánto representa en pesos un consumo determinado", body);
}

