/* AURYX — Calculadora de ahorro. Depende de: utils/calculatorHelpers.js. */

function renderSavingsCalculator(state) {
  const { currentKwh, solarKwh, energyPrice } = state.calc.savings;
  const saved = Math.max(0, solarKwh) * energyPrice;
  const pct = currentKwh > 0 ? Math.min(100, (solarKwh / currentKwh) * 100) : 0;
  const body = `
    ${explainerHTML(`El ahorro estimado es la <strong class="sf-mono">producción solar mensual (kWh) × precio del kWh</strong>: la energía que el sistema genera es energía que ya no se le compra a la red. El porcentaje de ahorro compara la producción solar contra el consumo total del mes.`)}
    ${fieldHTML({ id: "sav-current", label: "Consumo mensual actual", unit: "kWh", type: "number", value: currentKwh, oninput: "App.calcSavingsEdit('currentKwh', this.value)" })}
    ${fieldHTML({ id: "sav-solar", label: "Producción solar mensual estimada", unit: "kWh", type: "number", value: solarKwh, oninput: "App.calcSavingsEdit('solarKwh', this.value)" })}
    ${fieldHTML({ id: "sav-price", label: "Precio del kilovatio-hora", unit: "$/kWh", type: "number", value: energyPrice, oninput: "App.calcSavingsEdit('energyPrice', this.value)" })}
    <p class="text-xs" style="color:var(--text-dim)">Tip: si ya diseñaste un sistema en el configurador, una estimación rápida de producción mensual es Potencia total (kW) × ~4.5 horas solares pico/día × 30.</p>
    <div id="savings-result" class="mt-4 p-4 sf-card text-sm space-y-2" style="border-color:var(--line-yellow)">
      ${resultRowHTML("sav-monthly", "Ahorro mensual", `$ ${saved.toLocaleString("es-AR")}`)}
      ${resultRowHTML("sav-yearly", "Ahorro anual", `$ ${(saved * 12).toLocaleString("es-AR")}`)}
      ${resultRowHTML("sav-pct", "Porcentaje del consumo cubierto", `${pct.toFixed(0)} %`)}
    </div>`;
  return calcSectionHTML("ahorro", "3. Ahorro energético", "Cuánto dinero deja de pagarse al cubrir consumo con energía solar", body);
}

/* Geometría del dibujo lateral (perfil). Se calcula con trigonometría real
   para que el ángulo dibujado sea siempre exacto, y se reutiliza tanto para
   el render inicial como para la actualización en vivo del slider. */
