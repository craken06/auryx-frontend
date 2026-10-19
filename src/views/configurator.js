/* AURYX: configurador "Diseñá tu sistema". Depende de: data/products.js, lib/compatibilityEngine.js, lib/api.js, utils/format.js. */

/* ---------------------------------------------------------------------------
   Compatibilidad en el servidor: en cada paso se pide en UNA llamada el
   veredicto de todas las opciones visibles (POST /compatibility/evaluate).
   Mientras llega la respuesta, o si la API no responde, se muestra el motor
   local (lib/compatibilityEngine.js). Sólo aplica al catálogo real (ids "db-").
   --------------------------------------------------------------------------- */
const CFG_COMPAT = { key: null, data: null, pendingKey: null };
const DC_EXTRA_CATEGORIES = ["cable", "proteccion"];

function cfgTMin(cfg) {
  return Number.isFinite(cfg.tMinC) ? cfg.tMinC : COMPAT_PARAMS.tMinC;
}

function cfgConverterOptions(systemType) {
  return PRODUCTS.filter((p) => p.category === systemType.sourceCategory && (p.systemTypes || []).includes(systemType.id));
}

function cfgCompatRequest(cfg) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const panel = PRODUCTS.find((p) => p.id === cfg.panelId);
  const panelId = dbIdOf(panel);
  if (!systemType || !panelId) return null;
  const converter = PRODUCTS.find((p) => p.id === cfg.converterId);
  const ids = (list) => list.map(dbIdOf).filter(Boolean);
  const body = {
    panel: { productId: panelId, qty: cfg.panelQty, wiring: cfg.wiring },
    converterIds: ids(cfgConverterOptions(systemType)),
    converterId: dbIdOf(converter),
    batteryIds: converter && systemType.needsBattery ? ids(PRODUCTS.filter((p) => p.category === "bateria")) : [],
    batteryQty: cfg.batteryQty,
    extraIds: ids(PRODUCTS.filter((p) => DC_EXTRA_CATEGORIES.includes(p.category))),
    systemVoltage: systemType.sourceCategory === "regulador" ? cfg.systemVoltage : undefined,
    tMinC: cfgTMin(cfg),
  };
  return { key: JSON.stringify(body), body };
}

/* Resultado del servidor para el estado actual, o null (y dispara el pedido si hace falta). */
function cfgServerCompat(cfg) {
  const req = cfgCompatRequest(cfg);
  if (!req) return null;
  if (CFG_COMPAT.key === req.key) return CFG_COMPAT.data;
  if (CFG_COMPAT.pendingKey !== req.key) {
    CFG_COMPAT.pendingKey = req.key;
    apiRequest("/compatibility/evaluate", { method: "POST", body: req.body, timeoutMs: 6000 })
      .then((data) => {
        if (CFG_COMPAT.pendingKey !== req.key) return; // llegó tarde: el usuario ya cambió algo
        CFG_COMPAT.key = req.key;
        CFG_COMPAT.data = data;
        if (App.state.view === "configurator" && App.state.cfgTool === "steps") App.render();
      })
      .catch((err) => {
        console.warn("Compatibilidad: se usa el motor local.", err.message);
        if (CFG_COMPAT.pendingKey === req.key) { CFG_COMPAT.key = req.key; CFG_COMPAT.data = null; }
      });
  }
  return null;
}

function cfgEvalConverter(cfg, panel, converter) {
  if (!panel || !converter) return null;
  const server = cfgServerCompat(cfg);
  const id = dbIdOf(converter);
  if (server && id && server.converters && id in server.converters) return server.converters[id];
  return evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, converter, cfg.systemVoltage, cfgTMin(cfg));
}

function cfgEvalBattery(cfg, battery, converter) {
  if (!battery || !converter) return null;
  const server = cfgServerCompat(cfg);
  const id = dbIdOf(battery);
  if (server && id && server.batteries && id in server.batteries) return server.batteries[id];
  return evaluateBatteryToConverter(battery, cfg.batteryQty, converter, cfg.systemVoltage);
}

/* Cables y protecciones de continua: solo con datos del servidor (null = sin verificación). */
function cfgEvalExtra(cfg, product) {
  const server = cfgServerCompat(cfg);
  const id = dbIdOf(product);
  return server && id && server.extras ? server.extras[id] || null : null;
}

const isMicroinverter = (p) => !!(p && p.specs && p.specs.es_microinversor === true);

/* Categorías del paso de accesorios: si no hay ninguno cargado, el paso no se muestra. */
const CFG_EXTRA_CATEGORIES = ["proteccion", "cable", "accesorio", "soporte"];
const cfgExtraProducts = () => PRODUCTS.filter((p) => CFG_EXTRA_CATEGORIES.includes(p.category));

/* Pasos como { key, label } según el tipo de sistema y lo que hay en el catálogo. */
function cfgStepList(cfg) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const list = [{ key: "type", label: "Tipo de sistema" }, { key: "panels", label: "Paneles" }];
  list.push({ key: "converter", label: systemType && systemType.sourceCategory === "regulador" ? "Regulador" : "Inversor" });
  if (systemType && systemType.needsBattery) list.push({ key: "battery", label: "Batería" });
  if (cfgExtraProducts().length) list.push({ key: "extras", label: "Accesorios" });
  list.push({ key: "summary", label: "Resumen" });
  return list;
}

function configuratorSteps(cfg) {
  return cfgStepList(cfg).map((s) => s.label);
}

/* Índice del paso por nombre lógico (evita comparar números mágicos). */
function cfgStepKey(cfg) {
  const step = cfgStepList(cfg)[cfg.step];
  return step ? step.key : "summary";
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
  if (converter) lines.push({ product: converter, qty: isMicroinverter(converter) ? cfg.panelQty : 1 });
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
  const panelEval = cfgEvalConverter(cfg, panel, converter);
  const batteryEval = cfgEvalBattery(cfg, battery, converter);
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
  const tone = (STATUS_META[ev.status] || STATUS_META.warning).tone;
  return `<div class="verdict tone-${tone}">
    <div class="verdict-head"><strong class="small">${title}</strong>${statusBadgeHTML(ev.status)}</div>
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

/* Paso sin productos en el catálogo: en vez de un callejón sin salida, se ofrece armarlo por WhatsApp. */
function emptyStepHTML(text, waText) {
  const msg = waText || "Hola, quiero armar un sistema solar y no encontré los equipos en el configurador.";
  return `<div class="empty">${icon("package")}<h3>Todavía no tenemos opciones para este paso</h3><p>${text} Armamos este sistema a medida: escribinos y te pasamos una propuesta.</p>
    <a href="${whatsappLink(msg)}" class="btn btn-primary" target="_blank" rel="noopener" data-context="configurador">${icon("whatsapp-logo", "", "fill")} Escribinos por WhatsApp</a></div>`;
}

/* Las dos formas de diseñar: el dimensionador (automático o libre, con catálogo de ejemplo)
   y el armado paso a paso con el catálogo real. Son links: cada una tiene su URL. */
function cfgToolSwitchHTML(active) {
  const tools = [
    { id: "sizer", href: "#configurator", icon: "magic-wand", label: "Dimensionador", hint: "Rápido o personalizado, a partir de tu consumo" },
    { id: "steps", href: "#configurator/paso-a-paso", icon: "list-numbers", label: "Paso a paso", hint: "Elegís cada componente del catálogo" },
  ];
  return `<nav class="tool-switch" aria-label="Forma de diseñar">
    ${tools.map((t) => `<a href="${t.href}" class="tool-switch-link"${t.id === active ? ' aria-current="page"' : ""}>
      ${icon(t.icon)}<span><strong>${t.label}</strong><small>${t.hint}</small></span>
    </a>`).join("")}
  </nav>`;
}

function renderSizerPage(state) {
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">Diseñá tu sistema</h1>
      <p class="page-lead">Contanos tu consumo y qué buscás. Te sugerimos paneles, inversor y batería, con cantidades y un precio orientativo.</p>
    </div>
    ${cfgToolSwitchHTML("sizer")}
    <div class="sizer-shell" id="sizer-root">${renderSizer(state.sizer, state.currency)}</div>
    <p class="xsmall dim sizer-foot">El dimensionador usa equipos de referencia para estimar el sistema. Para comprar con los equipos de la tienda, usá el <a href="#configurator/paso-a-paso">paso a paso</a> o pedinos la cotización.</p>
  </div>`;
}

/* Mini esquema conceptual de la instalación. La parte que se elige en el paso actual se pinta
   con el acento; las ya elegidas quedan en tono medio y las pendientes, tenues. */
function cfgSchematicHTML(cfg, systemType, totals, key) {
  const keys = cfgStepList(cfg).map((s) => s.key);
  const passed = (k) => keys.includes(k) && keys.indexOf(k) < cfg.step;
  const done = { dest: !!systemType, panels: !!totals.panel, converter: !!totals.converter, battery: !!totals.battery, extras: passed("extras") };
  const activeFor = { type: "dest", panels: "panels", converter: "converter", battery: "battery", extras: "extras" };
  const cls = (part) => `part${key === "summary" || activeFor[key] === part ? " is-active" : done[part] ? " is-done" : ""}`;

  const isReg = systemType && systemType.sourceCategory === "regulador";
  const hasBattery = !systemType || systemType.needsBattery;
  const hasGrid = !systemType || systemType.id !== "offgrid";
  const label = (x, y, text) => `<text x="${x}" y="${y}" text-anchor="middle">${text}</text>`;

  return `<figure class="cfg-schematic">
    <svg viewBox="0 0 320 168" aria-hidden="true" focusable="false">
      <g class="${cls("extras")}">
        <path d="M84 42 H110 V50 H130" />
        <path d="M170 50 H200" /><path d="M224 50 H252" />
        ${hasBattery ? `<path d="M150 74 V100" />` : ""}
        ${hasGrid ? `<path d="M276 72 V104" />` : ""}
        <rect class="body" x="200" y="38" width="24" height="24" rx="3" />
        <path d="M206 56 L218 44" /><circle cx="206" cy="56" r="1.6" /><circle cx="218" cy="56" r="1.6" />
        ${label(212, 80, "Protecciones")}
      </g>
      <g class="${cls("panels")}">
        <polygon class="body" points="12,62 28,22 92,22 76,62" />
        <path d="M20 42 H84" /><path d="M33.3 62 L49.3 22" /><path d="M54.7 62 L70.7 22" />
        <path d="M44 62 V72" /><path d="M36 72 H52" />
        ${label(50, 88, "Paneles")}
      </g>
      <g class="${cls("converter")}">
        <rect class="body" x="130" y="26" width="40" height="48" rx="4" />
        <path d="M134 70 L166 30" />
        <path d="M138 36 H148" /><path d="M138 40 H148" stroke-dasharray="2.5 1.5" />
        ${isReg
          ? `<path d="M152 60 H162" /><path d="M152 64 H162" stroke-dasharray="2.5 1.5" />`
          : `<path d="M151 62 q2.75 -5 5.5 0 t5.5 0" />`}
        ${label(150, 16, isReg ? "Regulador" : "Inversor")}
      </g>
      ${hasBattery ? `<g class="${cls("battery")}">
        <rect class="body" x="128" y="100" width="44" height="30" rx="3" />
        <path d="M138 100 V96 H146 V100" /><path d="M154 100 V96 H162 V100" />
        <path d="M139 115 H145" /><path d="M142 112 V118" /><path d="M155 115 H161" />
        ${label(150, 146, "Batería")}
      </g>` : ""}
      <g class="${cls("dest")}">
        <path class="body" d="M252 72 V48 L276 30 L300 48 V72 Z" />
        <rect x="270" y="56" width="12" height="16" />
        ${hasGrid ? `
          <path d="M276 104 L266 152 M276 104 L286 152 M269.5 135 H282.5 M264 112 H288 M266 120 H286" />
          ${label(276, 164, "Red")}` : ""}
        ${label(276, 22, hasGrid ? "Consumo" : "Consumos DC")}
      </g>
    </svg>
  </figure>`;
}

function renderConfigurator(state) {
  if (state.cfgTool !== "steps") return renderSizerPage(state);
  const cfg = state.configurator;
  const cur = state.currency;
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const steps = configuratorSteps(cfg);
  const key = cfgStepKey(cfg);
  const totals = cfgTotals(cfg);
  const { panel, converter, battery, lines, totalPower } = totals;

  const panelEval = cfgEvalConverter(cfg, panel, converter);
  const batteryEval = cfgEvalBattery(cfg, battery, converter);

  let title = "", lead = "", body = "";

  if (key === "type") {
    title = "¿Qué tipo de sistema querés armar?";
    lead = "Según el tipo, cambia el equipo que convierte la energía y si vas a necesitar baterías.";
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
        <div class="field">
          <label class="field-label" for="cfg-tmin">Temperatura mínima del lugar <span class="unit">(°C)</span></label>
          <input id="cfg-tmin" class="input num-input" type="number" inputmode="numeric" min="-40" max="30" step="1"
            value="${cfgTMin(cfg)}" name="min-temperature" autocomplete="off" data-bind="cfg-tmin" aria-describedby="cfg-tmin-hint" />
          <p id="cfg-tmin-hint" class="field-hint">Con frío la tensión de los paneles sube: la verificamos a esta temperatura. Si no la sabés, dejá ${COMPAT_PARAMS.tMinC} °C.</p>
        </div>
        <p class="total">Potencia total del arreglo: <strong class="mono" id="panel-total-power">${fmtNum(totalPower)}</strong>&nbsp;W</p>
      </div>`;
    }
    body = list + fields;
  } else if (key === "converter") {
    const isReg = systemType.sourceCategory === "regulador";
    title = isReg ? "Elegí el regulador de carga" : "Elegí el inversor";
    lead = "Las opciones que no soportan tu arreglo de paneles aparecen deshabilitadas, con el motivo.";
    // Con batería, primero los equipos que tienen alguna batería compatible en el catálogo
    const batteries = systemType.needsBattery ? PRODUCTS.filter((p) => p.category === "bateria") : [];
    const hasBattery = (c) => batteries.some((b) => { const ev = cfgEvalBattery(cfg, b, c); return !ev || ev.status !== "bad"; });
    const converters = batteries.length
      ? cfgConverterOptions(systemType).map((c, i) => ({ c, i, ok: hasBattery(c) })).sort((a, b) => (b.ok - a.ok) || (a.i - b.i)).map((x) => x.c)
      : cfgConverterOptions(systemType);
    body = converters.length ? `<div class="option-list">${converters.map((c) => {
      const ev = cfgEvalConverter(cfg, panel, c);
      const bad = ev && ev.status === "bad";
      const microNote = isMicroinverter(c) ? `Microinversor: se usa uno por panel (${cfg.panelQty} unidades). ` : "";
      const desc = microNote + (c.description || "");
      return optionButtonHTML({
        id: c.id, action: "cfg-converter", selected: cfg.converterId === c.id, disabled: bad,
        name: `${esc(c.brand)} ${esc(c.name)}`,
        meta: desc ? `<span class="option-meta-text">${esc(desc)}</span>` : "",
        side: `${priceTagHTML(c, cur)}${ev ? statusBadgeHTML(ev.status) : ""}`,
        msgs: ev && (bad || cfg.converterId === c.id) ? ev.messages : null,
      });
    }).join("")}</div>` : emptyStepHTML(`No hay ${isReg ? "reguladores" : "inversores"} cargados para sistemas ${systemType.name}.`,
      `Hola, quiero armar un sistema ${systemType.name}. ¿Me ayudan a elegir ${isReg ? "el regulador" : "el inversor"}?`);
  } else if (key === "battery") {
    title = "Elegí la batería";
    lead = "Verificamos que la tensión de la batería sea compatible y que la descarga alcance para el equipo.";
    const batteries = PRODUCTS.filter((p) => p.category === "bateria");
    const list = batteries.length ? `<div class="option-list">${batteries.map((b) => {
      const ev = cfgEvalBattery(cfg, b, converter);
      const bad = ev && ev.status === "bad";
      return optionButtonHTML({
        id: b.id, action: "cfg-battery", selected: cfg.batteryId === b.id, disabled: bad,
        name: `${esc(b.brand)} ${esc(b.name)}`,
        meta: esc(`${b.specs.nominalVoltage != null ? specValueText("nominalVoltage", b.specs.nominalVoltage) : "s/d"} / ${Number(b.specs.capacityWh) > 0 ? `${fmtNum(b.specs.capacityWh / 1000, 2)} kWh` : "capacidad s/d"}`),
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
        <p class="total">Capacidad total: ${Number(battery.specs.capacityWh) > 0
          ? `<strong class="mono" id="battery-total-kwh">${fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2)}</strong>&nbsp;kWh`
          : `<strong id="battery-total-kwh">sin dato del fabricante</strong>`}</p>
      </div>` : "";
    body = list + fields;
  } else if (key === "extras") {
    title = "Protecciones, cables y accesorios";
    lead = "Opcional. Los cables y protecciones de corriente continua se verifican contra tu string: tensión en frío y 1,25 × la corriente de cortocircuito.";
    const free = cfgExtraProducts();
    body = free.length ? `<div class="extra-grid">${free.map((p) => {
      const q = (cfg.extras && cfg.extras[p.id]) || 0;
      const ev = cfgEvalExtra(cfg, p);
      return `
      <div class="extra-row">
        <div class="extra-info"><p class="name">${esc(p.name)}</p>${priceTagHTML(p, cur)}${ev ? ` ${statusBadgeHTML(ev.status)}` : ""}
          ${ev && ev.status !== "ok" ? `<p class="xsmall muted">${ev.messages.map(esc).join(" ")}</p>` : ""}</div>
        <div class="stepper" role="group" aria-label="Cantidad de ${esc(p.name)}">
          <button type="button" class="icon-btn" data-action="cfg-extra-step" data-id="${esc(p.id)}" data-delta="-1" data-fid="x-${esc(p.id)}-m" aria-label="Restar uno" ${q <= 0 ? "disabled" : ""}>${icon("minus")}</button>
          <span class="stepper-value">${q}</span>
          <button type="button" class="icon-btn" data-action="cfg-extra-step" data-id="${esc(p.id)}" data-delta="1" data-fid="x-${esc(p.id)}-p" aria-label="Sumar uno">${icon("plus")}</button>
        </div>
      </div>`;
    }).join("")}</div>` : emptyStepHTML("No hay accesorios cargados en el catálogo.");
  } else if (key === "summary") {
    title = "Revisá tu sistema";
    lead = "Si todo está bien, agregalo al carrito para pagarlo o pedir la cotización.";
    body = `<div class="cfg-review">
      ${verdictHTML(panelEval, "Paneles e inversor")}
      ${verdictHTML(batteryEval, "Batería")}
      ${techNoteHTML()}
      <div class="panel panel-pad">
        <ul class="summary-lines summary-lines-flush">
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
      ${cfgSchematicHTML(cfg, systemType, totals, key)}
      <h2 class="summary-title">Tu sistema</h2>
      ${systemType ? `
        <dl class="summary-stats">
          <div><dt>Tipo</dt><dd class="dd-text">${systemType.name}</dd></div>
          <div><dt>Potencia FV</dt><dd>${fmtNum(totalPower)}&nbsp;W</dd></div>
          ${systemType.needsBattery ? `<div><dt>Almacenamiento</dt><dd>${battery && Number(battery.specs.capacityWh) > 0 ? `${fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2)}&nbsp;kWh` : battery ? "s/d" : "0&nbsp;kWh"}</dd></div>` : ""}
          ${panelEval ? `<div><dt>Compatibilidad</dt><dd>${statusBadgeHTML(worstStatus([panelEval, batteryEval]))}</dd></div>` : ""}
        </dl>` : ""}
      ${lines.length ? `
        <ul class="summary-lines">
          ${lines.map((l) => `<li><span class="name"><span class="mono">${l.qty}×</span> ${esc(l.product.name)}</span></li>`).join("")}
        </ul>
        <div class="summary-total"><span class="muted">Total <span class="xsmall dim">(IVA incluido)</span></span>${priceTagHTML({ priceARS: totals.totalPriceARS, priceUSD: totals.totalPriceUSD }, cur)}</div>
      ` :`<p class="summary-empty">Todavía no elegiste componentes. A medida que avances, el resumen se completa acá.</p>`}
      ${isLast ? `<button type="button" class="btn btn-primary btn-lg btn-block cfg-add" data-action="cfg-add-system">${icon("shopping-cart-simple")} Agregar al carrito</button>` : ""}
    </aside>`;

  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">Diseñá tu sistema</h1>
      <p class="page-lead">Elegí cada componente. Verificamos la compatibilidad eléctrica entre ellos en cada paso.</p>
    </div>
    ${cfgToolSwitchHTML("steps")}
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
