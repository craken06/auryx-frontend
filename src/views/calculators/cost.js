/* AURYX: calculadora de costo. Factura mensual de luz según consumo, provincia y distribuidora, con impuestos.
   Depende de: data/tariffs.js, utils/format.js, utils/calculatorHelpers.js. */

const costProvince = (id) => TARIFF_PROVINCES.find((p) => p.id === id) || TARIFF_PROVINCES[0];
const costDistId = (c) => { const prov = costProvince(c.province); return prov.dists.includes(c.dist) ? c.dist : prov.dists[0]; };

/* Factura total (con impuestos) de una distribuidora para un consumo: interpola entre los puntos publicados.
   Debajo de 150 kWh sigue la recta 150-265 hasta 0 kWh (el cargo fijo); arriba de 1.000, la recta 600-1.000. */
function tariffBill(dist, kwh) {
  const p = dist.pts;
  const seg = (a, b, q) => a[1] + ((q - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
  if (kwh <= p[0][0]) {
    const fixed = Math.min(p[0][1], Math.max(0, seg(p[0], p[1], 0)));
    return fixed + ((p[0][1] - fixed) * kwh) / p[0][0];
  }
  for (let i = 1; i < p.length; i++) if (kwh <= p[i][0]) return seg(p[i - 1], p[i], kwh);
  return seg(p[p.length - 2], p[p.length - 1], kwh);
}

/* Promedio país para el mismo consumo: promedio simple de las distribuidoras, como lo calcula el IIEP. */
function tariffNational(kwh) {
  const list = Object.values(TARIFF_DISTRIBUTORS);
  return list.reduce((s, d) => s + tariffBill(d, kwh), 0) / list.length;
}

function costTotals(c) {
  const d = TARIFF_DISTRIBUTORS[costDistId(c)];
  const q = Math.max(0, Number(c.kwh) || 0);
  const bill = tariffBill(d, q);
  const national = tariffNational(q);
  return {
    dist: d, bill, net: bill * d.net, other: bill * d.other, tax: bill * d.tax,
    perKwh: q > 0 ? bill / q : 0, yearly: bill * 12, vsNational: national > 0 ? (bill / national - 1) * 100 : 0,
  };
}

const costPct = (n) => (Math.round(n) === 0 ? "Igual" : `${n > 0 ? "+" : "−"}${fmtNum(Math.abs(n))} %`);

function costSelectHTML({ id, label, field, options, value, hint = "", disabled = false }) {
  return `<div class="field">
    <label class="field-label" for="${id}">${label}</label>
    <select id="${id}" class="select" name="${id}" data-bind="cost-sel" data-field="${field}"${disabled ? " disabled" : ""}${hint ? ` aria-describedby="${id}-hint"` : ""}>
      ${options.map((o) => `<option value="${esc(o.id)}"${o.id === value ? " selected" : ""}>${esc(o.name)}</option>`).join("")}
    </select>
    ${hint ? `<p id="${id}-hint" class="field-hint">${hint}</p>` : ""}
  </div>`;
}

function renderCostCalculator(state) {
  const c = state.calc.cost;
  const prov = costProvince(c.province);
  const t = costTotals(c);
  const dists = prov.dists.map((id) => ({ id, name: TARIFF_DISTRIBUTORS[id].name }));
  const inputs = `
    ${explainerHTML(`La factura no es solo <strong class="mono">consumo × precio del kWh</strong>: suma cargos fijos, el costo de distribución de cada empresa e impuestos (IVA, provinciales y municipales). Por eso el mismo consumo cuesta muy distinto según dónde vivas.`)}
    ${fieldHTML({ id: "cost-kwh", label: "Consumo mensual", unit: "kWh/mes", value: c.kwh, bind: "cost", field: "kwh", hint: "Figura en tu factura. Si es bimestral, dividilo por 2." })}
    ${costSelectHTML({ id: "cost-province", label: "Provincia", field: "province", value: prov.id, options: TARIFF_PROVINCES })}
    ${costSelectHTML({ id: "cost-dist", label: "Distribuidora", field: "dist", value: costDistId(c), options: dists,
      disabled: dists.length === 1, hint: dists.length === 1 ? "La principal de la provincia." : "" })}`;
  const result = resultCardHTML({
    id: "cost-result",
    title: "Tu factura estimada",
    main: { id: "cost-total", label: "Por mes, con impuestos", value: fmtARS(t.bill) },
    rest: [
      { id: "cost-net", label: "Energía y distribución", value: fmtARS(t.net) },
      { id: "cost-other", label: "Otros cargos", value: fmtARS(t.other) },
      { id: "cost-tax", label: `Impuestos (IVA, provinciales y municipales), ${fmtNum(t.dist.tax * 100)} %`, value: fmtARS(t.tax) },
      { id: "cost-perkwh", label: "Precio efectivo del kWh", value: `${fmtARS(t.perKwh)}/kWh` },
      { id: "cost-yearly", label: "En un año", value: fmtARS(t.yearly) },
      { id: "cost-vs", label: "Contra el promedio del país", value: costPct(t.vsNational) },
    ],
  });
  return calcSectionHTML("costo", "Costo de energía", "Cuánto pagás de luz por mes según tu consumo y tu distribuidora.", inputs, result,
    `Usuario residencial sin subsidio. Estimación con las facturas que publica el Observatorio de Tarifas IIEP-UBA (${TARIFF_DATE}). Tu factura puede variar según la categoría, las tasas de tu municipio y los subsidios.`);
}
