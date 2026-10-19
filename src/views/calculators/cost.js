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

/* Nombre de la categoría por su rango de consumo (las que categorizan por bimestre, en kWh por bimestre). */
function cuadroCatLabel(ct, i) {
  const k = ct.bimonthly ? 2 : 1, unit = ct.bimonthly ? "kWh por bimestre" : "kWh/mes";
  const top = (j) => Math.floor(ct.cats[j][0] * k);
  if (i === 0) return `hasta ${top(0)} ${unit}`;
  if (ct.cats[i][0] === Infinity) return `más de ${top(i - 1)} ${unit}`;
  return `${top(i - 1) + 1} a ${top(i)} ${unit}`;
}

/* Con cuadro oficial: categoría por consumo, cargo fijo + todo el consumo al precio de esa categoría, IVA y tasas.
   Sin cuadro: estimación con las facturas del IIEP y la parte de impuestos medida en el informe. */
function costTotals(c) {
  const id = costDistId(c);
  const d = TARIFF_DISTRIBUTORS[id];
  const ct = TARIFF_CUADROS[id];
  const q = Math.max(0, Number(c.kwh) || 0);
  const national = tariffNational(q);
  let t;
  if (ct) {
    const i = ct.cats.findIndex((cat) => q <= cat[0]);
    const [, fixed, price] = ct.cats[i];
    const energy = q * price, net = fixed + energy;
    const otherRate = typeof ct.other === "number" ? ct.other : ct.other[costProvince(c.province).id] ?? ct.other.ba;
    const iva = net * TARIFF_IVA, other = net * otherRate;
    t = { official: true, ct, category: cuadroCatLabel(ct, i), price, fixed, energy, iva, otherTax: other, otherRate, bill: net + iva + other };
  } else {
    const bill = tariffBill(d, q);
    t = { official: false, bill, net: bill * d.net, otherCharges: bill * d.other, tax: bill * d.tax };
  }
  return { ...t, dist: d, perKwh: q > 0 ? t.bill / q : 0, yearly: t.bill * 12, vsNational: national > 0 ? (t.bill / national - 1) * 100 : 0 };
}

/* Tarjeta de resultado: con cuadro oficial muestra la categoría y cada componente; si no, el desglose estimado. */
function costResultHTML(t) {
  const pct = (r) => fmtNum(r * 100, 1);
  const rest = t.official ? [
    { label: `Categoría: ${t.category}`, value: `${fmtARS(t.price)}/kWh` },
    { label: "Cargo fijo", value: fmtARS(t.fixed) },
    { label: "Energía consumida", value: fmtARS(t.energy) },
    { label: "IVA (21 %)", value: fmtARS(t.iva) },
    { label: `Impuestos provinciales y municipales (${pct(t.otherRate)} %)`, value: fmtARS(t.otherTax) },
  ] : [
    { label: "Energía y distribución", value: fmtARS(t.net) },
    { label: "Otros cargos", value: fmtARS(t.otherCharges) },
    { label: `Impuestos (IVA, provinciales y municipales), ${fmtNum(t.dist.tax * 100)} %`, value: fmtARS(t.tax) },
  ];
  rest.push(
    { label: "Precio efectivo del kWh", value: `${fmtARS(t.perKwh)}/kWh` },
    { label: "En un año", value: fmtARS(t.yearly) },
    { label: "Contra el promedio del país", value: costPct(t.vsNational) },
  );
  return resultCardHTML({
    id: "cost-result",
    title: t.official ? "Tu factura, con el cuadro tarifario oficial" : "Tu factura estimada",
    main: { id: "cost-total", label: "Por mes, con impuestos", value: fmtARS(t.bill) },
    rest: rest.map((r, i) => ({ ...r, id: `cost-row-${i}` })),
  });
}

function costFootnote(t) {
  return t.official
    ? `Usuario residencial sin subsidio. Tarifa: ${t.ct.source}. Impuestos provinciales y municipales calibrados con la factura que publica el Observatorio de Tarifas IIEP-UBA; las tasas municipales cambian según tu localidad.`
    : `Usuario residencial sin subsidio. Estimación con las facturas que publica el Observatorio de Tarifas IIEP-UBA (${TARIFF_DATE}); todavía no cargamos el cuadro tarifario oficial de esta distribuidora. Tu factura puede variar según la categoría, las tasas de tu municipio y los subsidios.`;
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
  const distHint = TARIFF_CUADROS[costDistId(c)] ? `Cuadro tarifario oficial de ${TARIFF_CUADROS[costDistId(c)].date}.` : "Estimada con datos del IIEP-UBA.";
  const inputs = `
    ${explainerHTML(`La factura no es solo <strong class="mono">consumo × precio del kWh</strong>: suma cargos fijos, el costo de distribución de cada empresa e impuestos (IVA, provinciales y municipales). Por eso el mismo consumo cuesta muy distinto según dónde vivas.`)}
    ${fieldHTML({ id: "cost-kwh", label: "Consumo mensual", unit: "kWh/mes", value: c.kwh, bind: "cost", field: "kwh", hint: "Figura en tu factura. Si es bimestral, dividilo por 2." })}
    ${costSelectHTML({ id: "cost-province", label: "Provincia", field: "province", value: prov.id, options: TARIFF_PROVINCES })}
    ${costSelectHTML({ id: "cost-dist", label: "Distribuidora", field: "dist", value: costDistId(c), options: dists,
      disabled: dists.length === 1, hint: dists.length === 1 ? `La principal de la provincia. ${distHint}` : distHint })}`;
  return calcSectionHTML("costo", "Costo de energía", "Cuánto pagás de luz por mes según tu consumo y tu distribuidora.", inputs,
    costResultHTML(t), `<span id="cost-footnote">${costFootnote(t)}</span>`);
}
