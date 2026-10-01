/* AURYX: Motor de compatibilidad (lógica de negocio pura, sin HTML/UI). Sin dependencias. */

/* =========================================================================
   AURYX: Motor de compatibilidad (v1 simplificada, sin corrección térmica)
   Reglas: potencia, tensión y corriente entre panel(es) y regulador/inversor,
   y entre batería e inversor/regulador.
   ========================================================================= */

function evaluatePanelToConverter(panel, qty, wiring, converter, systemVoltage) {
  if (!panel || !qty) return null;
  const seriesCount = wiring === "series" ? qty : Math.ceil(qty / 2);
  const stringCount = wiring === "series" ? 1 : 2;
  const totalVoc = +(panel.specs.voc * seriesCount).toFixed(1);
  const totalIsc = +(panel.specs.isc * stringCount).toFixed(1);
  const totalPower = panel.specs.pmax * qty;

  const isRegulator = converter.category === "regulador";
  const maxVoltage = converter.specs.maxPvVoltage;
  const maxPower = isRegulator
    ? converter.specs.maxPvPowerBySystemVoltage[systemVoltage]
    : converter.specs.maxPvPower;
  const maxCurrent = isRegulator
    ? converter.specs.ratedChargeCurrent
    : converter.specs.maxInputCurrentPerMppt;
  const nominalPower = isRegulator ? maxPower : converter.specs.ratedPowerAC;

  const messages = [];
  let status = "ok";

  if (totalVoc > maxVoltage) {
    status = "bad";
    messages.push(`Tensión total del arreglo (${totalVoc}V) supera la tensión máxima admitida (${maxVoltage}V). Riesgo de daño al equipo.`);
  }
  if (totalIsc > maxCurrent) {
    status = "bad";
    messages.push(`Corriente total (${totalIsc}A) supera la corriente máxima de entrada (${maxCurrent}A)${isRegulator ? "" : " por MPPT"}.`);
  }
  if (totalPower > maxPower) {
    status = "bad";
    messages.push(`Potencia total (${totalPower}W) supera la potencia FV máxima admitida (${maxPower}W).`);
  } else if (nominalPower && totalPower > nominalPower * 1.3 && status !== "bad") {
    status = "warning";
    messages.push(`El arreglo (${totalPower}W) está sobredimensionado respecto a la potencia nominal (${nominalPower}W). Es una práctica común, pero conviene revisarlo.`);
  }
  if (status === "ok") {
    messages.push(`Compatible: ${totalVoc}V / ${totalIsc}A / ${totalPower}W dentro de los rangos admitidos.`);
  }

  return { status, messages, totals: { totalVoc, totalIsc, totalPower, seriesCount, stringCount } };
}

function evaluateBatteryToConverter(battery, qty, converter, systemVoltage) {
  if (!battery || !qty) return null;
  const isRegulator = converter.category === "regulador";
  const messages = [];
  let status = "ok";

  if (isRegulator) {
    if (Math.round(battery.specs.nominalVoltage) !== systemVoltage) {
      status = "bad";
      messages.push(`La tensión nominal de la batería (${battery.specs.nominalVoltage}V) no coincide con la tensión de sistema elegida (${systemVoltage}V).`);
    }
  } else {
    const v = battery.specs.nominalVoltage;
    if (v < converter.specs.batteryVoltageMin || v > converter.specs.batteryVoltageMax) {
      status = "bad";
      messages.push(`La tensión nominal de la batería (${v}V) está fuera del rango admitido por el inversor (${converter.specs.batteryVoltageMin}-${converter.specs.batteryVoltageMax}V).`);
    }
  }

  const totalDischarge = (battery.specs.maxContinuousCurrent || battery.specs.maxDischargeCurrent) * qty * battery.specs.nominalVoltage;
  const requiredPower = isRegulator ? null : converter.specs.ratedPowerAC;
  if (requiredPower && totalDischarge < requiredPower && status !== "bad") {
    status = "warning";
    messages.push(`La potencia de descarga continua estimada del banco de baterías (~${Math.round(totalDischarge)}W) podría quedar justa frente a la potencia nominal del inversor (${requiredPower}W). Se recomienda sumar otra unidad.`);
  }
  if (status === "ok") messages.push("Compatible con la configuración elegida.");

  return { status, messages };
}

const STATUS_META = {
  ok: { icon: "check-circle", label: "Compatible", tone: "ok" },
  warning: { icon: "warning", label: "Compatible, revisar", tone: "warn" },
  bad: { icon: "x-circle", label: "No compatible", tone: "bad" },
};
