/* AURYX: dimensionador FV+BESS de la home (automático rápido, automático personalizado y libre).
   Catálogo, especificaciones y precios de ejemplo, en USD. Depende de: utils/format.js. */

/* ---------------------------------------------------------------------- */
/* Catálogo de ejemplo y supuestos                                         */
/* ---------------------------------------------------------------------- */
const SIZER_INVERTERS = [
  { id: "i1", brand: "Growatt", name: "MIN 3000TL-X", type: "on", phase: "mono", kw: 3, pvMax: 4.5, vmin: 80, vmax: 550, mppt: 2, bat: null, usd: 650 },
  { id: "i2", brand: "Growatt", name: "MIN 5000TL-X", type: "on", phase: "mono", kw: 5, pvMax: 7.5, vmin: 80, vmax: 550, mppt: 2, bat: null, usd: 900 },
  { id: "i3", brand: "Fronius", name: "Symo 10.0-3-M", type: "on", phase: "tri", kw: 10, pvMax: 15, vmin: 200, vmax: 1000, mppt: 2, bat: null, usd: 2600 },
  { id: "i4", brand: "Deye", name: "SUN-5K-SG04LP1", type: "hib", phase: "mono", kw: 5, pvMax: 6.5, vmin: 125, vmax: 500, mppt: 2, bat: "48V", usd: 1400 },
  { id: "i5", brand: "Deye", name: "SUN-8K-SG01HP3", type: "hib", phase: "tri", kw: 8, pvMax: 10.4, vmin: 160, vmax: 1000, mppt: 2, bat: "HV", usd: 2900 },
  { id: "i6", brand: "SRNE", name: "HF4850S80 5 kW", type: "off", phase: "mono", kw: 5, pvMax: 5.5, vmin: 60, vmax: 450, mppt: 1, bat: "48V", usd: 800 },
];
const SIZER_PANELS = [
  { id: "p1", brand: "Trina", name: "Vertex S 450 W", w: 450, voc: 41.5, area: 2.0, usd: 110 },
  { id: "p2", brand: "Jinko", name: "Tiger Neo 550 W", w: 550, voc: 49.8, area: 2.6, usd: 135 },
  { id: "p3", brand: "Canadian Solar", name: "BiHiKu 600 W bifacial", w: 600, voc: 41.9, area: 2.8, usd: 160 },
];
const SIZER_BATTERIES = [
  { id: "b1", brand: "Pylontech", name: "US5000 4,8 kWh", kwh: 4.8, bus: "48V", min: 1, usd: 1300 },
  { id: "b2", brand: "Deye", name: "SE-G5.1 Pro 5,12 kWh", kwh: 5.12, bus: "48V", min: 1, usd: 1350 },
  { id: "b3", brand: "Deye", name: "BOS-G 5,12 kWh (HV)", kwh: 5.12, bus: "HV", min: 2, usd: 1700 },
];
const SIZER_STRUCTURES = [
  { id: "e1", brand: "Estructura", name: "Techo de chapa", usd: 28 },
  { id: "e2", brand: "Estructura", name: "Losa (triángulo 15°)", usd: 40 },
  { id: "e3", brand: "Estructura", name: "Suelo", usd: 55 },
];
const SIZER_LOCATIONS = [
  { value: "4.4", label: "AMBA (4,4 h de sol pico)" },
  { value: "5.0", label: "Córdoba (5,0 h)" },
  { value: "5.8", label: "Mendoza / San Juan (5,8 h)" },
  { value: "5.6", label: "Salta / Jujuy (5,6 h)" },
  { value: "4.6", label: "Neuquén (4,6 h)" },
  { value: "4.2", label: "Mar del Plata (4,2 h)" },
];
const SIZER_GOALS = [
  { id: "red", icon: "receipt", label: "Bajar la factura", hint: "On-grid, sin batería" },
  { id: "resp", icon: "plug-charging", label: "Respaldo ante cortes", hint: "Híbrido con batería" },
  { id: "aut", icon: "mountains", label: "Autonomía total", hint: "Off-grid, sin red" },
];
const SIZER_GOAL_TYPE = { red: "on", resp: "hib", aut: "off" };
const SIZER_ORIENTATIONS = [
  { value: "1", label: "Norte" },
  { value: "0.95", label: "Noreste / Noroeste" },
  { value: "0.85", label: "Este / Oeste" },
  { value: "0.7", label: "Sur (no recomendado)" },
];
const SIZER_PR = 0.8;   // rendimiento global del sistema
const SIZER_DOD = 0.9;  // profundidad de descarga de la batería

function defaultSizer() {
  return {
    tab: "auto",
    mode: "quick",
    quick: { cons: "450", hsp: "4.4", goal: "red", cover: "70", hours: "4", days: "2" },
    custom: {
      cons: "650", hsp: "4.4", goal: "resp", cover: "80", hours: "4", days: "2", phase: "mono", crit: "2.5",
      area: "40", est: "e1", ori: "1", tmin: "-5", pan: "p2", inv: "i4", bat: "b2",
    },
    free: { inv: "i4", pan: "p2", n: "8", bat: "b2", nb: "1", est: "e1" },
  };
}

/* ---------------------------------------------------------------------- */
/* Cálculo (funciones puras sobre el estado)                               */
/* ---------------------------------------------------------------------- */
const sizerNum = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const sizerById = (list, id) => list.find((x) => x.id === id) || null;
const sizerLine = (qty, item, note = "") => ({ qty, item, note });
const sizerTotal = (lines) => lines.reduce((s, l) => s + l.qty * l.item.usd, 0);

/* Inversores que sirven para el objetivo y la conexión (el off-grid no depende de la fase). */
function sizerInvertersFor(goal, phase) {
  return SIZER_INVERTERS.filter((i) => i.type === SIZER_GOAL_TYPE[goal] && (i.phase === phase || i.type === "off"));
}
const sizerBatteriesFor = (inv) => (inv && inv.bat ? SIZER_BATTERIES.filter((b) => b.bus === inv.bat) : []);

/* Deja inversor y batería del modo personalizado dentro de las opciones válidas. */
function sizerNormalizeCustom(cu) {
  const invs = sizerInvertersFor(cu.goal, cu.phase);
  if (!invs.some((i) => i.id === cu.inv)) cu.inv = invs[0] ? invs[0].id : null;
  const bats = sizerBatteriesFor(sizerById(SIZER_INVERTERS, cu.inv));
  if (!bats.some((b) => b.id === cu.bat)) cu.bat = bats[0] ? bats[0].id : null;
}

/* En modo libre, una batería que no coincide con el bus del inversor se descarta. */
function sizerNormalizeFree(fr) {
  const inv = sizerById(SIZER_INVERTERS, fr.inv);
  const bat = sizerById(SIZER_BATTERIES, fr.bat);
  if (bat && (!inv || bat.bus !== inv.bat)) fr.bat = "";
}

function sizerGoalFraction(goal, cover, backupFraction) {
  if (goal === "red") return Math.min(100, Math.max(0, cover)) / 100;
  return goal === "resp" ? backupFraction : 1.2;
}

/* 1A · Rápido: panel Jinko 550 W, techo de chapa e inversor monofásico más chico que alcance. */
function sizerQuickResult(q) {
  const cons = sizerNum(q.cons);
  const hsp = sizerNum(q.hsp);
  if (cons <= 0) return { empty: "Ingresá tu consumo mensual para ver el sistema sugerido." };
  const frac = sizerGoalFraction(q.goal, sizerNum(q.cover), 0.8);
  if (frac <= 0) return { empty: "Indicá qué porcentaje del consumo querés cubrir." };

  const pan = sizerById(SIZER_PANELS, "p2");
  const kwpReq = (cons * frac) / (30 * hsp * SIZER_PR);
  const cands = SIZER_INVERTERS.filter((i) => i.type === SIZER_GOAL_TYPE[q.goal] && i.phase === "mono");
  const inv = cands.find((i) => i.pvMax >= kwpReq) || cands[cands.length - 1];
  const n = Math.max(1, Math.min(Math.ceil((kwpReq * 1000) / pan.w), Math.floor((inv.pvMax * 1000) / pan.w)));
  const kwp = (n * pan.w) / 1000;
  const gen = kwp * hsp * 30 * SIZER_PR;

  const kwh = q.goal === "resp" ? ((cons / 30 / 24) * sizerNum(q.hours) * 1.5) / SIZER_DOD
    : q.goal === "aut" ? ((cons / 30) * sizerNum(q.days)) / SIZER_DOD : 0;
  const bats = sizerBatteriesFor(inv);
  const bat = bats[bats.length - 1] || null;
  const nb = kwh > 0 && bat ? Math.max(bat.min, Math.ceil(kwh / bat.kwh)) : 0;
  const est = SIZER_STRUCTURES[0];

  const lines = [sizerLine(n, pan), sizerLine(1, inv), ...(nb ? [sizerLine(nb, bat)] : []), sizerLine(n, est)];
  const notes = [];
  if (kwp + 0.01 < kwpReq) notes.push({ tone: "warn", text: "La potencia quedó limitada por el inversor monofásico más grande del catálogo. Para más potencia, usá el modo personalizado." });
  return {
    kwp, gen, coverage: (gen / cons) * 100, storage: nb ? nb * bat.kwh : 0, lines, total: sizerTotal(lines), notes,
    free: { inv: inv.id, pan: pan.id, n: String(n), bat: nb ? bat.id : "", nb: String(nb || 1), est: est.id },
  };
}

/* 1B · Personalizado: el usuario elige modelos; se calculan cantidades, strings e inversores. */
function sizerCustomResult(cu) {
  const cons = sizerNum(cu.cons);
  const hsp = sizerNum(cu.hsp);
  const inv = sizerById(SIZER_INVERTERS, cu.inv);
  if (!inv) return { empty: "No hay inversores de ejemplo para esa combinación. Cambiá el objetivo o la conexión." };
  if (cons <= 0) return { empty: "Ingresá tu consumo mensual para calcular las cantidades." };
  const frac = sizerGoalFraction(cu.goal, sizerNum(cu.cover), 0.85);
  if (frac <= 0) return { empty: "Indicá qué porcentaje del consumo querés cubrir." };

  const pan = sizerById(SIZER_PANELS, cu.pan);
  const bat = sizerById(SIZER_BATTERIES, cu.bat);
  const est = sizerById(SIZER_STRUCTURES, cu.est);
  const crit = sizerNum(cu.crit);
  const area = sizerNum(cu.area);
  const ori = sizerNum(cu.ori) || 1;
  const tmin = sizerNum(cu.tmin);
  const backup = cu.goal !== "red";

  const kwpReq = (cons * frac) / (30 * hsp * SIZER_PR * ori);
  const nReq = Math.ceil((kwpReq * 1000) / pan.w);
  const nArea = Math.floor(area / pan.area);

  // strings: Voc corregida por frío y ventana de tensión del MPPT
  const fVoc = 1 + 0.0029 * (25 - tmin);
  const maxPS = Math.max(1, Math.floor(inv.vmax / (pan.voc * fVoc)));
  const minPS = Math.ceil(inv.vmin / (pan.voc * 0.82));
  let nInv = Math.max(1, Math.ceil((nReq * pan.w) / 1000 / inv.pvMax));
  if (backup) nInv = Math.max(nInv, Math.ceil(crit / inv.kw));
  const perInv = Math.ceil(Math.min(nReq, nArea) / nInv);
  const strings = Math.max(1, Math.ceil(perInv / maxPS));
  const ps = Math.max(minPS, Math.ceil(perInv / strings));
  const n = nInv * strings * ps;
  const kwp = (n * pan.w) / 1000;
  const gen = kwp * hsp * 30 * SIZER_PR * ori;

  const kwh = cu.goal === "resp" ? (crit * 0.6 * sizerNum(cu.hours)) / SIZER_DOD
    : cu.goal === "aut" ? ((cons / 30) * sizerNum(cu.days)) / SIZER_DOD : 0;
  const nb = bat && kwh > 0 ? Math.max(bat.min, Math.ceil(kwh / bat.kwh)) : 0;
  const vocCold = ps * pan.voc * fVoc;

  const checks = [];
  checks.push({ tone: n <= nArea ? "ok" : "bad", text: `Superficie: ${n} paneles ocupan ${fmtNum(n * pan.area, 1)} m² de ${fmtNum(area)} m² libres.` });
  if (nReq > nArea) checks.push({ tone: "warn", text: `El techo limita: para el objetivo harían falta ${nReq} paneles.` });
  checks.push({ tone: ps <= maxPS ? "ok" : "bad", text: `String de ${ps} paneles: Voc a ${fmtNum(tmin)} °C de ${fmtNum(vocCold)} V (máx. ${inv.vmax} V).` });
  checks.push({ tone: strings <= inv.mppt * 2 ? "ok" : "bad", text: `${strings} ${strings === 1 ? "string" : "strings"} por inversor en ${inv.mppt} MPPT.` });
  checks.push({ tone: kwp / nInv <= inv.pvMax ? "ok" : "bad", text: `FV por inversor: ${fmtNum(kwp / nInv, 2)} kWp (máx. ${fmtNum(inv.pvMax, 1)} kWp).` });
  if (backup) checks.push({ tone: nInv * inv.kw >= crit ? "ok" : "bad", text: `Potencia AC de ${fmtNum(nInv * inv.kw)} kW para ${fmtNum(crit, 1)} kW de cargas críticas.` });
  if (backup) checks.push(bat ? { tone: "ok", text: `Batería de bus ${bat.bus} compatible con el ${inv.brand}.` } : { tone: "bad", text: "Falta elegir una batería." });
  if (inv.type !== "off" && cu.phase !== inv.phase) checks.push({ tone: "bad", text: "La fase del inversor no coincide con la conexión." });

  const lines = [
    sizerLine(n, pan, `${nInv * strings} ${nInv * strings === 1 ? "string" : "strings"} de ${ps}`),
    sizerLine(nInv, inv),
    ...(nb ? [sizerLine(nb, bat)] : []),
    sizerLine(n, est),
  ];
  return {
    kwp, gen, coverage: (gen / cons) * 100, storage: nb ? nb * bat.kwh : 0, ratio: kwp / (nInv * inv.kw),
    lines, total: sizerTotal(lines), checks, ok: !checks.some((c) => c.tone === "bad"),
    notes: [{ tone: "info", text: `${cu.goal === "resp" ? "Respaldo calculado con el 60 % de las cargas críticas en promedio. " : ""}Coeficiente de Voc: -0,29 %/°C.` }],
  };
}

/* 2 · Libre: el usuario elige modelo y cantidad; se valida la compatibilidad (un único string). */
function sizerFreeResult(fr) {
  const inv = sizerById(SIZER_INVERTERS, fr.inv);
  const pan = sizerById(SIZER_PANELS, fr.pan);
  const est = sizerById(SIZER_STRUCTURES, fr.est);
  const n = Math.max(0, Math.round(sizerNum(fr.n)));
  if (n <= 0) return { empty: "Indicá cuántos paneles querés instalar." };
  const bat = sizerById(SIZER_BATTERIES, fr.bat);
  const nb = bat ? Math.max(0, Math.round(sizerNum(fr.nb))) : 0;

  const kwp = (n * pan.w) / 1000;
  const vocCold = n * pan.voc * 1.12;
  const vmp = n * pan.voc * 0.82;
  const ratio = kwp / inv.kw;
  const checks = [];
  checks.push({ tone: kwp <= inv.pvMax ? "ok" : "bad", text: `Potencia FV de ${fmtNum(kwp, 2)} kWp ${kwp <= inv.pvMax ? "≤" : ">"} ${fmtNum(inv.pvMax, 1)} kWp del inversor.` });
  checks.push({ tone: vocCold <= inv.vmax ? "ok" : "bad", text: `Voc del string a -10 °C: ${fmtNum(vocCold)} V ${vocCold <= inv.vmax ? "≤" : ">"} ${inv.vmax} V.` });
  checks.push({ tone: vmp >= inv.vmin ? "ok" : "bad", text: `Tensión de trabajo del string: ${fmtNum(vmp)} V ${vmp >= inv.vmin ? "≥" : "<"} ${inv.vmin} V mínimos del MPPT.` });
  if (inv.type === "on") checks.push(bat ? { tone: "bad", text: "Un inversor on-grid no admite batería." } : { tone: "ok", text: "On-grid: no necesita batería." });
  else if (!bat || !nb) checks.push(inv.type === "off" ? { tone: "bad", text: "Un sistema off-grid necesita batería." } : { tone: "warn", text: "Híbrido sin batería: funciona, pero sin respaldo ante cortes." });
  else checks.push({ tone: bat.bus === inv.bat ? "ok" : "bad", text: `Batería de bus ${bat.bus} con inversor de bus ${inv.bat}.` });
  if (bat && nb) checks.push({ tone: nb >= bat.min ? "ok" : "bad", text: `${bat.name} pide al menos ${bat.min} ${bat.min === 1 ? "módulo" : "módulos"} (elegiste ${nb}).` });
  checks.push({ tone: ratio >= 1 && ratio <= 1.3 ? "ok" : ratio >= 0.8 && ratio <= 1.3 ? "warn" : "bad", text: `Relación DC/AC de ${fmtNum(ratio, 2)} (ideal entre 1,0 y 1,3).` });

  const lines = [sizerLine(n, pan), sizerLine(1, inv), ...(bat && nb ? [sizerLine(nb, bat)] : []), sizerLine(n, est)];
  return {
    kwp, storage: bat ? nb * bat.kwh : 0, ratio, lines, total: sizerTotal(lines), checks, ok: !checks.some((c) => c.tone === "bad"),
    notes: [{ tone: "info", text: "Supone todos los paneles en un único string, con un factor de 1,12 para la Voc en frío." }],
  };
}

/* ---------------------------------------------------------------------- */
/* Render                                                                  */
/* ---------------------------------------------------------------------- */
const sizerMoney = (usd, currency) => (currency === "USD" ? fmtUSD(usd) : fmtARS(usd * USD_ARS_RATE));
const sizerItemName = (it) => `${it.brand} ${it.name}`;

function sizerOptions(list, selected, label) {
  return list.map((x) => `<option value="${esc(x.id ?? x.value)}" ${String(x.id ?? x.value) === String(selected) ? "selected" : ""}${x.disabled ? " disabled" : ""}>${esc(label(x))}</option>`).join("");
}

function sizerSelectHTML({ scope, field, label, value, options, hint = "" }) {
  const id = `sz-${scope}-${field}`;
  return `<div class="field">
    <label class="field-label" for="${id}">${label}</label>
    <select id="${id}" class="select" name="${id}" data-bind="sizer" data-scope="${scope}" data-field="${field}"${hint ? ` aria-describedby="${id}-hint"` : ""}>${options}</select>
    ${hint ? `<p id="${id}-hint" class="field-hint">${hint}</p>` : ""}
  </div>`;
}

function sizerNumberHTML({ scope, field, label, unit, value, min, max, step, hint = "", disabled = false }) {
  const id = `sz-${scope}-${field}`;
  return `<div class="field">
    <label class="field-label" for="${id}">${label}${unit ? ` <span class="unit">(${unit})</span>` : ""}</label>
    <input id="${id}" class="input num-input" type="number" inputmode="decimal" name="${id}" autocomplete="off" value="${esc(value)}"
      ${min !== undefined ? `min="${min}"` : ""} ${max !== undefined ? `max="${max}"` : ""} ${step ? `step="${step}"` : ""}
      data-bind="sizer" data-scope="${scope}" data-field="${field}"${hint ? ` aria-describedby="${id}-hint"` : ""}${disabled ? " disabled" : ""} />
    ${hint ? `<p id="${id}-hint" class="field-hint">${hint}</p>` : ""}
  </div>`;
}

/* Grupo de botones excluyentes (aria-pressed). */
function sizerSegHTML({ label, action, scope, field, value, options, wide = false }) {
  return `<div class="field">
    <span class="field-label" id="sz-${scope}-${field}-label">${label}</span>
    <div class="sz-seg${wide ? " sz-seg-wide" : ""}" role="group" aria-labelledby="sz-${scope}-${field}-label">
      ${options.map((o) => `<button type="button" class="sz-seg-btn" data-action="${action}" data-scope="${scope}" data-field="${field}" data-value="${o.id}"
        data-fid="sz-${scope}-${field}-${o.id}" aria-pressed="${o.id === value}">
        ${o.icon ? icon(o.icon) : ""}<span><strong>${o.label}</strong>${o.hint ? `<small>${o.hint}</small>` : ""}</span>
      </button>`).join("")}
    </div>
  </div>`;
}

/* Campos que dependen del objetivo: % de cobertura, horas de respaldo o días de autonomía. */
function sizerGoalFieldHTML(scope, st) {
  if (st.goal === "red") return sizerNumberHTML({ scope, field: "cover", label: "Cobertura del consumo", unit: "%", value: st.cover, min: 10, max: 100, hint: "Qué parte de la factura querés cubrir con el sol." });
  if (st.goal === "resp") return sizerNumberHTML({ scope, field: "hours", label: "Horas de respaldo", unit: "h", value: st.hours, min: 1, hint: "Cuánto tiempo querés cubrir un corte de luz." });
  return sizerNumberHTML({ scope, field: "days", label: "Días de autonomía", unit: "días", value: st.days, min: 1, hint: "Días sin sol que tiene que aguantar la batería." });
}

function sizerQuickInputsHTML(q) {
  const s = "quick";
  return `
    <p class="muted small">Cargás lo básico y elegimos equipos, marcas y cantidades por vos.</p>
    ${sizerSegHTML({ label: "¿Qué buscás?", action: "sizer-pick", scope: s, field: "goal", value: q.goal, options: SIZER_GOALS, wide: true })}
    <div class="sz-row">
      ${sizerNumberHTML({ scope: s, field: "cons", label: "Consumo mensual", unit: "kWh/mes", value: q.cons, min: 50, hint: "Figura en tu factura de luz." })}
      ${sizerSelectHTML({ scope: s, field: "hsp", label: "Ubicación", value: q.hsp, options: sizerOptions(SIZER_LOCATIONS, q.hsp, (x) => x.label) })}
    </div>
    <div class="sz-row">${sizerGoalFieldHTML(s, q)}</div>`;
}

function sizerCustomInputsHTML(cu, currency) {
  const s = "custom";
  const invs = sizerInvertersFor(cu.goal, cu.phase);
  const inv = sizerById(SIZER_INVERTERS, cu.inv);
  const bats = sizerBatteriesFor(inv);
  const backup = cu.goal !== "red";
  const price = (x) => sizerMoney(x.usd, currency);
  return `
    <p class="muted small">Más datos del sitio. Vos elegís el modelo de cada equipo y calculamos las cantidades.</p>
    ${sizerSegHTML({ label: "¿Qué buscás?", action: "sizer-pick", scope: s, field: "goal", value: cu.goal, options: SIZER_GOALS, wide: true })}
    <fieldset class="sz-group">
      <legend>Consumo y ubicación</legend>
      <div class="sz-row">
        ${sizerNumberHTML({ scope: s, field: "cons", label: "Consumo mensual", unit: "kWh/mes", value: cu.cons, min: 50 })}
        ${sizerSelectHTML({ scope: s, field: "hsp", label: "Ubicación", value: cu.hsp, options: sizerOptions(SIZER_LOCATIONS, cu.hsp, (x) => x.label) })}
      </div>
      <div class="sz-row">
        ${sizerGoalFieldHTML(s, cu)}
        ${backup ? sizerNumberHTML({ scope: s, field: "crit", label: "Cargas críticas", unit: "kW", value: cu.crit, min: 0.5, step: 0.5, hint: "Lo que tiene que seguir andando en un corte." }) : ""}
      </div>
      ${sizerSegHTML({ label: "Conexión a la red", action: "sizer-pick", scope: s, field: "phase", value: cu.phase, options: [{ id: "mono", label: "Monofásica 220 V" }, { id: "tri", label: "Trifásica 380 V" }] })}
    </fieldset>
    <fieldset class="sz-group">
      <legend>El techo</legend>
      <div class="sz-row">
        ${sizerNumberHTML({ scope: s, field: "area", label: "Superficie libre", unit: "m²", value: cu.area, min: 5 })}
        ${sizerSelectHTML({ scope: s, field: "est", label: "Tipo de techo", value: cu.est, options: sizerOptions(SIZER_STRUCTURES, cu.est, (x) => x.name) })}
      </div>
      <div class="sz-row">
        ${sizerSelectHTML({ scope: s, field: "ori", label: "Orientación", value: cu.ori, options: sizerOptions(SIZER_ORIENTATIONS, cu.ori, (x) => x.label) })}
        ${sizerNumberHTML({ scope: s, field: "tmin", label: "Temperatura mínima", unit: "°C", value: cu.tmin, min: -30, max: 20, hint: "La más baja del año en el sitio." })}
      </div>
    </fieldset>
    <fieldset class="sz-group">
      <legend>Los equipos</legend>
      ${sizerSelectHTML({ scope: s, field: "pan", label: "Panel", value: cu.pan, options: sizerOptions(SIZER_PANELS, cu.pan, (x) => `${sizerItemName(x)} (${price(x)})`) })}
      ${invs.length
        ? sizerSelectHTML({ scope: s, field: "inv", label: "Inversor", value: cu.inv, hint: `${invs.length} ${invs.length === 1 ? "modelo compatible" : "modelos compatibles"} con el objetivo y la conexión.`,
          options: sizerOptions(invs, cu.inv, (x) => `${sizerItemName(x)}, ${x.kw} kW ${x.phase === "tri" ? "trifásico" : "monofásico"} (${price(x)})`) })
        : `<p class="field-hint">No hay inversores de ejemplo para esta combinación.</p>`}
      ${bats.length ? sizerSelectHTML({ scope: s, field: "bat", label: "Batería", value: cu.bat, hint: `Solo las de bus ${inv.bat}, como pide el inversor.`, options: sizerOptions(bats, cu.bat, (x) => `${sizerItemName(x)} (${price(x)})`) }) : ""}
    </fieldset>`;
}

function sizerFreeInputsHTML(fr, currency) {
  const s = "free";
  const inv = sizerById(SIZER_INVERTERS, fr.inv);
  const price = (x) => sizerMoney(x.usd, currency);
  const batOptions = [{ id: "", brand: "", name: "Sin batería", usd: 0 }, ...SIZER_BATTERIES.map((b) => ({ ...b, disabled: !inv || b.bus !== inv.bat }))];
  return `
    <p class="muted small">Elegís modelo y cantidad de cada componente; verificamos la compatibilidad eléctrica.</p>
    ${sizerSelectHTML({ scope: s, field: "inv", label: "Inversor", value: fr.inv, options: sizerOptions(SIZER_INVERTERS, fr.inv, (x) => `${sizerItemName(x)} (${price(x)})`) })}
    <div class="sz-row sz-row-qty">
      ${sizerSelectHTML({ scope: s, field: "pan", label: "Panel", value: fr.pan, options: sizerOptions(SIZER_PANELS, fr.pan, (x) => `${sizerItemName(x)} (${price(x)})`) })}
      ${sizerNumberHTML({ scope: s, field: "n", label: "Cantidad", value: fr.n, min: 1 })}
    </div>
    <div class="sz-row sz-row-qty">
      ${sizerSelectHTML({ scope: s, field: "bat", label: "Batería", value: fr.bat, hint: "Las que no coinciden con el bus del inversor aparecen deshabilitadas.",
        options: sizerOptions(batOptions, fr.bat, (x) => (x.id ? `${sizerItemName(x)} (${price(x)})` : x.name)) })}
      ${sizerNumberHTML({ scope: s, field: "nb", label: "Cantidad", value: fr.nb, min: 0, disabled: !fr.bat })}
    </div>
    ${sizerSelectHTML({ scope: s, field: "est", label: "Estructura", value: fr.est, options: sizerOptions(SIZER_STRUCTURES, fr.est, (x) => `${x.name} (${price(x)} por panel)`) })}`;
}

const SIZER_TONE_ICON = { ok: "check-circle", warn: "warning-circle", bad: "x-circle", info: "info" };

function sizerChecksHTML(checks) {
  return `<ul class="sz-checks">${checks.map((c) => `
    <li class="is-${c.tone}">${icon(SIZER_TONE_ICON[c.tone], "", "fill")}<span><span class="visually-hidden">${c.tone === "ok" ? "Correcto: " : c.tone === "warn" ? "Atención: " : "Error: "}</span>${c.text}</span></li>`).join("")}
  </ul>`;
}

function sizerNotesHTML(notes) {
  return notes.map((n) => `<p class="sz-note is-${n.tone}">${icon(SIZER_TONE_ICON[n.tone] || "info")}<span>${n.text}</span></p>`).join("");
}

function sizerBomHTML(lines, total, currency) {
  return `<div class="sz-bom">
    <h4>Lista de materiales</h4>
    <ul>${lines.map((l) => `
      <li>
        <span class="sz-qty">${l.qty}×</span>
        <span class="sz-item"><strong translate="no">${esc(l.item.name)}</strong><small><span translate="no">${esc(l.item.brand)}</span>${l.note ? `, ${esc(l.note)}` : ""}</small></span>
        <span class="sz-price">${sizerMoney(l.qty * l.item.usd, currency)}</span>
      </li>`).join("")}
    </ul>
    <div class="sz-total"><span>Total de referencia</span><strong>${sizerMoney(total, currency)}</strong></div>
  </div>`;
}

/* Mensaje de WhatsApp con el sistema armado, para pedir la cotización real. */
function sizerQuoteMessage(label, r, currency) {
  const list = r.lines.map((l) => `- ${l.qty} x ${sizerItemName(l.item)}${l.note ? ` (${l.note})` : ""}`).join("\n");
  return `Hola, armé un sistema con el dimensionador de Auryx (${label}):\n${list}\nPotencia FV: ${fmtNum(r.kwp, 2)} kWp${r.storage ? `\nAlmacenamiento: ${fmtNum(r.storage, 1)} kWh` : ""}\nTotal de referencia: ${sizerMoney(r.total, currency)}\n¿Me pasan una cotización?`;
}

const SIZER_MODE_LABEL = { quick: "automático rápido", custom: "automático personalizado", free: "dimensionamiento libre" };

function sizerOutputHTML(sz, currency) {
  const kind = sz.tab === "free" ? "free" : sz.mode;
  const r = kind === "quick" ? sizerQuickResult(sz.quick) : kind === "custom" ? sizerCustomResult(sz.custom) : sizerFreeResult(sz.free);
  if (r.empty) {
    return `<div class="sz-empty">${icon("solar-panel")}<p>${r.empty}</p></div>`;
  }
  const title = kind === "quick" ? "Sistema sugerido" : kind === "custom" ? "Resultado" : "Compatibilidad";
  const badge = kind === "quick" ? ""
    : r.ok ? `<span class="badge tone-ok">${icon("check-circle", "", "fill")}${kind === "free" ? "Compatible" : "Todo cierra"}</span>`
      : `<span class="badge tone-bad">${icon("x-circle", "", "fill")}${kind === "free" ? "Incompatible" : "Revisar"}</span>`;

  const stats = [];
  if (r.coverage !== undefined) stats.push({ label: "Cobertura del consumo", value: `${fmtNum(Math.min(999, r.coverage))} %` });
  stats.push({ label: "Almacenamiento", value: r.storage ? `${fmtNum(r.storage, 1)} kWh` : `<span class="sz-none">Sin batería</span>` });
  if (r.ratio !== undefined) stats.push({ label: "Relación DC/AC", value: fmtNum(r.ratio, 2) });

  return `
    <div class="sz-out-head">
      <h3>${title}</h3>
      ${badge}
    </div>
    <div class="sz-figure" aria-live="polite">
      <span class="sz-kwp">${fmtNum(r.kwp, 2)}<small>kWp</small></span>
      ${r.gen !== undefined ? `<span class="sz-gen">${fmtNum(r.gen)} kWh/mes generados</span>` : ""}
    </div>
    <dl class="sz-stats">${stats.map((s) => `<div><dt>${s.label}</dt><dd>${s.value}</dd></div>`).join("")}</dl>
    ${r.checks ? sizerChecksHTML(r.checks) : ""}
    ${sizerBomHTML(r.lines, r.total, currency)}
    ${r.notes && r.notes.length ? sizerNotesHTML(r.notes) : ""}
    <div class="sz-actions">
      <a class="btn btn-primary" href="${whatsappLink(sizerQuoteMessage(SIZER_MODE_LABEL[kind], r, currency))}" target="_blank" rel="noopener">${icon("whatsapp-logo")} Pedir cotización</a>
      ${kind === "quick" ? `<button type="button" class="btn btn-secondary" data-action="sizer-to-free" data-fid="sz-to-free">Ajustar a mano ${icon("arrow-right")}</button>` : ""}
    </div>`;
}

function renderSizer(sz, currency) {
  const kind = sz.tab === "free" ? "free" : sz.mode;
  const inputs = kind === "quick" ? sizerQuickInputsHTML(sz.quick)
    : kind === "custom" ? sizerCustomInputsHTML(sz.custom, currency) : sizerFreeInputsHTML(sz.free, currency);
  const tab = (id, label, ic) => `<button type="button" class="sz-tab" data-action="sizer-tab" data-tab="${id}" data-fid="sz-tab-${id}" aria-pressed="${sz.tab === id}">${icon(ic)}${label}</button>`;
  const mode = (id, label) => `<button type="button" class="sz-mode" data-action="sizer-mode" data-mode="${id}" data-fid="sz-mode-${id}" aria-pressed="${sz.mode === id}">${label}</button>`;
  return `
    <div class="sz-bar">
      <div class="sz-tabs" role="group" aria-label="Tipo de dimensionamiento">
        ${tab("auto", "Automático", "magic-wand")}
        ${tab("free", "Libre", "sliders-horizontal")}
      </div>
      ${sz.tab === "auto" ? `<div class="sz-modes" role="group" aria-label="Nivel de detalle">${mode("quick", "Rápido")}${mode("custom", "Personalizado")}</div>` : ""}
    </div>
    <div class="sz-grid">
      <form class="sz-inputs" data-form="sizer" novalidate>${inputs}</form>
      <div class="sz-out" id="sizer-out">${sizerOutputHTML(sz, currency)}</div>
    </div>`;
}
