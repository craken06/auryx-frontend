/* AURYX: calculadora de costo. Depende de: utils/format.js, utils/calculatorHelpers.js. */

function renderCostCalculator(state) {
  const { kwh, pricePerKwh } = state.calc.cost;
  const inputs = `
    ${explainerHTML(`El costo es el <strong class="mono">consumo (kWh) × precio del kWh</strong> que cobra la distribuidora. Es la misma cuenta que aparece, con impuestos y cargos fijos, en tu factura de luz.`)}
    ${fieldHTML({ id: "cost-kwh", label: "Consumo del período", unit: "kWh", value: kwh, bind: "cost", field: "kwh" })}
    ${fieldHTML({ id: "cost-price", label: "Precio del kWh", unit: "$/kWh", value: pricePerKwh, bind: "cost", field: "pricePerKwh", hint: "Lo encontrás en tu factura como cargo variable o precio de la energía." })}`;
  const result = resultCardHTML({
    id: "cost-result",
    main: { id: "cost-total", label: "Costo estimado de la energía", value: fmtMoney(kwh * pricePerKwh) },
  });
  return calcSectionHTML("costo", "Costo de energía", "Cuánto representa en pesos un consumo determinado.", inputs, result, "No incluye impuestos ni cargos fijos de la factura.");
}
