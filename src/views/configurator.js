/* AURYX — Configurador 'Diseñá tu sistema'. Depende de: data/products.js, lib/compatibilityEngine.js, utils/format.js, utils/calculatorHelpers.js. */

/* ---------------------------------------------------------------------- */
/* CONFIGURADOR                                                            */
/* ---------------------------------------------------------------------- */
function configuratorSteps(cfg) {
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  if (!systemType) return ["Tipo de sistema", "Paneles", "Inversor", "Accesorios", "Resumen"];
  return systemType.needsBattery
    ? ["Tipo de sistema", "Paneles", systemType.sourceCategory === "regulador" ? "Regulador" : "Inversor", "Batería", "Accesorios", "Resumen"]
    : ["Tipo de sistema", "Paneles", "Inversor", "Accesorios", "Resumen"];
}

function stepHeaderHTML(steps, current) {
  return `<div class="flex items-center gap-2 mb-10 overflow-x-auto sf-scrollbar pb-2">
    ${steps.map((s, i) => `
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="sf-step-dot ${i < current ? "done" : i === current ? "current" : ""}">${i < current ? iconTag("check", 12) : i + 1}</div>
        <span class="text-xs whitespace-nowrap" style="color:${i === current ? "var(--white)" : "var(--text-dim)"}">${s}</span>
      </div>
      ${i < steps.length - 1 ? `<div class="w-6 h-px flex-shrink-0" style="background:var(--line)"></div>` : ""}
    `).join("")}
  </div>`;
}

function cfgTotals(cfg) {
  const panel = PRODUCTS.find((p) => p.id === cfg.panelId);
  const converter = PRODUCTS.find((p) => p.id === cfg.converterId);
  const battery = PRODUCTS.find((p) => p.id === cfg.batteryId);
  const extraLines = Object.entries(cfg.extras || {}).filter(([, q]) => q > 0).map(([id, q]) => ({ product: PRODUCTS.find((p) => p.id === id), qty: q }));
  const totalPower = panel ? panel.specs.pmax * cfg.panelQty : 0;
  const totalPriceARS = (panel ? panel.priceARS * cfg.panelQty : 0) + (converter ? converter.priceARS : 0) + (battery ? battery.priceARS * cfg.batteryQty : 0) + extraLines.reduce((s, l) => s + l.product.priceARS * l.qty, 0);
  const totalPriceUSD = (panel ? panel.priceUSD * cfg.panelQty : 0) + (converter ? converter.priceUSD : 0) + (battery ? battery.priceUSD * cfg.batteryQty : 0) + extraLines.reduce((s, l) => s + l.product.priceUSD * l.qty, 0);
  return { panel, converter, battery, extraLines, totalPower, totalPriceARS, totalPriceUSD };
}

function renderConfigurator(state) {
  const cfg = state.configurator;
  const systemType = SYSTEM_TYPES.find((s) => s.id === cfg.systemTypeId);
  const steps = configuratorSteps(cfg);
  const { panel, converter, battery, extraLines, totalPower, totalPriceARS, totalPriceUSD } = cfgTotals(cfg);

  const panelEval = converter ? evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, converter, cfg.systemVoltage) : null;
  const batteryEval = battery && converter ? evaluateBatteryToConverter(battery, cfg.batteryQty, converter, cfg.systemVoltage) : null;

  let stepBody = "";

  if (cfg.step === 0) {
    stepBody = `<div class="grid md:grid-cols-3 gap-4">
      ${SYSTEM_TYPES.map((s) => `
        <button onclick="App.cfgSelectSystemType('${s.id}')" class="sf-select-card p-5 text-left ${cfg.systemTypeId === s.id ? "selected" : ""}">
          ${iconTag(s.icon, 22, "--yellow")}
          <h3 class="font-semibold sf-display mb-1 mt-3">${s.name}</h3>
          <p class="text-sm" style="color:var(--text-mid)">${s.desc}</p>
        </button>`).join("")}
    </div>`;
  } else if (cfg.step === 1) {
    const panelButtons = PRODUCTS.filter((p) => p.category === "panel").map((p) => `
      <button onclick="App.cfgSelectPanel('${p.id}')" class="sf-select-card p-4 flex justify-between items-center ${cfg.panelId === p.id ? "selected" : ""}">
        <div>
          <p class="font-semibold sf-display">${p.name}</p>
          <p class="sf-mono text-xs mt-1" style="color:var(--text-mid)">Voc ${p.specs.voc}V · Isc ${p.specs.isc}A · ${p.specs.efficiency}% eficiencia</p>
        </div>
        ${priceTagHTML(p, state.currency)}
      </button>`).join("");

    let qtyBlock = "";
    if (panel) {
      const wiringField = (systemType.sourceCategory === "inversor" && cfg.panelQty > 1) ? `
        <div>
          <label class="text-sm font-medium block mb-1.5">Configuración del arreglo</label>
          <select onchange="App.cfgSet('wiring', this.value)" class="sf-input w-full">
            <option value="series" ${cfg.wiring === "series" ? "selected" : ""}>Todos en serie (1 string)</option>
            <option value="parallel" ${cfg.wiring === "parallel" ? "selected" : ""}>2 strings en paralelo</option>
          </select>
        </div>` : "";
      const voltageField = systemType.sourceCategory === "regulador" ? `
        <div>
          <label class="text-sm font-medium block mb-1.5">Tensión de sistema (batería)</label>
          <select onchange="App.cfgSet('systemVoltage', +this.value)" class="sf-input w-full">
            <option value="12" ${cfg.systemVoltage === 12 ? "selected" : ""}>12V</option>
            <option value="24" ${cfg.systemVoltage === 24 ? "selected" : ""}>24V</option>
          </select>
        </div>` : "";
      qtyBlock = `
      <div class="sf-card p-5 grid sm:grid-cols-2 gap-4 mt-6">
        <div>
          <label class="text-sm font-medium block mb-1.5">Cantidad de paneles</label>
          <div class="flex items-center gap-2">
            <button onclick="App.cfgPanelQtyStep(-1)" class="sf-btn-outline p-2">${iconTag("minus", 14)}</button>
            <input id="panel-qty-input" type="number" min="1" value="${cfg.panelQty}" oninput="App.cfgPanelQtyLive(this.value)" class="sf-input w-20 text-center" />
            <button onclick="App.cfgPanelQtyStep(1)" class="sf-btn-outline p-2">${iconTag("plus", 14)}</button>
          </div>
        </div>
        ${wiringField}${voltageField}
        <div class="sm:col-span-2 sf-mono text-xs pt-2 border-t" style="color:var(--text-mid);border-color:var(--line)">
          Potencia total del arreglo: <strong id="panel-total-power">${totalPower}</strong>W
        </div>
      </div>`;
    }
    stepBody = `<div class="space-y-4">${panelButtons}${qtyBlock}</div>`;
  } else if (cfg.step === 2) {
    const converters = PRODUCTS.filter((p) => p.category === systemType.sourceCategory && (p.systemTypes || []).includes(systemType.id));
    stepBody = `<div class="space-y-4">
      ${converters.map((c) => {
        const ev = evaluatePanelToConverter(panel, cfg.panelQty, cfg.wiring, c, cfg.systemVoltage);
        const disabled = ev && ev.status === "bad";
        return `
        <button ${disabled ? "disabled" : ""} onclick="App.cfgSelectConverter('${c.id}')" class="sf-select-card p-4 ${cfg.converterId === c.id ? "selected" : ""} ${disabled ? "disabled" : ""}">
          <div class="flex justify-between items-start gap-3">
            <div>
              <p class="font-semibold sf-display">${c.brand} ${c.name}</p>
              <p class="text-sm mt-1" style="color:var(--text-mid)">${c.description}</p>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">${priceTagHTML(c, state.currency)}${ev ? statusBadgeHTML(ev.status) : ""}</div>
          </div>
          ${ev && cfg.converterId === c.id ? `<ul class="mt-3 pt-3 border-t text-xs space-y-1" style="border-color:var(--line);color:var(--text-mid)">${ev.messages.map((m) => `<li>• ${m}</li>`).join("")}</ul>` : ""}
        </button>`;
      }).join("")}
    </div>`;
  } else if (cfg.step === 3 && systemType.needsBattery) {
    const batteries = PRODUCTS.filter((p) => p.category === "bateria");
    let batteryQtyBlock = "";
    if (battery) {
      batteryQtyBlock = `
      <div class="sf-card p-5">
        <label class="text-sm font-medium block mb-1.5">Cantidad de baterías</label>
        <div class="flex items-center gap-2">
          <button onclick="App.cfgBatteryQtyStep(-1)" class="sf-btn-outline p-2">${iconTag("minus", 14)}</button>
          <input id="battery-qty-input" type="number" min="1" value="${cfg.batteryQty}" oninput="App.cfgBatteryQtyLive(this.value)" class="sf-input w-20 text-center" />
          <button onclick="App.cfgBatteryQtyStep(1)" class="sf-btn-outline p-2">${iconTag("plus", 14)}</button>
        </div>
        <p class="sf-mono text-xs mt-3" style="color:var(--text-mid)">Capacidad total: <span id="battery-total-kwh">${((battery.specs.capacityWh * cfg.batteryQty) / 1000).toFixed(2)}</span> kWh</p>
      </div>`;
    }
    stepBody = `<div class="space-y-4">
      ${batteries.map((b) => {
        const ev = evaluateBatteryToConverter(b, cfg.batteryQty, converter, cfg.systemVoltage);
        const disabled = ev && ev.status === "bad";
        return `
        <button ${disabled ? "disabled" : ""} onclick="App.cfgSelectBattery('${b.id}')" class="sf-select-card p-4 ${cfg.batteryId === b.id ? "selected" : ""} ${disabled ? "disabled" : ""}">
          <div class="flex justify-between items-start gap-3">
            <div>
              <p class="font-semibold sf-display">${b.brand} ${b.name}</p>
              <p class="sf-mono text-xs mt-1" style="color:var(--text-mid)">${b.specs.nominalVoltage}V · ${(b.specs.capacityWh / 1000).toFixed(2)}kWh</p>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">${priceTagHTML(b, state.currency)}${ev ? statusBadgeHTML(ev.status) : ""}</div>
          </div>
          ${ev && cfg.batteryId === b.id ? `<ul class="mt-3 pt-3 border-t text-xs space-y-1" style="border-color:var(--line);color:var(--text-mid)">${ev.messages.map((m) => `<li>• ${m}</li>`).join("")}</ul>` : ""}
        </button>`;
      }).join("")}
      ${batteryQtyBlock}
    </div>`;
  } else if ((systemType.needsBattery && cfg.step === 4) || (!systemType.needsBattery && cfg.step === 3)) {
    const freeProducts = PRODUCTS.filter((p) => ["proteccion", "cable", "accesorio"].includes(p.category));
    stepBody = `<div class="space-y-3">
      <p class="text-sm mb-2" style="color:var(--text-mid)">Protecciones, cables y accesorios (opcional). Estos productos no tienen reglas de compatibilidad automáticas.</p>
      ${freeProducts.map((p) => `
        <div class="sf-card p-4 flex items-center justify-between gap-3">
          <div><p class="font-medium">${p.name}</p>${priceTagHTML(p, state.currency)}</div>
          <div class="flex items-center gap-2">
            <button onclick="App.cfgExtraStep('${p.id}', -1)" class="sf-btn-outline p-1.5">${iconTag("minus", 13)}</button>
            <span class="w-6 text-center sf-mono text-sm">${(cfg.extras && cfg.extras[p.id]) || 0}</span>
            <button onclick="App.cfgExtraStep('${p.id}', 1)" class="sf-btn-outline p-1.5">${iconTag("plus", 13)}</button>
          </div>
        </div>`).join("")}
    </div>`;
  } else if (cfg.step === steps.length - 1) {
    const lineItems = [];
    if (panel) lineItems.push(`<div class="flex justify-between"><span>${cfg.panelQty}× ${panel.name}</span>${priceTagHTML(panel, state.currency)}</div>`);
    if (converter) lineItems.push(`<div class="flex justify-between"><span>1× ${converter.name}</span>${priceTagHTML(converter, state.currency)}</div>`);
    if (battery) lineItems.push(`<div class="flex justify-between"><span>${cfg.batteryQty}× ${battery.name}</span>${priceTagHTML(battery, state.currency)}</div>`);
    extraLines.forEach((l) => lineItems.push(`<div class="flex justify-between"><span>${l.qty}× ${l.product.name}</span>${priceTagHTML(l.product, state.currency)}</div>`));

    const evalBlocks = [];
    if (panelEval) evalBlocks.push(`<div class="p-4 flex items-start gap-3 ${panelEval.status === "bad" ? "sf-badge-bad" : panelEval.status === "warning" ? "sf-badge-warn" : "sf-badge-ok"}">${statusBadgeHTML(panelEval.status)}<ul class="text-sm space-y-1">${panelEval.messages.map((m) => `<li>${m}</li>`).join("")}</ul></div>`);
    if (batteryEval) evalBlocks.push(`<div class="p-4 flex items-start gap-3 ${batteryEval.status === "bad" ? "sf-badge-bad" : batteryEval.status === "warning" ? "sf-badge-warn" : "sf-badge-ok"}">${statusBadgeHTML(batteryEval.status)}<ul class="text-sm space-y-1">${batteryEval.messages.map((m) => `<li>${m}</li>`).join("")}</ul></div>`);

    stepBody = `<div class="space-y-6">
      <div class="sf-card p-6">
        <p class="sf-mono text-xs mb-4" style="color:var(--yellow)">RESUMEN DEL SISTEMA</p>
        <div class="grid sm:grid-cols-3 gap-4 mb-6">
          <div><p class="text-xs" style="color:var(--text-dim)">Tipo de sistema</p><p class="font-semibold">${systemType.name}</p></div>
          <div><p class="text-xs" style="color:var(--text-dim)">Potencia FV instalada</p><p class="font-semibold sf-mono">${totalPower} W</p></div>
          ${systemType.needsBattery ? `<div><p class="text-xs" style="color:var(--text-dim)">Capacidad de almacenamiento</p><p class="font-semibold sf-mono">${battery ? ((battery.specs.capacityWh * cfg.batteryQty) / 1000).toFixed(2) : "0"} kWh</p></div>` : ""}
        </div>
        <div class="space-y-2 text-sm border-t pt-4" style="border-color:var(--line)">${lineItems.join("")}</div>
        <div class="flex justify-between items-center border-t pt-4 mt-4" style="border-color:var(--line)">
          <span class="font-semibold">Precio total</span>
          ${priceTagHTML({ priceARS: totalPriceARS, priceUSD: totalPriceUSD }, state.currency, "lg")}
        </div>
      </div>
      ${evalBlocks.length ? `<div class="space-y-2">${evalBlocks.join("")}</div>` : ""}
      <button onclick="App.cfgAddSystemToCart()" class="sf-btn-primary w-full py-3.5 flex items-center justify-center gap-2 font-semibold">${iconTag("shopping-cart", 18)} Añadir sistema completo al carrito</button>
    </div>`;
  }

  const canGoNext = [
    !!systemType,
    !!panel && cfg.panelQty > 0,
    !!converter && (!panelEval || panelEval.status !== "bad"),
    systemType && systemType.needsBattery ? !!battery && (!batteryEval || batteryEval.status !== "bad") : true,
    true,
  ][cfg.step];

  const isLast = cfg.step === steps.length - 1;

  return `
  <div class="max-w-4xl mx-auto px-5 py-12">
    <h1 class="sf-display text-3xl font-semibold mb-2">Diseñá tu sistema</h1>
    <p class="text-sm mb-8" style="color:var(--text-mid)">Elegí cada componente. Verificamos automáticamente la compatibilidad eléctrica entre ellos.</p>
    ${stepHeaderHTML(steps, cfg.step)}
    ${stepBody}
    <div class="flex justify-between mt-10">
      <button onclick="App.cfgBack()" ${cfg.step === 0 ? "disabled" : ""} class="sf-btn-outline px-4 py-2 flex items-center gap-1.5">${iconTag("chevron-left", 16)} Atrás</button>
      ${!isLast ? `<button onclick="App.cfgNext()" ${!canGoNext ? "disabled" : ""} class="sf-btn-primary px-5 py-2 flex items-center gap-1.5">Siguiente ${iconTag("chevron-right", 16)}</button>` : "<span></span>"}
    </div>
  </div>`;
}
