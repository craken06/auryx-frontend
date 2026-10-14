/* AURYX: dimensionador FV+BESS de "Diseñá tu sistema" (automático rápido, automático personalizado y libre).
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
    tab: "auto",
    mode: "quick",
    quick: { cons: "450", hsp: "4.4", goal: "red", cover: "70", hours: "4", days: "2" },
    custom: {
      cons: "650", hsp: "4.4", goal: "resp", cover: "80", hours: "4", days: "2", phase: "mono", crit: "2.5",
      area: "40", est: "e1", ori: "1", tmin: "-5", tmax: "40", pan: "p2", inv: "i4", bat: "b2",
    },
    free: { inv: "i4", pan: "p2", ps: "5", s: "2", bat: "b2", nb: "2", est: "e1", tmin: "-5", tmax: "40" },
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

/* Elige strings iguales para llegar a `target` paneles en un inversor: la menor cantidad de strings que
   entre en la ventana de tensión, sin pasar `maxKw` de potencia FV si se indica. */
function sizerArrayPlan(target, pan, inv, env, maxKw) {
  const { minPS, maxPS } = sizerSeriesLimits(pan, inv, env);
  const safeSlots = inv.mppts.reduce((n, m) => n + Math.min(m.strings, Math.floor(m.isc / pan.isc)), 0);
  const slots = Math.max(1, safeSlots || inv.mppts.length);
  let s = 1;
  let ps = Math.max(minPS, Math.ceil(target / s));
  while (ps > maxPS && s < slots) { s++; ps = Math.max(minPS, Math.ceil(target / s)); }
  const limited = ps > maxPS;
  if (limited) ps = maxPS;
  while (maxKw && s * ps * pan.w > maxKw * 1000 && ps - 1 >= minPS) ps--;
  return { ps, s, n: s * ps, limited, ...sizerAllocate(s, pan, inv) };
}

function sizerWiringText(plan) {
  const extra = plan.overflow ? ` ${plan.overflow === 1 ? "Queda 1 string" : `Quedan ${plan.overflow} strings`} sin entrada en el inversor.` : "";
  if (plan.s === 1) return "Un solo string: todos los paneles en serie.";
  const placed = plan.s - plan.overflow;
  const parallel = plan.alloc.map((k, i) => ({ k, i })).filter((x) => x.k > 1);
  if (!parallel.length) return `${placed === 1 ? "1 string" : `${placed} strings independientes`}, cada uno en su propio MPPT. Dentro de cada string los paneles van en serie.${extra}`;
  return `Serie-paralelo: los paneles van en serie dentro de cada string y ${parallel.map((x) => `el MPPT ${x.i + 1} recibe ${x.k} strings en paralelo`).join(" y ")}.${extra}`;
}

/* Verificaciones panel ↔ inversor de un arreglo ya armado. */
function sizerArrayChecks(plan, pan, inv, env) {
  const v = sizerStringVoltages(pan, plan.ps, env);
  const kwp = (plan.n * pan.w) / 1000;
  const checks = [];
  checks.push({ tone: v.vocCold <= inv.vmax ? "ok" : "bad", text: `Voc del string a ${fmtNum(env.tmin)} °C: ${fmtNum(v.vocCold)} V ${v.vocCold <= inv.vmax ? "≤" : ">"} ${inv.vmax} V máximos del inversor.` });
  checks.push({ tone: v.vmpHot >= inv.vmin ? "ok" : "bad", text: `Vmp del string con la celda a ${fmtNum(env.tcell)} °C: ${fmtNum(v.vmpHot)} V ${v.vmpHot >= inv.vmin ? "≥" : "<"} ${inv.vmin} V mínimos del MPPT.` });
  if (v.vmpCold > inv.mpptMax) checks.push({ tone: "warn", text: `Vmp en frío de ${fmtNum(v.vmpCold)} V, arriba del rango MPPT (hasta ${inv.mpptMax} V): en invierno puede perder rendimiento.` });
  plan.alloc.forEach((k, i) => {
    if (!k) return;
    const m = inv.mppts[i];
    const isc = k * pan.isc;
    const imp = k * pan.imp;
    const label = `MPPT ${i + 1} (${sizerPlural(k, "string", "strings")}${k > 1 ? " en paralelo" : ""})`;
    if (isc > m.isc) checks.push({ tone: "bad", text: `${label}: Isc de ${fmtNum(isc, 1)} A > ${fmtNum(m.isc, 1)} A que admite la entrada.` });
    else if (imp > m.imax) checks.push({ tone: "warn", text: `${label}: Imp de ${fmtNum(imp, 1)} A > ${fmtNum(m.imax, 1)} A de operación. El inversor recorta corriente.` });
    else checks.push({ tone: "ok", text: `${label}: Isc de ${fmtNum(isc, 1)} A ≤ ${fmtNum(m.isc, 1)} A de la entrada.` });
  });
  if (plan.overflow > 0) {
    const inputs = inv.mppts.reduce((n, m) => n + m.strings, 0);
    checks.push({ tone: "bad", text: `${plan.overflow === 1 ? "Sobra 1 string" : `Sobran ${plan.overflow} strings`}: el inversor acepta hasta ${inputs} en ${sizerPlural(inv.mppts.length, "MPPT", "MPPT")}.` });
  }
  checks.push({ tone: kwp <= inv.pvMax ? "ok" : "bad", text: `Potencia FV de ${fmtNum(kwp, 2)} kWp ${kwp <= inv.pvMax ? "≤" : ">"} ${fmtNum(inv.pvMax, 1)} kWp que admite el inversor.` });
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
  const array = sizerArrayChecks(plan, pan, inv, env);
  const bankChecks = sizerBankChecks(bat, nbPerInv, inv);
  const checks = [...array.checks, ...bankChecks, ...extraChecks];
  const n = plan.n * nInv;
  const nb = bat ? nbPerInv * nInv : 0;
  const kwp = (n * pan.w) / 1000;
  const lines = [
    sizerLine(n, pan, `${nInv > 1 ? `${nInv} × ` : ""}${sizerPlural(plan.s, "string", "strings")} de ${plan.ps} en serie`),
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
  const plan = sizerArrayPlan(target, pan, inv, env, inv.pvMax);

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
  r.free = { inv: inv.id, pan: pan.id, ps: String(plan.ps), s: String(plan.s), bat: nb ? bat.id : "", nb: String(nb || 1), est: est.id, tmin: String(loc.tmin), tmax: String(loc.tmax) };
  return r;
}

/* 1B · Personalizado: el usuario elige modelos; se calculan inversores, strings y módulos. */
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
  const env = sizerEnv(sizerNum(cu.tmin), sizerNum(cu.tmax));
  const crit = sizerNum(cu.crit);
  const area = sizerNum(cu.area);
  const ori = sizerNum(cu.ori) || 1;
  const backup = cu.goal !== "red";

  const kwpReq = (cons * frac) / (30 * hsp * SIZER_PR * ori);
  const nReq = Math.ceil((kwpReq * 1000) / pan.w);
  const nArea = Math.floor(area / pan.area);
  let nInv = Math.max(1, Math.ceil(kwpReq / inv.pvMax));
  if (backup) nInv = Math.max(nInv, Math.ceil(crit / inv.kw));
  const plan = sizerArrayPlan(Math.max(1, Math.ceil(Math.min(nReq, nArea) / nInv)), pan, inv, env, inv.pvMax);
  const n = plan.n * nInv;

  const kwh = cu.goal === "resp" ? (crit * 0.6 * sizerNum(cu.hours)) / SIZER_DOD
    : cu.goal === "aut" ? ((cons / 30) * sizerNum(cu.days)) / SIZER_DOD : 0;
  const nbPerInv = bat && kwh > 0 ? sizerBankAuto(bat, inv, kwh / nInv) : 0;

  const extra = [];
  extra.push({ tone: n <= nArea ? "ok" : "bad", text: `Superficie: ${n} paneles ocupan ${fmtNum(n * pan.area, 1)} m² de ${fmtNum(area)} m² libres.` });
  if (nReq > nArea) extra.push({ tone: "warn", text: `El techo limita: para el objetivo harían falta ${nReq} paneles.` });
  if (backup) extra.push({ tone: nInv * inv.kw >= crit ? "ok" : "bad", text: `Potencia AC de ${fmtNum(nInv * inv.kw)} kW para ${fmtNum(crit, 1)} kW de cargas críticas.` });
  if (inv.type !== "off" && cu.phase !== inv.phase) extra.push({ tone: "bad", text: "La fase del inversor no coincide con la conexión." });

  const notes = [{ tone: "info", text: `${cu.goal === "resp" ? "Respaldo calculado con el 60 % de las cargas críticas en promedio. " : ""}${nInv > 1 ? "Cada inversor lleva su propio arreglo y su propio banco de baterías." : ""}` }].filter((x) => x.text);
  if (plan.limited) notes.unshift({ tone: "warn", text: "Los strings quedaron en el máximo que permite la tensión del inversor; no entra toda la potencia buscada." });
  const r = sizerAssemble({ pan, inv, nInv, plan, env, bat, nbPerInv, est, extraChecks: extra, notes });
  r.gen = r.kwp * hsp * 30 * SIZER_PR * ori;
  r.coverage = (r.gen / cons) * 100;
  return r;
}

/* 2 · Libre: el usuario arma strings y banco; se verifica cada par de componentes. */
function sizerFreeResult(fr) {
  const inv = sizerById(SIZER_INVERTERS, fr.inv);
  const pan = sizerById(SIZER_PANELS, fr.pan);
  const est = sizerById(SIZER_STRUCTURES, fr.est);
  const ps = Math.max(0, Math.round(sizerNum(fr.ps)));
  const s = Math.max(0, Math.round(sizerNum(fr.s)));
  if (ps <= 0 || s <= 0) return { empty: "Indicá cuántos paneles van en serie por string y cuántos strings querés." };
  const bat = sizerById(SIZER_BATTERIES, fr.bat);
  const nb = bat ? Math.max(0, Math.round(sizerNum(fr.nb))) : 0;
  const env = sizerEnv(sizerNum(fr.tmin), sizerNum(fr.tmax));
  const plan = { ps, s, n: ps * s, limited: false, ...sizerAllocate(s, pan, inv) };
  return sizerAssemble({ pan, inv, nInv: 1, plan, env, bat, nbPerInv: nb, est });
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
  const inv = sizerById(SIZER_INVERTERS, cu.inv);
  const bats = sizerBatteriesFor(inv);
  const backup = cu.goal !== "red";
  const price = (x) => sizerMoney(x.usd, currency);
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
        ? sizerSelectHTML({ scope: s, field: "inv", label: "Inversor", value: cu.inv, hint: `${invs.length} ${invs.length === 1 ? "modelo compatible" : "modelos compatibles"} con el objetivo y la conexión.`,
          options: sizerOptions(invs, cu.inv, (x) => `${sizerItemName(x)}, ${x.kw} kW ${x.phase === "tri" ? "trifásico" : "monofásico"} (${price(x)})`) })
        : `<p class="field-hint">No hay inversores de ejemplo para esta combinación.</p>`}
      ${bats.length ? sizerSelectHTML({ scope: s, field: "bat", label: "Batería", value: cu.bat, hint: `Solo las de ${inv.bat === "HV" ? "alta tensión" : "48 V"}, como pide el inversor.`, options: sizerOptions(bats, cu.bat, (x) => `${sizerItemName(x)} (${price(x)})`) }) : ""}
    </fieldset>`;
}

function sizerFreeInputsHTML(fr, currency) {
  const s = "free";
  const inv = sizerById(SIZER_INVERTERS, fr.inv);
  const pan = sizerById(SIZER_PANELS, fr.pan);
  const bat = sizerById(SIZER_BATTERIES, fr.bat);
  const price = (x) => sizerMoney(x.usd, currency);
  const env = sizerEnv(sizerNum(fr.tmin), sizerNum(fr.tmax));
  const lim = sizerSeriesLimits(pan, inv, env);
  const inputs = inv.mppts.reduce((n, m) => n + m.strings, 0);
  const batOptions = [{ id: "", brand: "", name: "Sin batería", usd: 0 }, ...SIZER_BATTERIES.map((b) => ({ ...b, disabled: !inv || b.bus !== inv.bat }))];
  const range = bat && inv.batV ? sizerBankRange(bat, inv) : null;
  const batHint = !bat ? "Las que no coinciden con el inversor aparecen deshabilitadas."
    : bat.topo === "series" ? `Módulos HV: van en serie dentro de un rack. Con este inversor, de ${range.min} a ${range.max}.`
      : `Módulos de ${fmtNum(bat.vnom, 1)} V: van en paralelo. Hasta ${bat.max}.`;
  return `
    <p class="muted small">Vos armás los strings y el banco; verificamos la compatibilidad entre cada componente.</p>
    ${sizerSelectHTML({ scope: s, field: "inv", label: "Inversor", value: fr.inv, hint: `${sizerPlural(inv.mppts.length, "MPPT", "MPPT")}, hasta ${sizerPlural(inputs, "string", "strings")} en total.`,
      options: sizerOptions(SIZER_INVERTERS, fr.inv, (x) => `${sizerItemName(x)} (${price(x)})`) })}
    <fieldset class="sz-group">
      <legend>Arreglo fotovoltaico</legend>
      ${sizerSelectHTML({ scope: s, field: "pan", label: "Panel", value: fr.pan, options: sizerOptions(SIZER_PANELS, fr.pan, (x) => `${sizerItemName(x)} (${price(x)})`) })}
      <div class="sz-row">
        ${sizerNumberHTML({ scope: s, field: "ps", label: "Paneles en serie por string", value: fr.ps, min: 1, hint: `Entre ${lim.minPS} y ${lim.maxPS} para este inversor y estas temperaturas.` })}
        ${sizerNumberHTML({ scope: s, field: "s", label: "Cantidad de strings", value: fr.s, min: 1, hint: "Se reparten entre los MPPT; si sobran, van en paralelo." })}
      </div>
      ${sizerTempFieldsHTML(s, fr)}
    </fieldset>
    <fieldset class="sz-group">
      <legend>Baterías y estructura</legend>
      <div class="sz-row sz-row-qty">
        ${sizerSelectHTML({ scope: s, field: "bat", label: "Batería", value: fr.bat, hint: batHint,
          options: sizerOptions(batOptions, fr.bat, (x) => (x.id ? `${sizerItemName(x)} (${price(x)})` : x.name)) })}
        ${sizerNumberHTML({ scope: s, field: "nb", label: "Módulos", value: fr.nb, min: 0, disabled: !fr.bat })}
      </div>
      ${sizerSelectHTML({ scope: s, field: "est", label: "Estructura", value: fr.est, options: sizerOptions(SIZER_STRUCTURES, fr.est, (x) => `${x.name} (${price(x)} por panel)`) })}
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
      <span class="sz-mppt-strings">${k ? Array.from({ length: k }, () => sizerCellsHTML(plan.ps, "sz-cell")).join("") : `<span class="dim small">Libre</span>`}</span>
      <span class="sz-mppt-meta">${k ? `${sizerPlural(k, "string", "strings")}${k > 1 ? " en paralelo" : ""}` : ""}</span>
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
      <h5>Arreglo FV${nInv > 1 ? ` (por inversor, ${nInv} inversores)` : ""}</h5>
      <p><strong>${sizerPlural(plan.s, "string", "strings")} de ${plan.ps} paneles en serie</strong> (${plan.n} paneles). ${sizerWiringText(plan)}</p>
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

/* Mensaje de WhatsApp con el sistema armado, para pedir la cotización real. */
function sizerQuoteMessage(label, r, currency) {
  const c = r.config;
  const list = r.lines.map((l) => `- ${l.qty} x ${sizerItemName(l.item)}${l.note ? ` (${l.note})` : ""}`).join("\n");
  const wiring = `Arreglo: ${c.nInv > 1 ? `${c.nInv} inversores, cada uno con ` : ""}${sizerPlural(c.plan.s, "string", "strings")} de ${c.plan.ps} paneles en serie`;
  const bank = c.bank ? `\nBanco: ${sizerBankText(c.bank, c.bat)}` : "";
  return `Hola, armé un sistema con el dimensionador de Auryx (${label}):\n${list}\n${wiring}${bank}\nPotencia FV: ${fmtNum(r.kwp, 2)} kWp${r.storage ? `\nAlmacenamiento: ${fmtNum(r.storage, 1)} kWh` : ""}\nTotal de referencia: ${sizerMoney(r.total, currency)}\n¿Me pasan una cotización?`;
}

const SIZER_MODE_LABEL = { quick: "automático rápido", custom: "automático personalizado", free: "dimensionamiento libre" };

function sizerOutputHTML(sz, currency) {
  const kind = sz.tab === "free" ? "free" : sz.mode;
  const r = kind === "quick" ? sizerQuickResult(sz.quick) : kind === "custom" ? sizerCustomResult(sz.custom) : sizerFreeResult(sz.free);
  if (r.empty) {
    return `<div class="sz-empty">${icon("solar-panel")}<p>${r.empty}</p></div>`;
  }
  const title = kind === "quick" ? "Sistema sugerido" : kind === "custom" ? "Resultado" : "Compatibilidad";
  const badge = r.ok
    ? `<span class="badge tone-ok">${icon("check-circle", "", "fill")}${kind === "free" ? "Compatible" : "Todo cierra"}</span>`
    : `<span class="badge tone-bad">${icon("x-circle", "", "fill")}${kind === "free" ? "Incompatible" : "Revisar"}</span>`;

  const stats = [];
  if (r.coverage !== undefined) stats.push({ label: "Cobertura del consumo", value: `${fmtNum(Math.min(999, r.coverage))} %` });
  stats.push({ label: "Almacenamiento", value: r.storage ? `${fmtNum(r.storage, 1)} kWh` : `<span class="sz-none">Sin batería</span>` });
  stats.push({ label: "Relación DC/AC", value: fmtNum(r.ratio, 2) });

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
