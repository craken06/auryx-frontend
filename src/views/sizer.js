/* AURYX: dimensionador FV+BESS de "Diseñá tu sistema" (automático: rápido o personalizado).
   Calcula y muestra la configuración eléctrica: strings, serie/paralelo por MPPT y armado del banco de
   baterías, y verifica la compatibilidad entre cada par de componentes.
   Catálogo, especificaciones y precios de ejemplo, en USD. Depende de: utils/format.js. */

/* ---------------------------------------------------------------------- */
/* Catálogo de ejemplo                                                     */
/* ---------------------------------------------------------------------- */
/* Inversores: vmin/mpptMax = ventana MPPT, vmax = tensión DC máxima de entrada.
   mppts: por entrada, corriente máx. de operación (imax), de cortocircuito (isc) y strings que acepta.
   batV/batI: ventana de tensión y corriente máx. de descarga del puerto de batería. */
const SIZER_MPPT_GW = { imax: 13.5, isc: 16.9, strings: 1 };
const SIZER_MPPT_DEYE = { imax: 13, isc: 17, strings: 1 };
const SIZER_INVERTERS = [
  { id: "i1", brand: "Growatt", name: "MIN 3000TL-X", type: "on", phase: "mono", kw: 3, pvMax: 4.5, vmin: 80, mpptMax: 500, vmax: 550, mppts: [SIZER_MPPT_GW, SIZER_MPPT_GW], bat: null, usd: 650 },
  { id: "i2", brand: "Growatt", name: "MIN 5000TL-X", type: "on", phase: "mono", kw: 5, pvMax: 7.5, vmin: 80, mpptMax: 500, vmax: 550, mppts: [SIZER_MPPT_GW, SIZER_MPPT_GW], bat: null, usd: 900 },
  { id: "i3", brand: "Fronius", name: "Symo 10.0-3-M", type: "on", phase: "tri", kw: 10, pvMax: 15, vmin: 270, mpptMax: 800, vmax: 1000,
    mppts: [{ imax: 27, isc: 40.5, strings: 2 }, { imax: 16.5, isc: 24.8, strings: 1 }], bat: null, usd: 2600 },
  { id: "i4", brand: "Deye", name: "SUN-5K-SG04LP1", type: "hib", phase: "mono", kw: 5, pvMax: 6.5, vmin: 125, mpptMax: 425, vmax: 500,
    mppts: [SIZER_MPPT_DEYE, SIZER_MPPT_DEYE], bat: "48V", batV: [40, 60], batI: 120, usd: 1400 },
  { id: "i5", brand: "Deye", name: "SUN-8K-SG01HP3", type: "hib", phase: "tri", kw: 8, pvMax: 10.4, vmin: 160, mpptMax: 850, vmax: 1000,
    mppts: [{ imax: 26, isc: 34, strings: 2 }, SIZER_MPPT_DEYE], bat: "HV", batV: [160, 800], batI: 25, usd: 2900 },
  { id: "i6", brand: "SRNE", name: "HF4850S80 5 kW", type: "off", phase: "mono", kw: 5, pvMax: 5.5, vmin: 60, mpptMax: 400, vmax: 450,
    mppts: [{ imax: 18, isc: 22, strings: 1 }], bat: "48V", batV: [40, 60], batI: 100, usd: 800 },
];
/* Paneles: datos STC y coeficientes de temperatura (por °C) de Voc y de Vmp (se usa el de Pmax como aproximación). */
const SIZER_PANELS = [
  { id: "p1", brand: "Trina", name: "Vertex S 450 W", w: 450, voc: 41.5, vmp: 34.6, isc: 13.9, imp: 13.0, bVoc: -0.0025, bVmp: -0.0034, area: 2.0, usd: 110 },
  { id: "p2", brand: "Jinko", name: "Tiger Neo 550 W", w: 550, voc: 49.8, vmp: 41.9, isc: 14.0, imp: 13.13, bVoc: -0.0025, bVmp: -0.0029, area: 2.6, usd: 135 },
  { id: "p3", brand: "Canadian Solar", name: "BiHiKu 600 W bifacial", w: 600, voc: 41.9, vmp: 35.1, isc: 18.3, imp: 17.1, bVoc: -0.0026, bVmp: -0.0034, area: 2.8, usd: 160 },
];
/* Baterías: módulos de 48 V que se conectan en paralelo, o módulos HV que se apilan en serie en un rack con BMS. */
const SIZER_BATTERIES = [
  { id: "b1", brand: "Pylontech", name: "US5000 4,8 kWh", kwh: 4.8, vnom: 48, bus: "48V", topo: "par", min: 1, max: 16, imax: 100, usd: 1300 },
  { id: "b2", brand: "Deye", name: "SE-G5.1 Pro 5,12 kWh", kwh: 5.12, vnom: 51.2, bus: "48V", topo: "par", min: 1, max: 32, imax: 100, usd: 1350 },
  { id: "b3", brand: "Deye", name: "BOS-G 5,12 kWh (HV)", kwh: 5.12, vnom: 51.2, bus: "HV", topo: "series", min: 3, max: 12, imax: 50, usd: 1700 },
];
const SIZER_STRUCTURES = [
  { id: "e1", brand: "Estructura", name: "Techo de chapa", usd: 28 },
  { id: "e2", brand: "Estructura", name: "Losa (triángulo 15°)", usd: 40 },
  { id: "e3", brand: "Estructura", name: "Suelo", usd: 55 },
];
/* Horas de sol pico y temperaturas extremas de referencia (para la tensión de los strings). */
const SIZER_LOCATIONS = [
  { value: "4.4", label: "AMBA (4,4 h de sol pico)", tmin: -2, tmax: 38 },
  { value: "5.0", label: "Córdoba (5,0 h)", tmin: -5, tmax: 40 },
  { value: "5.8", label: "Mendoza / San Juan (5,8 h)", tmin: -8, tmax: 40 },
  { value: "5.6", label: "Salta / Jujuy (5,6 h)", tmin: -5, tmax: 37 },
  { value: "4.6", label: "Neuquén (4,6 h)", tmin: -10, tmax: 40 },
  { value: "4.2", label: "Mar del Plata (4,2 h)", tmin: -4, tmax: 34 },
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
const SIZER_PR = 0.8;          // rendimiento global del sistema
const SIZER_DOD = 0.9;         // profundidad de descarga de la batería
const SIZER_CELL_RISE = 25;    // °C que la celda supera al ambiente a pleno sol

function defaultSizer() {
  return {
    mode: "quick",
    quick: { cons: "450", hsp: "4.4", goal: "red", cover: "70", hours: "4", days: "2" },
    custom: {
      cons: "650", hsp: "4.4", goal: "resp", cover: "80", hours: "4", days: "2", phase: "mono", crit: "2.5",
      area: "40", est: "e1", ori: "1", tmin: "-5", tmax: "40", pan: "p2", inv: "auto", bat: "b2",
    },
  };
}

/* ---------------------------------------------------------------------- */
/* Utilidades                                                              */
/* ---------------------------------------------------------------------- */
const sizerNum = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const sizerById = (list, id) => list.find((x) => x.id === id) || null;
const sizerLine = (qty, item, note = "") => ({ qty, item, note });
const sizerTotal = (lines) => lines.reduce((s, l) => s + l.qty * l.item.usd, 0);
const sizerPlural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const sizerLocation = (hsp) => SIZER_LOCATIONS.find((l) => l.value === String(hsp)) || SIZER_LOCATIONS[0];

/* Inversores que sirven para el objetivo y la conexión (el off-grid no depende de la fase). */
function sizerInvertersFor(goal, phase) {
  return SIZER_INVERTERS.filter((i) => i.type === SIZER_GOAL_TYPE[goal] && (i.phase === phase || i.type === "off"));
}
const sizerBatteriesFor = (inv) => (inv && inv.bat ? SIZER_BATTERIES.filter((b) => b.bus === inv.bat) : []);

/* Deja inversor y batería del modo personalizado dentro de las opciones válidas. */
function sizerNormalizeCustom(cu) {
  const invs = sizerInvertersFor(cu.goal, cu.phase);
  if (cu.inv !== "auto" && !invs.some((i) => i.id === cu.inv)) cu.inv = "auto";
  const bats = sizerBatteriesFor(sizerCustomSizing(cu).inv);
  if (!bats.some((b) => b.id === cu.bat)) cu.bat = bats[0] ? bats[0].id : null;
}

function sizerGoalFraction(goal, cover, backupFraction) {
  if (goal === "red") return Math.min(100, Math.max(0, cover)) / 100;
  return goal === "resp" ? backupFraction : 1.2;
}

/* ---------------------------------------------------------------------- */
/* Arreglo FV: strings y reparto por MPPT                                  */
/* ---------------------------------------------------------------------- */
function sizerEnv(tmin, tmax) {
  return { tmin, tmax, tcell: tmax + SIZER_CELL_RISE };
}

/* Tensiones de un string de `ps` paneles en serie en los extremos de temperatura. */
function sizerStringVoltages(pan, ps, env) {
  return {
    vocCold: ps * pan.voc * (1 + pan.bVoc * (env.tmin - 25)),
    vmpHot: ps * pan.vmp * (1 + pan.bVmp * (env.tcell - 25)),
    vmpCold: ps * pan.vmp * (1 + pan.bVmp * (env.tmin - 25)),
  };
}

/* Paneles en serie admitidos: el mínimo para arrancar el MPPT en caliente y el máximo por Voc en frío. */
function sizerSeriesLimits(pan, inv, env) {
  const one = sizerStringVoltages(pan, 1, env);
  return { minPS: Math.max(1, Math.ceil(inv.vmin / one.vmpHot)), maxPS: Math.max(1, Math.floor(inv.vmax / one.vocCold)) };
}

/* Reparte `s` strings entre los MPPT: primero uno por entrada y, si hace falta, en paralelo dentro de una
   misma entrada, sin superar la corriente de cortocircuito. Lo que no entra físicamente queda en overflow. */
function sizerAllocate(s, pan, inv) {
  const safe = inv.mppts.map((m) => Math.min(m.strings, Math.floor(m.isc / pan.isc)));
  const alloc = inv.mppts.map(() => 0);
  let left = s;
  const fill = (limits) => {
    for (let level = 1; left > 0 && level <= Math.max(...limits); level++) {
      for (let i = 0; left > 0 && i < limits.length; i++) if (alloc[i] < Math.min(level, limits[i])) { alloc[i]++; left--; }
    }
  };
  fill(safe);                              // sin pasarse de corriente
  fill(inv.mppts.map((m) => m.strings));   // lo que queda, aunque la corriente no dé (se marca en las verificaciones)
  return { alloc, overflow: left };
}

/* Largo de string de cada MPPT para repartir `goal` paneles en los strings ya asignados (`alloc`).
   Cada MPPT es independiente, así que puede tener su propio largo; los strings en paralelo dentro de un
   mismo MPPT llevan el mismo. Se parte del largo parejo y se suma un panel por MPPT mientras alcance. */
function sizerStringLengths(goal, alloc, minPS, maxPS) {
  const s = alloc.reduce((n, k) => n + k, 0);
  const base = Math.max(minPS, Math.floor(goal / s));
  const lens = alloc.map((k) => (k ? base : 0));
  let rem = goal - base * s;
  alloc.map((k, i) => ({ k, i })).filter((x) => x.k > 0).sort((x, y) => x.k - y.k).forEach(({ k, i }) => {
    if (rem >= k && lens[i] + 1 <= maxPS) { lens[i]++; rem -= k; }
  });
  return lens;
}

const sizerPlanPanels = (alloc, lens) => alloc.reduce((n, k, i) => n + k * lens[i], 0);

function sizerPlanShape(alloc, lens, extra) {
  const used = lens.filter((L, i) => alloc[i] > 0);
  return { ...extra, alloc, lens, s: alloc.reduce((n, k) => n + k, 0), n: sizerPlanPanels(alloc, lens),
    psMin: Math.min(...used), psMax: Math.max(...used), overflow: 0 };
}

/* Arma los strings de un inversor para llegar a `target` paneles sin pasar `maxPanels` (potencia FV máxima
   o lo que entra en el techo). Criterio, en orden: que cada string entre en la ventana de tensión; quedar
   lo más cerca posible del objetivo; usar todos los MPPT antes de dejar alguno libre; menos strings. */
function sizerArrayPlan(target, pan, inv, env, maxPanels = Infinity) {
  const { minPS, maxPS } = sizerSeriesLimits(pan, inv, env);
  const caps = inv.mppts.map((m) => Math.min(m.strings, Math.floor(m.isc / pan.isc)));
  const usable = caps.filter((c) => c > 0).length || inv.mppts.length;   // MPPT que aceptan al menos un string
  const slots = caps.reduce((n, c) => n + c, 0) || inv.mppts.length;
  const pvCap = Math.floor((inv.pvMax * 1000) / pan.w);
  const cap = Math.min(pvCap, maxPanels);
  if (minPS > maxPS) {
    // con estas temperaturas ninguna cantidad en serie entra en la ventana del inversor
    const { alloc } = sizerAllocate(1, pan, inv);
    return sizerPlanShape(alloc, alloc.map((k) => (k ? maxPS : 0)), { limited: true, impossible: true });
  }
  const goal = Math.max(minPS, Math.min(target, cap));   // como mínimo, un string que arranque el MPPT
  let best = null;
  for (let s = 1; s <= slots; s++) {
    if (s * minPS > Math.max(goal, minPS)) break;          // más strings ya no entran ni con el largo mínimo
    const { alloc } = sizerAllocate(s, pan, inv);
    const lens = sizerStringLengths(goal, alloc, minPS, maxPS);
    if (lens.some((L, i) => alloc[i] && L > maxPS)) continue;
    const n = sizerPlanPanels(alloc, lens);
    const cand = { s, alloc, lens, diff: Math.abs(goal - n), unused: Math.max(0, usable - alloc.filter((k) => k > 0).length) };
    if (!best || cand.diff < best.diff || (cand.diff === best.diff && (cand.unused < best.unused || (cand.unused === best.unused && s < best.s)))) best = cand;
  }
  if (best && best.diff >= minPS) best = null;              // no llega al objetivo: faltan entradas o tensión
  if (!best) {
    const { alloc } = sizerAllocate(slots, pan, inv);
    let lens = alloc.map((k) => (k ? maxPS : 0));
    // con todas las entradas al máximo de tensión, sin pasar la potencia FV
    while (sizerPlanPanels(alloc, lens) > cap && lens.some((L) => L > minPS)) {
      const i = lens.indexOf(Math.max(...lens));
      lens[i]--;
    }
    return sizerPlanShape(alloc, lens, { limited: true, impossible: false });
  }
  return sizerPlanShape(best.alloc, best.lens, { limited: false, impossible: false });
}

/* "de 5" o "de 4 y 5" paneles. */
const sizerLensText = (plan) => (plan.psMin === plan.psMax ? `de ${plan.psMax}` : `de ${plan.psMin} y ${plan.psMax}`);

function sizerWiringText(plan) {
  if (plan.s === 1) return "Un solo string: todos los paneles en serie.";
  const parallel = plan.alloc.map((k, i) => ({ k, i })).filter((x) => x.k > 1);
  const uneven = plan.psMin !== plan.psMax ? " Como cada MPPT es independiente, los strings de distintas entradas pueden tener distinto largo." : "";
  if (!parallel.length) return `${plan.s} strings independientes, cada uno en su propio MPPT. Dentro de cada string los paneles van en serie.${uneven}`;
  return `Serie-paralelo: los paneles van en serie dentro de cada string y ${parallel.map((x) => `el MPPT ${x.i + 1} recibe ${x.k} strings iguales en paralelo`).join(" y ")}.${uneven}`;
}

/* Verificaciones panel ↔ inversor de un arreglo ya armado. */
function sizerArrayChecks(plan, pan, inv, env, nInv = 1) {
  const long = sizerStringVoltages(pan, plan.psMax, env);
  const short = sizerStringVoltages(pan, plan.psMin, env);
  const v = { vocCold: long.vocCold, vmpHot: short.vmpHot, vmpCold: long.vmpCold };
  const which = (ps) => (plan.psMin === plan.psMax ? "del string" : `del string de ${ps}`);
  const kwp = (plan.n * pan.w) / 1000;
  const checks = [];
  checks.push({ tone: v.vocCold <= inv.vmax ? "ok" : "bad", text: `Voc ${which(plan.psMax)} a ${fmtNum(env.tmin)} °C: ${fmtNum(v.vocCold)} V ${v.vocCold <= inv.vmax ? "≤" : ">"} ${inv.vmax} V máximos del inversor.` });
  checks.push({ tone: v.vmpHot >= inv.vmin ? "ok" : "bad", text: `Vmp ${which(plan.psMin)} con la celda a ${fmtNum(env.tcell)} °C: ${fmtNum(v.vmpHot)} V ${v.vmpHot >= inv.vmin ? "≥" : "<"} ${inv.vmin} V mínimos del MPPT.` });
  if (v.vmpCold > inv.mpptMax) checks.push({ tone: "warn", text: `Vmp en frío de ${fmtNum(v.vmpCold)} V, arriba del rango MPPT (hasta ${inv.mpptMax} V): en invierno puede perder rendimiento.` });
  plan.alloc.forEach((k, i) => {
    if (!k) return;
    const m = inv.mppts[i];
    const isc = k * pan.isc;
    const imp = k * pan.imp;
    const label = `MPPT ${i + 1} (${sizerPlural(k, "string", "strings")} de ${plan.lens[i]}${k > 1 ? " en paralelo" : ""})`;
    if (isc > m.isc) checks.push({ tone: "bad", text: `${label}: Isc de ${fmtNum(isc, 1)} A > ${fmtNum(m.isc, 1)} A que admite la entrada.` });
    else if (imp > m.imax) checks.push({ tone: "warn", text: `${label}: Imp de ${fmtNum(imp, 1)} A > ${fmtNum(m.imax, 1)} A de operación. El inversor recorta corriente.` });
    else checks.push({ tone: "ok", text: `${label}: Isc de ${fmtNum(isc, 1)} A ≤ ${fmtNum(m.isc, 1)} A de la entrada.` });
  });
  const each = nInv > 1 ? " por inversor" : "";
  checks.push({ tone: kwp <= inv.pvMax ? "ok" : "bad", text: `Potencia FV${each} de ${fmtNum(kwp, 2)} kWp ${kwp <= inv.pvMax ? "≤" : ">"} ${fmtNum(inv.pvMax, 1)} kWp que admite el inversor.` });
  // la relación DC/AC es una guía: el límite duro es la potencia FV máxima (arriba)
  const ratio = kwp / inv.kw;
  if (ratio > 1.3) checks.push({ tone: "warn", text: `Relación DC/AC de ${fmtNum(ratio, 2)}: en las horas de más sol el inversor recorta potencia.` });
  else if (ratio < 0.8) checks.push({ tone: "warn", text: `Relación DC/AC de ${fmtNum(ratio, 2)}: el inversor queda grande para el arreglo${inv.type === "on" ? "" : ", algo esperable si se eligió por cargas críticas o batería"}.` });
  else checks.push({ tone: "ok", text: `Relación DC/AC de ${fmtNum(ratio, 2)} (conviene entre 0,8 y 1,3).` });
  return { checks, v };
}

/* ---------------------------------------------------------------------- */
/* Banco de baterías                                                       */
/* ---------------------------------------------------------------------- */
function sizerBankPlan(bat, n) {
  const series = bat.topo === "series";
  return { n, series, vbus: series ? n * bat.vnom : bat.vnom, kwh: n * bat.kwh, imax: series ? bat.imax : n * bat.imax };
}

/* Rango de módulos que acepta el par batería ↔ inversor. */
function sizerBankRange(bat, inv) {
  if (bat.topo !== "series" || !inv.batV) return { min: bat.min, max: bat.max };
  return { min: Math.max(bat.min, Math.ceil(inv.batV[0] / bat.vnom)), max: Math.min(bat.max, Math.floor(inv.batV[1] / bat.vnom)) };
}

/* Corriente que pide el inversor a su potencia nominal, sin pasar su máximo de batería. */
const sizerInverterBatCurrent = (inv, vbus) => Math.min(inv.batI, (inv.kw * 1000) / vbus);

/* Módulos para cubrir la energía pedida, la tensión mínima del inversor y la corriente a plena potencia. */
function sizerBankAuto(bat, inv, kwh) {
  const range = sizerBankRange(bat, inv);
  let n = Math.max(range.min, Math.ceil(kwh / bat.kwh));
  if (bat.topo === "par") n = Math.max(n, Math.ceil(sizerInverterBatCurrent(inv, bat.vnom) / bat.imax));
  return Math.min(n, range.max);
}

function sizerBankText(bank, bat) {
  return bank.series
    ? `Rack HV: ${sizerPlural(bank.n, "módulo", "módulos")} de ${fmtNum(bat.vnom, 1)} V en serie, con el BMS del rack.`
    : `${sizerPlural(bank.n, "módulo", "módulos")} de ${fmtNum(bat.vnom, 1)} V en paralelo sobre el mismo bus.`;
}

/* Verificaciones batería ↔ inversor. */
function sizerBankChecks(bat, n, inv) {
  if (inv.type === "on") return bat && n ? [{ tone: "bad", text: "Un inversor on-grid no admite batería." }] : [];
  if (!bat || !n) return [inv.type === "off" ? { tone: "bad", text: "Un sistema off-grid necesita batería." } : { tone: "warn", text: "Híbrido sin batería: funciona, pero sin respaldo ante cortes." }];
  const bank = sizerBankPlan(bat, n);
  const range = sizerBankRange(bat, inv);
  const checks = [];
  if (bat.bus !== inv.bat) {
    checks.push({ tone: "bad", text: `La batería es de ${bat.bus === "HV" ? "alta tensión" : "48 V"} y el inversor pide ${inv.bat === "HV" ? "alta tensión" : "48 V"}.` });
    return checks;
  }
  const inWindow = bank.vbus >= inv.batV[0] && bank.vbus <= inv.batV[1];
  checks.push({ tone: inWindow ? "ok" : "bad", text: `Tensión del banco: ${fmtNum(bank.vbus, 1)} V ${inWindow ? "dentro de" : "fuera de"} la ventana de batería del inversor (${inv.batV[0]} a ${inv.batV[1]} V).` });
  const inRange = n >= range.min && n <= range.max;
  checks.push({ tone: inRange ? "ok" : "bad", text: `${sizerPlural(n, "módulo", "módulos")} en ${bank.series ? "serie" : "paralelo"}: con este inversor se admiten de ${range.min} a ${range.max}.` });
  const need = sizerInverterBatCurrent(inv, bank.vbus);
  if (bank.imax >= need) checks.push({ tone: "ok", text: `El banco entrega hasta ${fmtNum(bank.imax)} A y el inversor pide ${fmtNum(need)} A a plena potencia.` });
  else checks.push({ tone: "warn", text: `El banco entrega ${fmtNum(bank.imax)} A y el inversor pide ${fmtNum(need)} A: desde batería queda limitado a ${fmtNum((bank.imax * bank.vbus) / 1000, 1)} kW.` });
  return checks;
}

/* ---------------------------------------------------------------------- */
/* Modos                                                                   */
/* ---------------------------------------------------------------------- */
/* Resultado común: configuración, verificaciones y lista de materiales. */
function sizerAssemble({ pan, inv, nInv, plan, env, bat, nbPerInv, est, extraChecks = [], notes = [] }) {
  const array = sizerArrayChecks(plan, pan, inv, env, nInv);
  const bankChecks = sizerBankChecks(bat, nbPerInv, inv);
  const checks = [...array.checks, ...bankChecks, ...extraChecks];
  const n = plan.n * nInv;
  const nb = bat ? nbPerInv * nInv : 0;
  const kwp = (n * pan.w) / 1000;
  const lines = [
    sizerLine(n, pan, `${nInv > 1 ? `${nInv} × ` : ""}${sizerPlural(plan.s, "string", "strings")} ${sizerLensText(plan)} en serie`),
    sizerLine(nInv, inv),
    ...(nb ? [sizerLine(nb, bat, bat.topo === "series" ? `rack de ${nbPerInv} en serie${nInv > 1 ? " por inversor" : ""}` : `${nbPerInv} en paralelo${nInv > 1 ? " por inversor" : ""}`)] : []),
    sizerLine(n, est),
  ];
  return {
    kwp, storage: nb ? nb * bat.kwh : 0, ratio: kwp / (nInv * inv.kw), lines, total: sizerTotal(lines), checks,
    ok: !checks.some((c) => c.tone === "bad"), notes,
    config: { pan, inv, nInv, plan, v: array.v, env, bat: nb ? bat : null, bank: nb ? sizerBankPlan(bat, nbPerInv) : null },
  };
}

/* Si el string más chico que arranca el MPPT ya genera mucho más que el consumo, se aclara. */
function sizerMinimumNote(r) {
  if (r.coverage > 150 && r.config.nInv === 1 && r.config.plan.s === 1) {
    r.notes.unshift({ tone: "info", text: `Es el sistema mínimo para este inversor: un string de ${r.config.plan.psMax} paneles es lo menos que arranca su MPPT, y genera más de lo que consumís.` });
  }
}

/* 1A · Rápido: panel Jinko 550 W, techo de chapa e inversor monofásico más chico que alcance. */
function sizerQuickResult(q) {
  const cons = sizerNum(q.cons);
  const hsp = sizerNum(q.hsp);
  if (cons <= 0) return { empty: "Ingresá tu consumo mensual para ver el sistema sugerido." };
  const frac = sizerGoalFraction(q.goal, sizerNum(q.cover), 0.8);
  if (frac <= 0) return { empty: "Indicá qué porcentaje del consumo querés cubrir." };

  const loc = sizerLocation(q.hsp);
  const env = sizerEnv(loc.tmin, loc.tmax);
  const pan = sizerById(SIZER_PANELS, "p2");
  const kwpReq = (cons * frac) / (30 * hsp * SIZER_PR);
  const cands = SIZER_INVERTERS.filter((i) => i.type === SIZER_GOAL_TYPE[q.goal] && i.phase === "mono");
  const inv = cands.find((i) => i.pvMax >= kwpReq) || cands[cands.length - 1];
  const target = Math.max(1, Math.min(Math.ceil((kwpReq * 1000) / pan.w), Math.floor((inv.pvMax * 1000) / pan.w)));
  const plan = sizerArrayPlan(target, pan, inv, env);

  const kwh = q.goal === "resp" ? ((cons / 30 / 24) * sizerNum(q.hours) * 1.5) / SIZER_DOD
    : q.goal === "aut" ? ((cons / 30) * sizerNum(q.days)) / SIZER_DOD : 0;
  const bats = sizerBatteriesFor(inv);
  const bat = bats[bats.length - 1] || null;
  const nb = kwh > 0 && bat ? sizerBankAuto(bat, inv, kwh) : 0;
  const est = SIZER_STRUCTURES[0];

  const notes = [{ tone: "info", text: `Temperaturas de referencia de ${loc.label.split(" (")[0]}: ${fmtNum(loc.tmin)} °C mínima y ${fmtNum(loc.tmax)} °C máxima.` }];
  if (plan.limited || (plan.n * pan.w) / 1000 + 0.01 < kwpReq) notes.unshift({ tone: "warn", text: "La potencia quedó limitada por el inversor monofásico más grande del catálogo. Para más potencia, usá el modo personalizado." });
  const r = sizerAssemble({ pan, inv, nInv: 1, plan, env, bat, nbPerInv: nb, est, notes });
  r.gen = r.kwp * hsp * 30 * SIZER_PR;
  r.coverage = (r.gen / cons) * 100;
  sizerMinimumNote(r);
  return r;
}

/* Paneles objetivo del personalizado: lo que pide el consumo, recortado por la superficie. */
function sizerCustomTargets(cu, pan) {
  const cons = sizerNum(cu.cons);
  const frac = sizerGoalFraction(cu.goal, sizerNum(cu.cover), 0.85);
  const ori = sizerNum(cu.ori) || 1;
  const hsp = sizerNum(cu.hsp) || 1;
  const kwpReq = (cons * frac) / (30 * hsp * SIZER_PR * ori);
  const nReq = Math.max(0, Math.ceil((kwpReq * 1000) / pan.w));
  const nArea = Math.max(0, Math.floor(sizerNum(cu.area) / pan.area));
  return { kwpReq, nReq, nArea, nTarget: Math.min(nReq, nArea) };
}

/* Cuántos inversores de un modelo hacen falta y cómo queda el arreglo de cada uno. Se suma un inversor
   mientras el arreglo de cada uno no llegue a su parte (por tensión, entradas o potencia FV). */
function sizerInverterFit(inv, pan, env, nTarget, nArea, crit, backup) {
  let nInv = Math.max(1, Math.ceil((nTarget * pan.w) / 1000 / inv.pvMax));
  if (backup) nInv = Math.max(nInv, Math.ceil(crit / inv.kw));
  // todos los inversores llevan el mismo arreglo: cada uno, su parte sin pasar lo que entra en el techo
  const planFor = (k) => sizerArrayPlan(Math.ceil(nTarget / k), pan, inv, env, Math.max(1, Math.floor(nArea / k)));
  let plan = planFor(nInv);
  while (plan.limited && !plan.impossible && nInv < 500) plan = planFor(++nInv);
  // un inversor menos si solo se pierden hasta 2 paneles o el 5 % del objetivo (y alcanza para las cargas críticas)
  const minInv = backup ? Math.max(1, Math.ceil(crit / inv.kw)) : 1;
  if (nInv - 1 >= minInv) {
    const fewer = planFor(nInv - 1);
    const tolerance = Math.max(2, Math.floor(nTarget * 0.05));
    if (!fewer.impossible && fewer.n * (nInv - 1) >= nTarget - tolerance) return { inv, nInv: nInv - 1, plan: fewer };
  }
  return { inv, nInv, plan };
}

/* Inversor efectivo del personalizado: el elegido o, en automático, el que resuelve con menos equipos
   (y, a igual cantidad, el más barato). */
function sizerCustomSizing(cu) {
  const invs = sizerInvertersFor(cu.goal, cu.phase);
  const pan = sizerById(SIZER_PANELS, cu.pan);
  const env = sizerEnv(sizerNum(cu.tmin), sizerNum(cu.tmax));
  const backup = cu.goal !== "red";
  const crit = sizerNum(cu.crit);
  const t = sizerCustomTargets(cu, pan);
  const pool = cu.inv === "auto" ? invs : invs.filter((i) => i.id === cu.inv);
  let best = null;
  // a igual cantidad de inversores, primero el que deja la relación DC/AC entre 0,8 y 1,3 y después el más barato
  const offRatio = (f) => { const r = (f.plan.n * pan.w) / 1000 / f.inv.kw; return r < 0.8 || r > 1.3 ? 1 : 0; };
  pool.forEach((inv) => {
    const fit = sizerInverterFit(inv, pan, env, Math.max(1, t.nTarget), Math.max(1, t.nArea), crit, backup);
    if (!best || fit.nInv < best.nInv
      || (fit.nInv === best.nInv && (offRatio(fit) < offRatio(best)
        || (offRatio(fit) === offRatio(best) && fit.nInv * inv.usd < best.nInv * best.inv.usd)))) best = fit;
  });
  return { ...(best || { inv: null }), pan, env, t, crit, backup };
}

/* 1B · Personalizado: el usuario elige el panel (y, si quiere, inversor y batería); se calculan
   inversores, strings y módulos. */
function sizerCustomResult(cu) {
  const cons = sizerNum(cu.cons);
  const hsp = sizerNum(cu.hsp);
  if (cons <= 0) return { empty: "Ingresá tu consumo mensual para calcular las cantidades." };
  if (sizerGoalFraction(cu.goal, sizerNum(cu.cover), 0.85) <= 0) return { empty: "Indicá qué porcentaje del consumo querés cubrir." };
  const { inv, nInv, plan, pan, env, t, crit, backup } = sizerCustomSizing(cu);
  if (!inv) return { empty: "No hay inversores de ejemplo para esa combinación. Cambiá el objetivo o la conexión." };
  if (t.nArea < 1) return { empty: "Con esa superficie no entra ni un panel. Revisá los m² libres." };

  // la batería sigue al inversor efectivo (en automático puede cambiar con el consumo o la superficie)
  const bats = sizerBatteriesFor(inv);
  const bat = bats.find((b) => b.id === cu.bat) || bats[0] || null;
  const est = sizerById(SIZER_STRUCTURES, cu.est);
  const ori = sizerNum(cu.ori) || 1;
  const n = plan.n * nInv;
  const kwh = cu.goal === "resp" ? (crit * 0.6 * sizerNum(cu.hours)) / SIZER_DOD
    : cu.goal === "aut" ? ((cons / 30) * sizerNum(cu.days)) / SIZER_DOD : 0;
  const nbPerInv = bat && kwh > 0 ? sizerBankAuto(bat, inv, kwh / nInv) : 0;
  const acKw = nInv * inv.kw;

  const extra = [];
  if (plan.impossible) extra.push({ tone: "bad", text: `Con ${fmtNum(env.tmin)} °C y ${fmtNum(env.tmax)} °C no hay una cantidad de paneles en serie que entre en la ventana de tensión del ${inv.brand} ${inv.name}.` });
  extra.push({ tone: n <= t.nArea ? "ok" : "bad", text: `Superficie: ${n} paneles ocupan ${fmtNum(n * pan.area, 1)} m² de ${fmtNum(sizerNum(cu.area))} m² libres.` });
  if (t.nReq > t.nArea) extra.push({ tone: "warn", text: `El techo limita: para el objetivo harían falta ${t.nReq} paneles (${fmtNum(t.nReq * pan.area)} m²).` });
  if (n < t.nTarget && !plan.impossible) extra.push({ tone: "warn", text: nInv > 1
    ? `Se usan ${n} de los ${t.nTarget} paneles posibles, para que los ${nInv} inversores queden iguales y sin sumar uno más.`
    : `Se usan ${n} de los ${t.nTarget} paneles posibles: es lo que admite un ${inv.brand} ${inv.name} y evita sumar otro inversor.` });
  if (backup) extra.push({ tone: acKw >= crit ? "ok" : "bad", text: `Potencia AC de ${fmtNum(acKw)} kW para ${fmtNum(crit, 1)} kW de cargas críticas.` });
  if (inv.type !== "off" && cu.phase !== inv.phase) extra.push({ tone: "bad", text: "La fase del inversor no coincide con la conexión." });
  if (cu.phase === "mono" && acKw > 10) extra.push({ tone: "warn", text: `${fmtNum(acKw)} kW de inversores en una conexión monofásica: lo habitual es no pasar de 10 kW. Consultá con tu distribuidora o pasá a trifásica.` });
  if (nInv > 4) extra.push({ tone: "warn", text: `Son ${nInv} inversores de ${fmtNum(inv.kw)} kW. ${cu.inv === "auto" ? "Es el modelo más grande del catálogo de ejemplo para esta conexión" : "Conviene un modelo más grande"}${cu.phase === "mono" ? " o pasar a trifásica" : ""}.` });

  const notes = [];
  if (cu.goal === "resp") notes.push({ tone: "info", text: "Respaldo calculado con el 60 % de las cargas críticas en promedio." });
  if (nInv > 1) notes.push({ tone: "info", text: `Cada inversor lleva su propio arreglo de strings${nbPerInv ? " y su propio banco de baterías" : ""}. Las verificaciones de tensión, corriente y potencia son por inversor.` });
  const r = sizerAssemble({ pan, inv, nInv, plan, env, bat, nbPerInv, est, extraChecks: extra, notes });
  r.gen = r.kwp * hsp * 30 * SIZER_PR * ori;
  r.coverage = (r.gen / cons) * 100;
  sizerMinimumNote(r);
  return r;
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

function sizerTempFieldsHTML(scope, st) {
  return `<div class="sz-row">
    ${sizerNumberHTML({ scope, field: "tmin", label: "Temperatura mínima", unit: "°C", value: st.tmin, min: -30, max: 20, hint: "Define la Voc máxima del string." })}
    ${sizerNumberHTML({ scope, field: "tmax", label: "Temperatura máxima", unit: "°C", value: st.tmax, min: 20, max: 55, hint: "Define la Vmp mínima del string." })}
  </div>`;
}

function sizerQuickInputsHTML(q) {
  const s = "quick";
  return `
    <p class="muted small">Cargás lo básico y elegimos equipos, marcas, cantidades y el conexionado por vos.</p>
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
  const inv = sizerCustomSizing(cu).inv;
  const bats = sizerBatteriesFor(inv);
  const backup = cu.goal !== "red";
  const price = (x) => sizerMoney(x.usd, currency);
  const invOptions = [{ id: "auto", label: "Automático (el que resuelve con menos equipos)" },
    ...invs.map((x) => ({ id: x.id, label: `${sizerItemName(x)}, ${x.kw} kW ${x.phase === "tri" ? "trifásico" : "monofásico"} (${price(x)})` }))];
  const invHint = `${cu.inv === "auto" && inv ? `Elegido: ${sizerItemName(inv)}. ` : ""}${invs.length} ${invs.length === 1 ? "modelo compatible" : "modelos compatibles"} con el objetivo y la conexión.`;
  return `
    <p class="muted small">Más datos del sitio. Vos elegís el modelo de cada equipo y calculamos cantidades, strings y banco de baterías.</p>
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
      ${sizerSelectHTML({ scope: s, field: "ori", label: "Orientación", value: cu.ori, options: sizerOptions(SIZER_ORIENTATIONS, cu.ori, (x) => x.label) })}
      ${sizerTempFieldsHTML(s, cu)}
    </fieldset>
    <fieldset class="sz-group">
      <legend>Los equipos</legend>
      ${sizerSelectHTML({ scope: s, field: "pan", label: "Panel", value: cu.pan, options: sizerOptions(SIZER_PANELS, cu.pan, (x) => `${sizerItemName(x)} (${price(x)})`) })}
      ${invs.length
        ? sizerSelectHTML({ scope: s, field: "inv", label: "Inversor", value: cu.inv, hint: invHint, options: sizerOptions(invOptions, cu.inv, (x) => x.label) })
        : `<p class="field-hint">No hay inversores de ejemplo para esta combinación.</p>`}
      ${bats.length ? sizerSelectHTML({ scope: s, field: "bat", label: "Batería", value: cu.bat, hint: `Solo las de ${inv.bat === "HV" ? "alta tensión" : "48 V"}, como pide el inversor.`, options: sizerOptions(bats, cu.bat, (x) => `${sizerItemName(x)} (${price(x)})`) }) : ""}
    </fieldset>`;
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

/* Fila de módulos dibujados (decorativo: la descripción en texto va al lado). */
function sizerCellsHTML(count, cls) {
  if (count > 24) return `<span class="sz-cells-more">${count}</span>`;
  return `<span class="sz-cells" aria-hidden="true">${`<i class="${cls}"></i>`.repeat(count)}</span>`;
}

/* Conexionado: strings por MPPT y armado del banco. */
function sizerConfigHTML(c) {
  const { plan, v, env, inv, nInv, bank, bat } = c;
  const mppts = plan.alloc.map((k, i) => `
    <li>
      <span class="sz-mppt-name">MPPT ${i + 1}</span>
      <span class="sz-mppt-strings">${k ? Array.from({ length: k }, () => sizerCellsHTML(plan.lens[i], "sz-cell")).join("") : `<span class="dim small">Libre</span>`}</span>
      <span class="sz-mppt-meta">${k ? `${sizerPlural(k, "string", "strings")} de ${plan.lens[i]} paneles${k > 1 ? " en paralelo" : ""}` : ""}</span>
    </li>`).join("");
  const bankHTML = bank ? `
    <div class="sz-config-block">
      <h5>Banco de baterías${nInv > 1 ? " (por inversor)" : ""}</h5>
      <p>${sizerBankText(bank, bat)}</p>
      <div class="sz-bank${bank.series ? " is-series" : ""}">${sizerCellsHTML(bank.n, "sz-mod")}<span class="small dim">${bank.series ? "Serie" : "Paralelo"}</span></div>
      <dl class="sz-elec">
        <div><dt>Bus</dt><dd>${fmtNum(bank.vbus, 1)} V</dd></div>
        <div><dt>Energía</dt><dd>${fmtNum(bank.kwh, 1)} kWh</dd></div>
        <div><dt>Corriente máx.</dt><dd>${fmtNum(bank.imax)} A</dd></div>
      </dl>
    </div>` : "";
  return `<div class="sz-config">
    <h4>Conexionado</h4>
    <div class="sz-config-block">
      <h5>Arreglo FV</h5>
      ${nInv > 1 ? `<p class="sz-config-total"><strong>Total: ${plan.s * nInv} strings y ${plan.n * nInv} paneles, repartidos en ${nInv} inversores iguales.</strong> Cada inversor lleva:</p>` : ""}
      <p><strong>${sizerPlural(plan.s, "string", "strings")} ${sizerLensText(plan)} paneles en serie</strong> (${plan.n} paneles${nInv > 1 ? " por inversor" : ""}). ${sizerWiringText(plan)}</p>
      <ul class="sz-mppts">${mppts}</ul>
      <dl class="sz-elec">
        <div><dt>Voc a ${fmtNum(env.tmin)} °C</dt><dd>${fmtNum(v.vocCold)} V</dd></div>
        <div><dt>Vmp a ${fmtNum(env.tcell)} °C</dt><dd>${fmtNum(v.vmpHot)} V</dd></div>
        <div><dt>Ventana MPPT</dt><dd>${inv.vmin} a ${inv.mpptMax} V</dd></div>
      </dl>
    </div>
    ${bankHTML}
  </div>`;
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

/* Datos que cargó el usuario, solo los campos que se ven en pantalla para ese modo y objetivo. */
function sizerInputsSummary(kind, st) {
  const num = (v, dec = 0) => { const n = sizerNum(v); return fmtNum(n, Number.isInteger(n) ? 0 : dec); };
  const goal = SIZER_GOALS.find((g) => g.id === st.goal);
  const rows = [
    ["Objetivo", goal ? goal.label : st.goal],
    ["Consumo mensual", `${num(st.cons)} kWh/mes`],
    ["Ubicación", sizerLocation(st.hsp).label],
  ];
  if (st.goal === "red") rows.push(["Cobertura del consumo", `${num(st.cover)} %`]);
  else if (st.goal === "resp") rows.push(["Horas de respaldo", `${num(st.hours, 1)} h`]);
  else rows.push(["Días de autonomía", `${num(st.days, 1)} días`]);
  if (kind === "custom") {
    if (st.goal !== "red") rows.push(["Cargas críticas", `${num(st.crit, 1)} kW`]);
    rows.push(["Conexión", st.phase === "tri" ? "Trifásica 380 V" : "Monofásica 220 V"]);
    rows.push(["Superficie libre", `${num(st.area, 1)} m²`]);
    const est = sizerById(SIZER_STRUCTURES, st.est);
    if (est) rows.push(["Tipo de techo", est.name]);
    const ori = SIZER_ORIENTATIONS.find((o) => o.value === String(st.ori));
    if (ori) rows.push(["Orientación", ori.label]);
    rows.push(["Temperaturas", `mín. ${num(st.tmin, 1)} °C / máx. ${num(st.tmax, 1)} °C`]);
    const pan = sizerById(SIZER_PANELS, st.pan);
    if (pan) rows.push(["Panel elegido", sizerItemName(pan)]);
    const inv = sizerCustomSizing(st).inv;
    const chosen = st.inv !== "auto" ? sizerById(SIZER_INVERTERS, st.inv) : null;
    if (chosen) rows.push(["Inversor elegido", sizerItemName(chosen)]);
    else rows.push(["Inversor", inv ? `automático (${sizerItemName(inv)})` : "automático"]);
    const bat = sizerBatteriesFor(inv).length ? sizerById(SIZER_BATTERIES, st.bat) : null;
    if (bat) rows.push(["Batería elegida", sizerItemName(bat)]);
  }
  return rows.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

/* Mensaje de WhatsApp con lo que cargó el usuario y el sistema armado, para pedir la cotización real. */
function sizerQuoteMessage(kind, inputs, r, currency) {
  const label = SIZER_MODE_LABEL[kind];
  const c = r.config;
  const list = r.lines.map((l) => `- ${l.qty} x ${sizerItemName(l.item)}${l.note ? ` (${l.note})` : ""}`).join("\n");
  const perMppt = c.plan.alloc.map((k, i) => (k ? `MPPT ${i + 1}: ${sizerPlural(k, "string", "strings")} de ${c.plan.lens[i]}` : "")).filter(Boolean).join("; ");
  const wiring = `Arreglo: ${c.nInv > 1 ? `${c.nInv} inversores, cada uno con ` : ""}${sizerPlural(c.plan.s, "string", "strings")} ${sizerLensText(c.plan)} paneles en serie (${perMppt})`;
  const bank = c.bank ? `\nBanco: ${sizerBankText(c.bank, c.bat)}` : "";
  return `Hola, armé un sistema con el dimensionador de Auryx (${label}).\n\nMis datos:\n${sizerInputsSummary(kind, inputs)}\n\nSistema sugerido:\n${list}\n${wiring}${bank}\nPotencia FV: ${fmtNum(r.kwp, 2)} kWp${r.storage ? `\nAlmacenamiento: ${fmtNum(r.storage, 1)} kWh` : ""}\nTotal de referencia: ${sizerMoney(r.total, currency)}\n¿Me pasan una cotización?`;
}

const SIZER_MODE_LABEL = { quick: "automático rápido", custom: "automático personalizado" };

function sizerOutputHTML(sz, currency) {
  const kind = sz.mode;
  const r = kind === "quick" ? sizerQuickResult(sz.quick) : sizerCustomResult(sz.custom);
  if (r.empty) {
    return `<div class="sz-empty">${icon("solar-panel")}<p>${r.empty}</p></div>`;
  }
  const title = kind === "quick" ? "Sistema sugerido" : "Resultado";
  const badge = r.ok
    ? `<span class="badge tone-ok">${icon("check-circle", "", "fill")}Todo cierra</span>`
    : `<span class="badge tone-bad">${icon("x-circle", "", "fill")}Revisar</span>`;

  const stats = [];
  if (r.coverage !== undefined) stats.push({ label: "Cobertura del consumo", value: r.coverage > 999 ? "Más de 999 %" : `${fmtNum(r.coverage)} %` });
  stats.push({ label: "Almacenamiento", value: r.storage ? `${fmtNum(r.storage, 1)} kWh` : `<span class="sz-none">Sin batería</span>` });
  stats.push({ label: "Relación DC/AC", value: fmtNum(r.ratio, 2) });
  const c = r.config;
  stats.push({ label: c.nInv > 1 ? "Inversores" : "Inversor", value: `${c.nInv > 1 ? `${c.nInv} × ` : ""}${fmtNum(c.inv.kw)} kW` });
  stats.push({ label: "Strings", value: `${c.plan.s * c.nInv} ${sizerLensText(c.plan)}` });

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
    ${sizerConfigHTML(r.config)}
    <div class="sz-verify">
      <h4>Compatibilidad entre componentes</h4>
      ${sizerChecksHTML(r.checks)}
    </div>
    ${sizerBomHTML(r.lines, r.total, currency)}
    ${r.notes && r.notes.length ? sizerNotesHTML(r.notes) : ""}
    <div class="sz-actions">
      <a class="btn btn-primary" href="${whatsappLink(sizerQuoteMessage(kind, sz[kind], r, currency))}" target="_blank" rel="noopener">${icon("whatsapp-logo")} Pedir cotización</a>
    </div>`;
}

function renderSizer(sz, currency) {
  const inputs = sz.mode === "quick" ? sizerQuickInputsHTML(sz.quick) : sizerCustomInputsHTML(sz.custom, currency);
  const mode = (id, label, ic) => `<button type="button" class="sz-tab" data-action="sizer-mode" data-mode="${id}" data-fid="sz-mode-${id}" aria-pressed="${sz.mode === id}">${icon(ic)}${label}</button>`;
  return `
    <div class="sz-bar">
      <div class="sz-tabs" role="group" aria-label="Nivel de detalle">
        ${mode("quick", "Rápido", "lightning")}
        ${mode("custom", "Personalizado", "sliders-horizontal")}
      </div>
    </div>
    <div class="sz-grid">
      <form class="sz-inputs" data-form="sizer" novalidate>${inputs}</form>
      <div class="sz-out" id="sizer-out">${sizerOutputHTML(sz, currency)}</div>
    </div>`;
}
