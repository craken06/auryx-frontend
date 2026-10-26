/* AURYX: calculadora de ahorro. Usa las mismas tarifas que la de costo (provincia y distribuidora, con impuestos):
   el ahorro es la factura de hoy menos la factura con el consumo que no cubren los paneles.
   Depende de: data/tariffs.js, views/calculators/cost.js, utils/format.js, utils/calculatorHelpers.js. */

/* Solo ahorra la energía que reemplaza consumo: el excedente inyectado se paga mucho menos o nada. Con la factura
   completa entran solos el cargo fijo (se sigue pagando), el cambio de categoría y los impuestos. */
function savingsTotals(sv) {
  const consumption = Math.max(0, Number(sv.currentKwh) || 0);
  const solar = Math.max(0, Number(sv.solarKwh) || 0);
  const self = Math.min(solar, consumption);
  const before = costTotals({ kwh: consumption, province: sv.province, dist: sv.dist });
  const after = costTotals({ kwh: consumption - self, province: sv.province, dist: sv.dist });
  const saved = Math.max(0, before.bill - after.bill);
  const pct = consumption > 0 ? (self / consumption) * 100 : 0;
  return {
    before, after, saved, self,
    monthly: fmtARS(saved), yearly: fmtARS(saved * 12), pct: `${fmtNum(pct)} %`,
    billBefore: fmtARS(before.bill), billAfter: fmtARS(after.bill),
    perKwh: self > 0 ? `${fmtARS(saved / self)}/kWh` : "—",
  };
}

function savingsFootnote(t) {
  const d = t.before;
  const source = d.official
    ? `el cuadro tarifario oficial de ${d.dist.name} (${d.ct.date})`
    : `una estimación de ${d.dist.name} con datos del Observatorio de Tarifas IIEP-UBA (${TARIFF_DATE})`;
  return `Usuario residencial sin subsidio, con ${source}. El cargo fijo lo seguís pagando y, si bajás de categoría, cambia el precio del kWh: por eso cada kWh solar puede ahorrar más o menos que el precio efectivo de tu factura. El excedente que inyectás a la red no se cuenta.`;
}

function renderSavingsCalculator(state) {
  const s = state.calc.savings;
  const t = savingsTotals(s);
  const prov = costProvince(s.province);
  const dists = prov.dists.map((id) => ({ id, name: TARIFF_DISTRIBUTORS[id].name }));
  const inputs = `
    ${explainerHTML(`El ahorro es <strong class="mono">tu factura de hoy − tu factura con paneles</strong>, con la tarifa de tu distribuidora e impuestos. Cada kWh que generás y consumís es uno que no le comprás a la red; el cargo fijo se sigue pagando. Si generás más de lo que consumís, el excedente no se cuenta como ahorro.`)}
    ${fieldHTML({ id: "sav-current", label: "Consumo mensual actual", unit: "kWh", value: s.currentKwh, bind: "savings", field: "currentKwh", hint: "Figura en tu factura. Si es bimestral, dividilo por 2." })}
    ${fieldHTML({ id: "sav-solar", label: "Producción solar mensual estimada", unit: "kWh", value: s.solarKwh, bind: "savings", field: "solarKwh", hint: "Estimación rápida: potencia del sistema (kW) × 4,5 horas solares pico × 30 días." })}
    ${costSelectHTML({ id: "sav-province", label: "Provincia", field: "province", value: prov.id, options: TARIFF_PROVINCES, bind: "savings-sel" })}
    ${costSelectHTML({ id: "sav-dist", label: "Distribuidora", field: "dist", value: costDistId(s), options: dists, bind: "savings-sel",
      disabled: dists.length === 1, hint: dists.length === 1 ? "La principal de la provincia." : "" })}`;
  const result = resultCardHTML({
    id: "savings-result",
    main: { id: "sav-monthly", label: "Ahorro mensual, con impuestos", value: t.monthly },
    rest: [
      { id: "sav-yearly", label: "Ahorro anual", value: t.yearly },
      { id: "sav-before", label: "Tu factura hoy", value: t.billBefore },
      { id: "sav-after", label: "Tu factura con paneles", value: t.billAfter },
      { id: "sav-perkwh", label: "Cada kWh solar te ahorra", value: t.perKwh },
      { id: "sav-pct", label: "Consumo cubierto", value: t.pct },
    ],
  });
  return calcSectionHTML("ahorro", inputs, result, `<span id="sav-footnote">${savingsFootnote(t)}</span>`);
}
