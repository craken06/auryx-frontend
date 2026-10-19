/* AURYX: configurador "Diseñá tu sistema". Depende de: data/products.js, lib/compatibilityEngine.js, lib/api.js, utils/format.js. */

/* ---------------------------------------------------------------------------
   Compatibilidad en el servidor (POST /compatibility/evaluate), en dos pedidos
   independientes, cada uno con su caché:
   - "conv": inversores o reguladores, y cables y protecciones. Depende del arreglo
     de paneles y NO del equipo elegido: elegir un inversor no lo vuelve a pedir.
   - "batt": baterías contra el equipo elegido (solo sistemas con batería).
   Mientras llega la primera respuesta, las opciones dicen "Verificando…" y no se
   pueden elegir: el motor local tiene menos reglas y el estado cambiaría al llegar.
   Si la API falla o no responde a tiempo, se usa el motor local
   (lib/compatibilityEngine.js). Sólo aplica al catálogo real (ids "db-").
   --------------------------------------------------------------------------- */
const CFG_COMPAT = {
  conv: { key: null, data: null, pendingKey: null },
  batt: { key: null, data: null, pendingKey: null },
};
const CFG_COMPAT_TIMEOUT_MS = 10000; // la base (Neon free) puede tardar unos segundos en despertar
const CFG_PENDING_EVAL = { status: "pending", messages: [] };
const DC_EXTRA_CATEGORIES = ["cable", "proteccion"];

function cfgTMin(cfg) {
  return Number.isFinite(cfg.tMinC) ? cfg.tMinC : COMPAT_PARAMS.tMinC;
}

function cfgConverterOptions(systemType) {
  return PRODUCTS.filter((p) => p.category === systemType.sourceCategory && (p.systemTypes || []).includes(systemType.id));
}

function cfgCompatRequest(cfg, slot) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const panelId = dbIdOf(PRODUCTS.find((p) => p.id === cfg.panelId));
  if (!systemType || !panelId) return null;
  const ids = (list) => list.map(dbIdOf).filter(Boolean);
  const base = {
    panel: { productId: panelId, qty: cfg.panelQty, wiring: cfg.wiring },
    systemVoltage: systemType.sourceCategory === "regulador" ? cfg.systemVoltage : undefined,
    tMinC: cfgTMin(cfg),
  };
  let body;
  if (slot === "conv") {
    body = { ...base, converterIds: ids(cfgConverterOptions(systemType)), extraIds: ids(PRODUCTS.filter((p) => DC_EXTRA_CATEGORIES.includes(p.category))) };
  } else {
    const converterId = dbIdOf(PRODUCTS.find((p) => p.id === cfg.converterId));
    if (!systemType.needsBattery || !converterId) return null;
    // sin la cantidad: la API devuelve minQty por batería, así cambiar la cantidad no vuelve a pedir
    body = { ...base, converterId, batteryIds: ids(PRODUCTS.filter((p) => p.category === "bateria")) };
  }
  return { key: JSON.stringify(body), body };
}

/* Estado del pedido `slot` para la configuración actual (y lo dispara si hace falta):
   { status: "ready", data } | { status: "pending" } | { status: "local" } (sin datos del servidor). */
function cfgServerCompat(cfg, slot) {
  const req = cfgCompatRequest(cfg, slot);
  if (!req) return { status: "local" };
  const c = CFG_COMPAT[slot];
  if (c.key === req.key) return c.data ? { status: "ready", data: c.data } : { status: "local" };
  if (c.pendingKey !== req.key) {
    c.pendingKey = req.key;
    const settle = (data) => {
      if (c.pendingKey !== req.key) return; // llegó tarde: el usuario ya cambió algo
      c.key = req.key; c.data = data; c.pendingKey = null;
      if (App.state.view !== "configurator" || App.state.cfgTool !== "steps") return;
      // Mientras se escribe una cantidad no se redibuja (se perdería el cursor):
      // lo hace el "change" del campo o el próximo clic
      const active = document.activeElement;
      if (active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) { App.renderPending = true; return; }
      App.deferRender();
    };
    apiRequest("/compatibility/evaluate", { method: "POST", body: req.body, timeoutMs: CFG_COMPAT_TIMEOUT_MS }).then(settle, (err) => {
      console.warn("Compatibilidad: se usa el motor local.", err.message);
      settle(null);
    });
  }
  return { status: "pending" };
}

function cfgEvalConverter(cfg, panel, converter) {
  if (!panel || !converter) return null;
  const id = dbIdOf(converter);
  if (id) {
    const server = cfgServerCompat(cfg, "conv");
    if (server.status === "pending") return CFG_PENDING_EVAL;
    if (server.status === "ready" && server.data.converters && id in server.data.converters) return server.data.converters[id];
  }
  return evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, converter, cfg.systemVoltage, cfgTMin(cfg));
}

/* Cantidad mínima de baterías con la que el banco es compatible (null = con ninguna), con el motor
   local. Mismo tope que MAX_BATTERY_QTY del motor de la API. */
const CFG_MAX_BATTERY_QTY = 8;
function cfgLocalMinBatteryQty(battery, converter, systemVoltage) {
  for (let q = 1; q <= CFG_MAX_BATTERY_QTY; q++) {
    const ev = evaluateBatteryToConverter(battery, q, converter, systemVoltage);
    if (ev && ev.status === "ok") return q;
  }
  return null;
}

/* Veredicto de una batería con minQty: cuántas unidades hacen falta (lo que depende de la cantidad,
   como la descarga frente a la potencia del inversor, se resuelve sumando baterías). */
function cfgEvalBattery(cfg, battery, converter) {
  if (!battery || !converter) return null;
  const id = dbIdOf(battery);
  // El servidor evalúa las baterías solo contra el equipo elegido: para otro equipo, motor local
  if (id && converter.id === cfg.converterId) {
    const server = cfgServerCompat(cfg, "batt");
    if (server.status === "pending") return CFG_PENDING_EVAL;
    const ev = server.status === "ready" && server.data.batteries ? server.data.batteries[id] : null;
    if (ev && ev.minQty !== undefined) return ev;
  }
  const ev = evaluateBatteryToConverter(battery, 1, converter, cfg.systemVoltage);
  return ev && { ...ev, minQty: cfgLocalMinBatteryQty(battery, converter, cfg.systemVoltage) };
}

/* Una batería es incompatible solo si no sirve con ninguna cantidad (p. ej. tensión fuera de rango). */
const cfgBatteryIncompatible = (ev) => !!ev && ev.status !== "pending" && ev.minQty == null;

/* Cables y protecciones de continua: solo con datos del servidor (null = sin verificación). */
function cfgEvalExtra(cfg, product) {
  const id = dbIdOf(product);
  if (!id) return null;
  const server = cfgServerCompat(cfg, "conv");
  return server.status === "ready" && server.data.extras ? server.data.extras[id] || null : null;
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
  // instalación y asesoría (opcional, se pide al final): un porcentaje de los equipos
  const installation = cfg.installation && lines.length ? installationPrice(lines) : null;
  const grandPriceARS = totalPriceARS + (installation ? installation.priceARS : 0);
  const grandPriceUSD = totalPriceUSD + (installation ? installation.priceUSD : 0);
  return { panel, converter, battery, extraLines, lines, totalPower, totalPriceARS, totalPriceUSD, installation, grandPriceARS, grandPriceUSD };
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
    case "converter": return !!converter && (!panelEval || panelEval.status === "ok");
    case "battery": return !!battery && (!batteryEval || (batteryEval.status !== "pending" && batteryEval.minQty != null && cfg.batteryQty >= batteryEval.minQty));
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

/* Compatible o no, sin término medio: lo que el motor marca para "revisar" (tensión fuera del
   MPPT, recorte por corriente, sobredimensionado, etc.) tampoco se puede elegir. */
const cfgIncompatible = (ev) => !!ev && (ev.status === "bad" || ev.status === "warning");

/* Motivos de una opción incompatible (null si se puede elegir). */
function cfgOptionMessages(ev) {
  return cfgIncompatible(ev) && ev.messages.length ? { label: "Por qué es incompatible", messages: ev.messages } : null;
}

/* Lo que va junto al precio: "Incompatible" en gris, "Verificando…" mientras llega la respuesta, y
   nada si es compatible (se puede elegir: no hace falta decirlo). */
function cfgOptionFlag(ev) {
  if (cfgIncompatible(ev)) return '<span class="option-flag">Incompatible</span>';
  return ev && ev.status === "pending" ? statusBadgeHTML("pending") : "";
}

/* Ninguna opción se puede elegir: en vez de una grilla gris sin salida, se ofrece armarlo a medida. */
function cfgNoneCompatibleHTML(what, waText) {
  return `<div class="cfg-none">${icon("info")}<p>Ninguna de las opciones de ${what} del catálogo es compatible con lo que elegiste.
    Probá con otra cantidad de paneles o con otra conexión, o <a href="${whatsappLink(waText)}" target="_blank" rel="noopener" data-context="configurador-sin-opciones">escribinos y lo armamos a medida</a>.</p></div>`;
}

/* Tarjeta de opción. Los motivos van en un "!" junto a la etiqueta, que los muestra al pasar el
   mouse, con el foco o con un toque. Está fuera del botón de la tarjeta: así funciona aunque la
   opción esté deshabilitada y tocarlo no la elige. */
function optionButtonHTML({ id, action, selected, disabled, busy, name, meta, side, msgs }) {
  const button = `
  <button type="button" class="option${msgs ? " has-info" : ""}" data-action="${action}" data-id="${esc(id)}" data-fid="${action}-${esc(id)}"
    aria-pressed="${selected}" ${disabled ? "disabled" : ""}${busy ? ' aria-busy="true"' : ""}>
    <span class="option-head"><span class="option-name">${name}</span></span>
    ${meta ? `<span class="option-meta mono">${meta}</span>` : ""}
    ${side ? `<span class="option-side">${side}</span>` : ""}
  </button>`;
  if (!msgs) return button;
  const tipId = `tip-${action}-${esc(id)}`;
  return `<div class="option-wrap">${button}
    <span class="option-info">
      <button type="button" class="info-btn" data-action="toggle-info" data-fid="info-${action}-${esc(id)}"
        aria-label="${msgs.label}" aria-describedby="${tipId}">!</button>
      <span class="info-tip" role="tooltip" id="${tipId}">${msgs.messages.map((m) => `<span>${esc(m)}</span>`).join("")}</span>
    </span>
  </div>`;
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
      name: esc(productTitle(p)),
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
    lead = "Las que no son compatibles con tu arreglo de paneles aparecen en gris: el \u201c!\u201d te dice por qué.";
    // Con batería, primero los equipos que tienen alguna batería compatible en el catálogo.
    // Con el motor local, para que el orden no cambie al elegir un equipo.
    const batteries = systemType.needsBattery ? PRODUCTS.filter((p) => p.category === "bateria") : [];
    const hasBattery = (c) => batteries.some((b) => cfgLocalMinBatteryQty(b, c, cfg.systemVoltage) != null);
    const converters = batteries.length
      ? cfgConverterOptions(systemType).map((c, i) => ({ c, i, ok: hasBattery(c) })).sort((a, b) => (b.ok - a.ok) || (a.i - b.i)).map((x) => x.c)
      : cfgConverterOptions(systemType);
    const convEvals = converters.map((c) => cfgEvalConverter(cfg, panel, c));
    const noneOk = convEvals.length && convEvals.every(cfgIncompatible);
    body = converters.length ? `${noneOk ? cfgNoneCompatibleHTML(isReg ? "regulador" : "inversor",
      `Hola, quiero armar un sistema ${systemType.name} con ${cfg.panelQty} paneles ${panel ? productTitle(panel) : ""} y no encontré ${isReg ? "regulador" : "inversor"} compatible en la web.`) : ""}<div class="option-list">${converters.map((c, i) => {
      const ev = convEvals[i];
      const bad = cfgIncompatible(ev);
      const pending = ev && ev.status === "pending";
      const microNote = isMicroinverter(c) ? `Microinversor: se usa uno por panel (${cfg.panelQty} unidades). ` : "";
      const desc = microNote + (c.description || "");
      return optionButtonHTML({
        id: c.id, action: "cfg-converter", selected: cfg.converterId === c.id, disabled: bad || pending, busy: pending,
        name: esc(productTitle(c)),
        meta: desc ? `<span class="option-meta-text">${esc(desc)}</span>` : "",
        side: `${priceTagHTML(c, cur)}${cfgOptionFlag(ev)}`,
        msgs: cfgOptionMessages(ev),
      });
    }).join("")}</div>` : emptyStepHTML(`No hay ${isReg ? "reguladores" : "inversores"} cargados para sistemas ${systemType.name}.`,
      `Hola, quiero armar un sistema ${systemType.name}. ¿Me ayudan a elegir ${isReg ? "el regulador" : "el inversor"}?`);
  } else if (key === "battery") {
    title = "Elegí la batería";
    lead = "Verificamos que la tensión de la batería sea compatible y que la descarga alcance para el equipo.";
    const batteries = PRODUCTS.filter((p) => p.category === "bateria");
    const battEvals = batteries.map((b) => cfgEvalBattery(cfg, b, converter));
    const noneOk = battEvals.length && battEvals.every(cfgBatteryIncompatible);
    const list = batteries.length ? `${noneOk ? cfgNoneCompatibleHTML("batería",
      `Hola, quiero armar un sistema ${systemType.name} con el inversor ${converter ? productTitle(converter) : ""} y no encontré batería compatible en la web.`) : ""}<div class="option-list">${batteries.map((b, i) => {
      const ev = battEvals[i];
      const bad = cfgBatteryIncompatible(ev);
      const pending = ev && ev.status === "pending";
      const flag = bad ? '<span class="option-flag">Incompatible</span>'
        : pending ? statusBadgeHTML("pending")
        : ev && ev.minQty > 1 ? `<span class="option-flag">Desde ${ev.minQty} unidades</span>` : "";
      return optionButtonHTML({
        id: b.id, action: "cfg-battery", selected: cfg.batteryId === b.id, disabled: bad || pending, busy: pending,
        name: esc(productTitle(b)),
        meta: esc(`${b.specs.nominalVoltage != null ? specValueText("nominalVoltage", b.specs.nominalVoltage) : "s/d"} / ${Number(b.specs.capacityWh) > 0 ? `${fmtNum(b.specs.capacityWh / 1000, 2)} kWh` : "capacidad s/d"}`),
        side: `${priceTagHTML(b, cur)}${flag}`,
        msgs: bad && ev.messages.length ? { label: "Por qué es incompatible", messages: ev.messages } : null,
      });
    }).join("")}</div>` : emptyStepHTML("No hay baterías cargadas en el catálogo.");
    const fields = battery ? `
      <div class="cfg-fields">
        <div class="field">
          <span class="field-label" id="battery-qty-label">Cantidad de baterías</span>
          <div class="stepper" role="group" aria-labelledby="battery-qty-label">
            <button type="button" class="icon-btn" data-action="cfg-battery-step" data-delta="-1" data-fid="battery-minus" aria-label="Restar una batería" ${cfg.batteryQty <= Math.max(1, (batteryEval && batteryEval.minQty) || 1) ? "disabled" : ""}>${icon("minus")}</button>
            <input id="battery-qty-input" class="input num-input" type="number" inputmode="numeric" min="1" value="${cfg.batteryQty}"
              name="battery-quantity" autocomplete="off" aria-labelledby="battery-qty-label" data-bind="cfg-battery-qty" />
            <button type="button" class="icon-btn" data-action="cfg-battery-step" data-delta="1" data-fid="battery-plus" aria-label="Sumar una batería">${icon("plus")}</button>
          </div>
        </div>
        <p class="total">Capacidad total: ${Number(battery.specs.capacityWh) > 0
          ? `<strong class="mono" id="battery-total-kwh">${fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2)}</strong>&nbsp;kWh`
          : `<strong id="battery-total-kwh">sin dato del fabricante</strong>`}</p>
        ${batteryEval && batteryEval.minQty > cfg.batteryQty ? `<p class="cfg-hint">Con este inversor hacen falta al menos ${batteryEval.minQty} baterías para entregar su potencia.</p>` : ""}
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
    lead = "Estos son los materiales de tu sistema. Si querés, sumá la instalación y agregalo al carrito.";
    const pct = Math.round(INSTALLATION_RATE * 100);
    const inst = totals.installation;
    body = `<div class="cfg-review">
      <div class="panel panel-pad">
        <h3 class="cfg-review-title">Lista de materiales</h3>
        <ul class="summary-lines summary-lines-flush">
          ${lines.map((l) => `<li><span class="name"><span class="mono">${l.qty}×</span> ${esc(productTitle(l.product))}</span>${priceTagHTML({ priceARS: l.product.priceARS * l.qty, priceUSD: l.product.priceUSD * l.qty }, cur)}</li>`).join("")}
          ${inst ? `<li class="summary-line-service"><span class="name">${icon("wrench")} ${INSTALLATION_LABEL} <span class="xsmall dim">(${pct} % de los equipos)</span></span>${priceTagHTML(inst, cur)}</li>` : ""}
        </ul>
        <div class="summary-total"><span class="muted">Total</span>${priceTagHTML({ priceARS: totals.grandPriceARS, priceUSD: totals.grandPriceUSD }, cur, "lg")}</div>
        <div class="cfg-install">
          ${inst
            ? `<button type="button" class="btn btn-secondary" data-action="cfg-installation" data-fid="cfg-installation" aria-pressed="true">${icon("x")} Quitar instalación y asesoría</button>`
            : `<button type="button" class="btn btn-secondary" data-action="cfg-installation" data-fid="cfg-installation" aria-pressed="false">${icon("wrench")} Pedir instalación y asesoría <span class="cfg-install-pct">+${pct} %</span></button>`}
          <p class="xsmall dim">Instalación por nuestro equipo y asesoría para el proyecto. Coordinamos la visita técnica después de la compra.</p>
        </div>
      </div>
      ${techNoteHTML()}
    </div>`;
  }

  // La compatibilidad se pide antes de llegar al paso que la muestra: al llegar ya está
  if (key === "panels" && panel) cfgServerCompat(cfg, "conv");
  if (converter && systemType && systemType.needsBattery) cfgServerCompat(cfg, "batt");

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
        </dl>` : ""}
      ${lines.length ? `
        <ul class="summary-lines">
          ${lines.map((l) => `<li><span class="name"><span class="mono">${l.qty}×</span> ${esc(l.product.name)}</span></li>`).join("")}
          ${totals.installation ? `<li><span class="name">${INSTALLATION_LABEL}</span></li>` : ""}
        </ul>
        <div class="summary-total"><span class="muted">Total <span class="xsmall dim">(IVA incluido)</span></span>${priceTagHTML({ priceARS: totals.grandPriceARS, priceUSD: totals.grandPriceUSD }, cur)}</div>
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
