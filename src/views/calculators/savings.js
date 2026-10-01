/* AURYX: calculadora de ahorro. Depende de: utils/format.js, utils/calculatorHelpers.js. */

function savingsTotals({ currentKwh, solarKwh, energyPrice }) {
  const saved = Math.max(0, solarKwh) * energyPrice;
  const pct = currentKwh > 0 ? Math.min(100, (solarKwh / currentKwh) * 100) : 0;
  return { monthly: fmtMoney(saved), yearly: fmtMoney(saved * 12), pct: `${fmtNum(pct)} %` };
}

function renderSavingsCalculator(state) {
  const s = state.calc.savings;
  const t = savingsTotals(s);
  const inputs = `
    ${explainerHTML(`El ahorro es la <strong class="mono">producción solar mensual (kWh) × precio del kWh</strong>: cada kWh que genera el sistema es uno que no le comprás a la red. El porcentaje compara esa producción con tu consumo del mes.`)}
    ${fieldHTML({ id: "sav-current", label: "Consumo mensual actual", unit: "kWh", value: s.currentKwh, bind: "savings", field: "currentKwh" })}
    ${fieldHTML({ id: "sav-solar", label: "Producción solar mensual estimada", unit: "kWh", value: s.solarKwh, bind: "savings", field: "solarKwh", hint: "Estimación rápida: potencia del sistema (kW) × 4,5 horas solares pico × 30 días." })}
    ${fieldHTML({ id: "sav-price", label: "Precio del kWh", unit: "$/kWh", value: s.energyPrice, bind: "savings", field: "energyPrice" })}`;
  const result = resultCardHTML({
    id: "savings-result",
    main: { id: "sav-monthly", label: "Ahorro mensual", value: t.monthly },
    rest: [
      { id: "sav-yearly", label: "Ahorro anual", value: t.yearly },
      { id: "sav-pct", label: "Consumo cubierto", value: t.pct },
    ],
  });
  return calcSectionHTML("ahorro", "Ahorro energético", "Cuánto dejás de pagar al cubrir consumo con energía solar.", inputs, result);
}
