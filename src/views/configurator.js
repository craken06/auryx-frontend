/* AURYX: configurador "Diseñá tu sistema". Depende de: data/products.js, lib/compatibilityEngine.js, utils/format.js. */

function configuratorSteps(cfg) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  if (!systemType) return ["Tipo de sistema", "Paneles", "Inversor", "Accesorios", "Resumen"];
  return systemType.needsBattery
    ? ["Tipo de sistema", "Paneles", systemType.sourceCategory === "regulador" ? "Regulador" : "Inversor", "Batería", "Accesorios", "Resumen"]
    : ["Tipo de sistema", "Paneles", "Inversor", "Accesorios", "Resumen"];
}

/* Índice del paso por nombre lógico (evita comparar números mágicos). */
function cfgStepKey(cfg) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const keys = systemType && systemType.needsBattery
    ? ["type", "panels", "converter", "battery", "extras", "summary"]
    : ["type", "panels", "converter", "extras", "summary"];
  return keys[cfg.step];
}

function cfgTotals(cfg) {
  const panel = PRODUCTS.find((p) => p.id === cfg.panelId);
  const converter = PRODUCTS.find((p) => p.id === cfg.converterId);
  const battery = PRODUCTS.find((p) => p.id === cfg.batteryId);
  const extraLines = Object.entries(cfg.extras || {})
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ product: PRODUCTS.find((p) => p.id === id), qty: q }))
    .filter((l) => l.product);
  const lines = [];
  if (panel) lines.push({ product: panel, qty: cfg.panelQty });
  if (converter) lines.push({ product: converter, qty: 1 });
  if (battery) lines.push({ product: battery, qty: cfg.batteryQty });
  extraLines.forEach((l) => lines.push(l));
  const totalPower = panel ? panel.specs.pmax * cfg.panelQty : 0;
  const totalPriceARS = lines.reduce((s, l) => s + l.product.priceARS * l.qty, 0);
  const totalPriceUSD = lines.reduce((s, l) => s + l.product.priceUSD * l.qty, 0);
  return { panel, converter, battery, extraLines, lines, totalPower, totalPriceARS, totalPriceUSD };
}

/* Puede avanzar desde el paso actual? (misma regla que antes, por nombre de paso) */
function cfgCanAdvance(cfg) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const { panel, converter, battery } = cfgTotals(cfg);
  const panelEval = panel && converter ? evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, converter, cfg.systemVoltage) : null;
  const batteryEval = battery && converter ? evaluateBatteryToConverter(battery, cfg.batteryQty, converter, cfg.systemVoltage) : null;
  switch (cfgStepKey(cfg)) {
    case "type": return !!systemType;
    case "panels": return !!panel && cfg.panelQty > 0;
    case "converter": return !!converter && (!panelEval || panelEval.status !== "bad");
    case "battery": return !!battery && (!batteryEval || batteryEval.status !== "bad");
    default: return true;
  }
}

function stepsNavHTML(steps, current) {
  return `<ol class="steps" aria-label="Pasos del configurador">
    ${steps.map((s, i) => {
      const done = i < current;
      const inner = `<span class="step-dot">${done ? icon("check") : i + 1}</span>${s}`;
      if (done) return `<li><button type="button" class="step is-done" data-action="cfg-goto" data-step="${i}" data-fid="step-${i}" aria-label="Volver a ${s}">${inner}</button></li>`;
      return `<li><span class="step"${i === current ? ' aria-current="step"' : ""}>${inner}</span></li>`;
    }).join("")}
  </ol>`;
}

const STATUS_RANK = { ok: 0, warning: 1, bad: 2 };
function worstStatus(evals) {
  return evals.filter(Boolean).reduce((w, ev) => (STATUS_RANK[ev.status] > STATUS_RANK[w] ? ev.status : w), "ok");
}

function verdictHTML(ev, title) {
  if (!ev) return "";
  const tone = STATUS_META[ev.status].tone;
  return `<div class="verdict tone-${tone}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><strong class="small">${title}</strong>${statusBadgeHTML(ev.status)}</div>
    <ul>${ev.messages.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
  </div>`;
}

function optionButtonHTML({ id, action, selected, disabled, name, meta, side, msgs }) {
  return `
  <button type="button" class="option" data-action="${action}" data-id="${esc(id)}" data-fid="${action}-${esc(id)}"
    aria-pressed="${selected}" ${disabled ? "disabled" : ""}>
    <span class="option-head"><span class="option-name">${name}</span></span>
    ${meta ? `<span class="option-meta mono">${meta}</span>` : ""}
    ${side ? `<span class="option-side">${side}</span>` : ""}
    ${msgs && msgs.length ? `<span class="option-msgs">${msgs.map((m) => `<span>${esc(m)}</span>`).join("")}</span>` : ""}
  </button>`;
}

function emptyStepHTML(text) {
  return `<div class="empty">${icon("package")}<h3>Sin opciones disponibles</h3><p>${text}</p></div>`;
}

function renderConfigurator(state) {
  const cfg = state.configurator;
  const cur = state.currency;
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const steps = configuratorSteps(cfg);
  const key = cfgStepKey(cfg);
  const totals = cfgTotals(cfg);
  const { panel, converter, battery, lines, totalPower } = totals;

  const panelEval = panel && converter ? evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, converter, cfg.systemVoltage) : null;
  const batteryEval = battery && converter ? evaluateBatteryToConverter(battery, cfg.batteryQty, converter, cfg.systemVoltage) : null;

  let title = "", lead = "", body = "";

  if (key === "type") {
    title = "¿Qué tipo de sistema querés armar?";
    lead = "Define qué equipo convierte la energía y si vas a necesitar baterías.";
    body = `<div class="option-list cols-3">
      ${SYSTEM_TYPES.map((s) => `
        <button type="button" class="option" data-action="cfg-type" data-id="${s.id}" data-fid="cfg-type-${s.id}" aria-pressed="${cfg.systemTypeId === s.id}">
          ${icon(s.icon, "ph-type")}
          <span class="option-name">${s.name}</span>
          <span class="small muted">${s.desc}</span>
        </button>`).join("")}
    </div>`;
  } else if (key === "panels") {
    title = "Elegí los paneles";
    lead = "Después definí cuántos y cómo se conectan. La potencia total se actualiza al instante.";
    const panels = PRODUCTS.filter((p) => p.category === "panel");
    const list = panels.length ? `<div class="option-list">${panels.map((p) => optionButtonHTML({
      id: p.id, action: "cfg-panel", selected: cfg.panelId === p.id,
      name: `${esc(p.brand)} ${esc(p.name)}`,
      meta: esc([
        p.specs.pmax != null ? specValueText("pmax", p.specs.pmax) : p.specs.potencia_wp != null ? specValueText("potencia_wp", p.specs.potencia_wp) : null,
        p.specs.voc != null ? `Voc ${specValueText("voc", p.specs.voc)}` : null,
        p.specs.isc != null ? `Isc ${specValueText("isc", p.specs.isc)}` : null,
        p.specs.efficiency != null ? specValueText("efficiency", p.specs.efficiency) : null,
      ].filter(Boolean).join(" / ")),
      side: priceTagHTML(p, cur),
    })).join("")}</div>` : emptyStepHTML("No hay paneles cargados en el catálogo.");

    let fields = "";
    if (panel) {
      const wiringField = systemType.sourceCategory === "inversor" && cfg.panelQty > 1 ? `
        <label class="field">
          <span class="field-label">Conexión del arreglo</span>
          <select class="select" data-bind="cfg-wiring" name="wiring">
            <option value="series" ${cfg.wiring === "series" ? "selected" : ""}>Todos en serie (1 string)</option>
            <option value="parallel" ${cfg.wiring === "parallel" ? "selected" : ""}>2 strings en paralelo</option>
          </select>
        </label>` : "";
      const voltageField = systemType.sourceCategory === "regulador" ? `
        <label class="field">
          <span class="field-label">Tensión del sistema (batería)</span>
          <select class="select" data-bind="cfg-voltage" name="system-voltage">
            <option value="12" ${cfg.systemVoltage === 12 ? "selected" : ""}>12 V</option>
            <option value="24" ${cfg.systemVoltage === 24 ? "selected" : ""}>24 V</option>
          </select>
        </label>` : "";
      fields = `
      <div class="cfg-fields">
        <div class="field">
          <span class="field-label" id="panel-qty-label">Cantidad de paneles</span>
          <div class="stepper" role="group" aria-labelledby="panel-qty-label">
            <button type="button" class="icon-btn" data-action="cfg-panel-step" data-delta="-1" data-fid="panel-minus" aria-label="Restar un panel" ${cfg.panelQty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
            <input id="panel-qty-input" class="input num-input" type="number" inputmode="numeric" min="1" value="${cfg.panelQty}"
              name="panel-quantity" autocomplete="off" aria-labelledby="panel-qty-label" data-bind="cfg-panel-qty" />
            <button type="button" class="icon-btn" data-action="cfg-panel-step" data-delta="1" data-fid="panel-plus" aria-label="Sumar un panel">${icon("plus")}</button>
          </div>
        </div>
        ${wiringField}${voltageField}
        <p class="total">Potencia total del arreglo: <strong class="mono" id="panel-total-power">${fmtNum(totalPower)}</strong>&nbsp;W</p>
      </div>`;
    }
    body = list + fields;
  } else if (key === "converter") {
    const isReg = systemType.sourceCategory === "regulador";
    title = isReg ? "Elegí el regulador de carga" : "Elegí el inversor";
    lead = "Las opciones que no soportan tu arreglo de paneles aparecen deshabilitadas, con el motivo.";
    const converters = PRODUCTS.filter((p) => p.category === systemType.sourceCategory && (p.systemTypes || []).includes(systemType.id));
    body = converters.length ? `<div class="option-list">${converters.map((c) => {
      const ev = evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, c, cfg.systemVoltage);
      const bad = ev && ev.status === "bad";
      return optionButtonHTML({
        id: c.id, action: "cfg-converter", selected: cfg.converterId === c.id, disabled: bad,
        name: `${esc(c.brand)} ${esc(c.name)}`,
        meta: c.description ? `<span style="font-family:var(--font-sans)">${esc(c.description)}</span>` : "",
        side: `${priceTagHTML(c, cur)}${ev ? statusBadgeHTML(ev.status) : ""}`,
        msgs: ev && (bad || cfg.converterId === c.id) ? ev.messages : null,
      });
    }).join("")}</div>` : emptyStepHTML(`No hay ${isReg ? "reguladores" : "inversores"} cargados para sistemas ${systemType.name}.`);
  } else if (key === "battery") {
    title = "Elegí la batería";
    lead = "Verificamos que la tensión de la batería sea compatible y que la descarga alcance para el equipo.";
    const batteries = PRODUCTS.filter((p) => p.category === "bateria");
    const list = batteries.length ? `<div class="option-list">${batteries.map((b) => {
      const ev = evaluateBatteryToConverter(b, cfg.batteryQty, converter, cfg.systemVoltage);
      const bad = ev && ev.status === "bad";
      return optionButtonHTML({
        id: b.id, action: "cfg-battery", selected: cfg.batteryId === b.id, disabled: bad,
        name: `${esc(b.brand)} ${esc(b.name)}`,
        meta: `${specValueText("nominalVoltage", b.specs.nominalVoltage)} / ${fmtNum(b.specs.capacityWh / 1000, 2)} kWh`,
        side: `${priceTagHTML(b, cur)}${ev ? statusBadgeHTML(ev.status) : ""}`,
        msgs: ev && (bad || cfg.batteryId === b.id) ? ev.messages : null,
      });
    }).join("")}</div>` : emptyStepHTML("No hay baterías cargadas en el catálogo.");
    const fields = battery ? `
      <div class="cfg-fields">
        <div class="field">
          <span class="field-label" id="battery-qty-label">Cantidad de baterías</span>
          <div class="stepper" role="group" aria-labelledby="battery-qty-label">
            <button type="button" class="icon-btn" data-action="cfg-battery-step" data-delta="-1" data-fid="battery-minus" aria-label="Restar una batería" ${cfg.batteryQty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
            <input id="battery-qty-input" class="input num-input" type="number" inputmode="numeric" min="1" value="${cfg.batteryQty}"
              name="battery-quantity" autocomplete="off" aria-labelledby="battery-qty-label" data-bind="cfg-battery-qty" />
            <button type="button" class="icon-btn" data-action="cfg-battery-step" data-delta="1" data-fid="battery-plus" aria-label="Sumar una batería">${icon("plus")}</button>
          </div>
        </div>
        <p class="total">Capacidad total: <strong class="mono" id="battery-total-kwh">${fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2)}</strong>&nbsp;kWh</p>
      </div>` : "";
    body = list + fields;
  } else if (key === "extras") {
    title = "Protecciones, cables y accesorios";
    lead = "Opcional. Estos productos no tienen reglas de compatibilidad automáticas.";
    const free = PRODUCTS.filter((p) => ["proteccion", "cable", "accesorio", "soporte"].includes(p.category));
    body = free.length ? `<div class="panel panel-pad" style="padding-block:6px">${free.map((p) => {
      const q = (cfg.extras && cfg.extras[p.id]) || 0;
      return `
      <div class="extra-row">
        <div style="min-width:0"><p class="name">${esc(p.name)}</p>${priceTagHTML(p, cur)}</div>
        <div class="stepper" role="group" aria-label="Cantidad de ${esc(p.name)}">
          <button type="button" class="icon-btn" data-action="cfg-extra-step" data-id="${esc(p.id)}" data-delta="-1" data-fid="x-${esc(p.id)}-m" aria-label="Restar uno" ${q <= 0 ? "disabled" : ""}>${icon("minus")}</button>
          <span class="stepper-value">${q}</span>
          <button type="button" class="icon-btn" data-action="cfg-extra-step" data-id="${esc(p.id)}" data-delta="1" data-fid="x-${esc(p.id)}-p" aria-label="Sumar uno">${icon("plus")}</button>
        </div>
      </div>`;
    }).join("")}</div>` : emptyStepHTML("No hay accesorios cargados en el catálogo.");
  } else if (key === "summary") {
    title = "Revisá tu sistema";
    lead = "Si todo está bien, agregalo al carrito y pedí la cotización.";
    body = `<div style="display:grid;gap:12px">
      ${verdictHTML(panelEval, "Paneles e inversor")}
      ${verdictHTML(batteryEval, "Batería")}
      ${techNoteHTML()}
      <div class="panel panel-pad">
        <ul class="summary-lines" style="border-top:0;padding-top:0">
          ${lines.map((l) => `<li><span class="name"><span class="mono">${l.qty}×</span> ${esc(l.product.name)}</span>${priceTagHTML({ priceARS: l.product.priceARS * l.qty, priceUSD: l.product.priceUSD * l.qty }, cur)}</li>`).join("")}
        </ul>
        <div class="summary-total"><span class="muted">Total</span>${priceTagHTML({ priceARS: totals.totalPriceARS, priceUSD: totals.totalPriceUSD }, cur, "lg")}</div>
      </div>
    </div>`;
  }

  const canNext = cfgCanAdvance(cfg);
  const isLast = cfg.step === steps.length - 1;

  const summary = `
    <aside class="cfg-summary panel panel-pad" aria-label="Resumen del sistema">
      <h2 class="summary-title">Tu sistema</h2>
      ${systemType ? `
        <dl class="summary-stats">
          <div><dt>Tipo</dt><dd style="font-family:var(--font-sans)">${systemType.name}</dd></div>
          <div><dt>Potencia FV</dt><dd>${fmtNum(totalPower)}&nbsp;W</dd></div>
          ${systemType.needsBattery ? `<div><dt>Almacenamiento</dt><dd>${battery ? fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2) : "0"}&nbsp;kWh</dd></div>` : ""}
          ${panelEval ? `<div><dt>Compatibilidad</dt><dd>${statusBadgeHTML(worstStatus([panelEval, batteryEval]))}</dd></div>` : ""}
        </dl>` : ""}
      ${lines.length ? `
        <ul class="summary-lines">
          ${lines.map((l) => `<li><span class="name"><span class="mono">${l.qty}×</span> ${esc(l.product.name)}</span></li>`).join("")}
        </ul>
        <div class="summary-total"><span class="muted">Total <span class="xsmall dim">(IVA incl.)</span></span>${priceTagHTML({ priceARS: totals.totalPriceARS, priceUSD: totals.totalPriceUSD }, cur)}</div>
      ` :`<p class="summary-empty">Todavía no elegiste componentes. A medida que avances, el resumen se completa acá.</p>`}
      ${isLast ? `<button type="button" class="btn btn-primary btn-lg btn-block" style="margin-top:20px" data-action="cfg-add-system">${icon("shopping-cart-simple")} Agregar al carrito</button>` : ""}
    </aside>`;

  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">Diseñá tu sistema</h1>
      <p class="page-lead">Elegí cada componente. Verificamos la compatibilidad eléctrica entre ellos en cada paso.</p>
    </div>
    ${stepsNavHTML(steps, cfg.step)}
    <div class="cfg-layout">
      <section aria-labelledby="cfg-step-title">
        <h2 id="cfg-step-title" class="step-title" tabindex="-1">${title}</h2>
        <p class="step-lead">${lead}</p>
        ${body}
        <div class="cfg-nav">
          <button type="button" class="btn btn-secondary" data-action="cfg-back" data-fid="cfg-back" ${cfg.step === 0 ? "disabled" : ""}>${icon("caret-left")} Atrás</button>
          ${!isLast ? `<button type="button" class="btn btn-primary" data-action="cfg-next" data-fid="cfg-next" ${canNext ? "" : "disabled"}>Siguiente: ${steps[cfg.step + 1]} ${icon("caret-right")}</button>` : ""}
        </div>
      </section>
      ${summary}
    </div>
  </div>`;
}
