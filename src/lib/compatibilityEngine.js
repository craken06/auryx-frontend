/* AURYX: Motor de compatibilidad (lógica de negocio pura, sin HTML/UI). Sin dependencias. */

/* =========================================================================
   AURYX: Motor de compatibilidad LOCAL (respaldo)
   La evaluación real la hace el backend (POST /compatibility/evaluate, reglas
   en la tabla compatibility_rules). Esta versión simplificada se usa mientras
   llega la respuesta, si la API no responde o con el catálogo de demo.
   Aplica la misma corrección de Voc por temperatura mínima que el backend.
   ========================================================================= */

/* Número con unidad para los mensajes, igual que el resto del sitio: Intl es-AR (coma
   decimal, punto de miles) y espacio de no separación antes de la unidad ("52,3 V").
   Es un carácter, no "&nbsp;": los mensajes se escapan con esc() al mostrarse. */
const COMPAT_NF = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
function compatQty(n, unit) {
  const v = Number(n);
  return `${Number.isFinite(v) ? COMPAT_NF.format(v) : "s/d"} ${unit}`;
}

function evaluatePanelToConverter(panel, qty, wiring, converter, systemVoltage, tMinC) {
  if (!panel || !qty || !converter) return null;
  const isMicro = converter.specs.es_microinversor === true;
  const seriesCount = isMicro ? 1 : wiring === "series" ? qty : Math.ceil(qty / 2);
  const stringCount = isMicro ? 1 : wiring === "series" ? 1 : 2;
  // Corrientes por MPPT: con 2 strings y un equipo de 2 MPPT va un string por MPPT; sin el dato,
  // los dos en la misma entrada (como el motor de la API, src/compatibility/engine.ts).
  const mppts = Number.isInteger(Number(converter.specs.mpptCount)) && Number(converter.specs.mpptCount) > 0 ? Number(converter.specs.mpptCount) : 1;
  const stringsPerMppt = Math.ceil(stringCount / mppts);
  const tMin = Number.isFinite(tMinC) ? tMinC : (typeof COMPAT_PARAMS !== "undefined" ? COMPAT_PARAMS.tMinC : -10);
  const coef = panel.specs.coef_temp_voc != null ? Number(panel.specs.coef_temp_voc) : -0.3;
  const totalVoc = +(panel.specs.voc * seriesCount * (1 + (coef / 100) * (tMin - 25))).toFixed(1);
  const totalIsc = +(panel.specs.isc * stringsPerMppt).toFixed(1);
  const totalImp = panel.specs.imp != null ? +(panel.specs.imp * stringsPerMppt).toFixed(1) : null;
  const totalPower = panel.specs.pmax * qty;
  const checkedPower = isMicro ? panel.specs.pmax : totalPower; // micro: un panel por equipo

  const isRegulator = converter.category === "regulador";
  const maxVoltage = converter.specs.maxPvVoltage;
  const maxPower = isRegulator
    ? (converter.specs.maxPvPowerBySystemVoltage || {})[systemVoltage]
    : converter.specs.maxPvPower;
  const maxCurrent = isRegulator
    ? converter.specs.ratedChargeCurrent
    : converter.specs.maxInputCurrentPerMppt;
  const nominalPower = isRegulator || isMicro ? null : converter.specs.ratedPowerAC;

  const messages = [];
  let status = "ok";

  // Panel con datos en cero o sin cargar (p. ej. un producto de prueba): no se puede decir "Compatible".
  const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
  if (![panel.specs.voc, panel.specs.isc, panel.specs.pmax].every(positive)) {
    return { status: "warning", messages: ["Faltan datos del panel (potencia, Voc o Isc): no se pudo verificar la compatibilidad. Consultanos antes de comprar."], totals: { totalVoc, totalIsc, totalPower, seriesCount, stringCount } };
  }
  if (maxVoltage == null) {
    return { status: "warning", messages: ["Faltan datos del equipo (tensión FV máxima): no se pudo verificar la compatibilidad. Consultanos."], totals: { totalVoc, totalIsc, totalPower, seriesCount, stringCount } };
  }
  if (totalVoc > maxVoltage) {
    status = "bad";
    messages.push(`La tensión ${isMicro ? "de cada panel" : "del string"} en frío (${compatQty(totalVoc, "V")} a ${compatQty(tMin, "°C")}) supera la máxima admitida (${compatQty(maxVoltage, "V")}). Riesgo de daño al equipo.`);
  }
  // Con dato de cortocircuito del MPPT: Isc del arreglo vs. Isc máx. (límite duro) e
  // Imp vs. corriente de operación (si la supera, el inversor recorta: aviso, no bloqueo).
  // Sin ese dato (reguladores, catálogo de demo) se compara Isc contra la corriente de operación.
  const maxShortCircuit = isRegulator ? null : converter.specs.maxShortCircuitCurrentPerMppt;
  if (maxShortCircuit != null) {
    if (totalIsc > maxShortCircuit) {
      status = "bad";
      messages.push(`Corriente de cortocircuito del arreglo (${compatQty(totalIsc, "A")}) supera la máxima admitida por MPPT (${compatQty(maxShortCircuit, "A")}).`);
    } else if (totalImp != null && totalImp > maxCurrent) {
      if (status !== "bad") status = "warning";
      messages.push(`La corriente de trabajo (${compatQty(totalImp, "A")}) supera la corriente máxima de entrada por MPPT (${compatQty(maxCurrent, "A")}): el inversor va a recortar algo de potencia en horas pico.`);
    }
  } else if (maxCurrent != null && totalIsc > maxCurrent) {
    status = "bad";
    messages.push(`Corriente total (${compatQty(totalIsc, "A")}) supera la corriente máxima de entrada (${compatQty(maxCurrent, "A")})${isRegulator ? "" : " por MPPT"}.`);
  }
  if (maxPower != null && checkedPower > maxPower) {
    if (isMicro) { if (status !== "bad") status = "warning"; } else status = "bad";
    messages.push(isMicro
      ? `El panel (${compatQty(checkedPower, "W")}) supera la potencia recomendada para este microinversor (${compatQty(maxPower, "W")}): habrá recorte.`
      : `Potencia total (${compatQty(totalPower, "W")}) supera la potencia FV máxima admitida (${compatQty(maxPower, "W")}).`);
  } else if (nominalPower && totalPower > nominalPower * 1.3 && status !== "bad") {
    status = "warning";
    messages.push(`El arreglo (${compatQty(totalPower, "W")}) está sobredimensionado respecto a la potencia nominal (${compatQty(nominalPower, "W")}). Es una práctica común, pero conviene revisarlo.`);
  }
  if (status === "ok") {
    messages.push(`Compatible: ${compatQty(totalVoc, "V")} en frío / ${compatQty(totalIsc, "A")} / ${compatQty(totalPower, "W")} dentro de los rangos admitidos.`);
  }

  return { status, messages, totals: { totalVoc, totalIsc, totalPower, seriesCount, stringCount, converterQty: isMicro ? qty : 1 } };
}

function evaluateBatteryToConverter(battery, qty, converter, systemVoltage) {
  if (!battery || !qty) return null;
  const isRegulator = converter.category === "regulador";
  const messages = [];
  let status = "ok";

  // Productos reales sin tensión nominal cargada: no se puede validar, se avisa en vez de aprobar.
  if (battery.specs.nominalVoltage == null) {
    return { status: "warning", messages: ["Falta la tensión nominal de la batería en el catálogo: no se pudo verificar la compatibilidad con el equipo. Consultanos antes de comprar."] };
  }

  if (isRegulator) {
    if (Math.round(battery.specs.nominalVoltage) !== systemVoltage) {
      status = "bad";
      messages.push(`La tensión nominal de la batería (${compatQty(battery.specs.nominalVoltage, "V")}) no coincide con la tensión de sistema elegida (${compatQty(systemVoltage, "V")}).`);
    }
  } else {
    const v = battery.specs.nominalVoltage;
    if (v < converter.specs.batteryVoltageMin || v > converter.specs.batteryVoltageMax) {
      status = "bad";
      messages.push(`La tensión nominal de la batería (${compatQty(v, "V")}) está fuera del rango admitido por el inversor (${COMPAT_NF.format(converter.specs.batteryVoltageMin)} a ${compatQty(converter.specs.batteryVoltageMax, "V")}).`);
    }
  }

  const totalDischarge = (battery.specs.maxContinuousCurrent || battery.specs.maxDischargeCurrent) * qty * battery.specs.nominalVoltage;
  const requiredPower = isRegulator ? null : converter.specs.ratedPowerAC;
  if (requiredPower && totalDischarge < requiredPower && status !== "bad") {
    status = "warning";
    messages.push(`La potencia de descarga continua estimada del banco de baterías (~${compatQty(Math.round(totalDischarge), "W")}) podría quedar justa frente a la potencia nominal del inversor (${compatQty(requiredPower, "W")}). Se recomienda sumar otra unidad.`);
  }
  if (status === "ok") messages.push("Compatible con la configuración elegida.");

  return { status, messages };
}

const STATUS_META = {
  ok: { icon: "check-circle", label: "Compatible", tone: "ok" },
  warning: { icon: "warning", label: "Compatible, revisar", tone: "warn" },
  bad: { icon: "x-circle", label: "No compatible", tone: "bad" },
  pending: { icon: "circle-notch", label: "Verificando…", tone: "pending" }, // esperando al servidor
};
