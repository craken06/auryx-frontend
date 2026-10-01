/* AURYX: carrito. Depende de: utils/format.js. */

function cartTotals(cart) {
  return {
    priceARS: cart.reduce((s, it) => s + it.product.priceARS * it.qty, 0),
    priceUSD: cart.reduce((s, it) => s + it.product.priceUSD * it.qty, 0),
    units: cart.reduce((s, it) => s + Number(it.qty), 0),
  };
}

/* Texto del pedido: lo usan el botón de WhatsApp y el formulario de contacto. */
function quoteMessage(state) {
  const t = cartTotals(state.cart);
  const lines = state.cart.map((it) => `- ${it.qty} x ${it.product.brand} ${it.product.name}`);
  const total = state.currency === "USD" ? fmtUSD(t.priceUSD) : fmtARS(t.priceARS);
  return `Hola, quiero pedir una cotización por:\n${lines.join("\n")}\n\nTotal estimado en la web: ${total} (IVA incluido)`;
}

function cartLineHTML({ product, qty, idx }, currency) {
  return `
  <div class="cart-line">
    ${productThumbHTML(product)}
    <div class="info">
      <a href="#product/${encodeURIComponent(product.id)}">${esc(product.name)}</a>
      <p class="xsmall dim">${esc(product.brand)}</p>
    </div>
    <div class="controls">
      <div class="stepper" role="group" aria-label="Cantidad de ${esc(product.name)}">
        <button type="button" class="icon-btn" data-action="cart-step" data-idx="${idx}" data-delta="-1" data-fid="cart-${idx}-m" aria-label="Restar uno" ${qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
        <span class="stepper-value">${qty}</span>
        <button type="button" class="icon-btn" data-action="cart-step" data-idx="${idx}" data-delta="1" data-fid="cart-${idx}-p" aria-label="Sumar uno">${icon("plus")}</button>
      </div>
      ${priceTagHTML({ priceARS: product.priceARS * qty, priceUSD: product.priceUSD * qty }, currency)}
      <button type="button" class="icon-btn icon-btn-danger" data-action="cart-remove" data-idx="${idx}" aria-label="Quitar ${esc(product.name)} del carrito">${icon("trash")}</button>
    </div>
  </div>`;
}

function renderCart(state) {
  const cart = state.cart;
  if (cart.length === 0) {
    return `
    <div class="wrap page">
      <div class="empty" style="max-width:640px;margin-inline:auto">
        ${icon("shopping-cart-simple")}
        <h1 class="page-title" style="font-size:1.75rem">Tu carrito está vacío</h1>
        <p>Agregá productos sueltos desde la tienda o armá un sistema completo con el configurador.</p>
        <div class="hero-ctas" style="justify-content:center">
          <a href="#configurator" class="btn btn-primary">Diseñar mi sistema</a>
          <a href="#store" class="btn btn-secondary">Ver productos</a>
        </div>
      </div>
    </div>`;
  }

  const t = cartTotals(cart);
  const groups = {};
  cart.forEach((it, idx) => {
    const key = it.systemId || "individual";
    (groups[key] = groups[key] || []).push({ ...it, idx });
  });
  const groupEntries = Object.entries(groups);
  let systemN = 0;

  const groupsHTML = groupEntries.map(([key, items]) => {
    const isSystem = key !== "individual";
    if (isSystem) systemN += 1;
    const title = isSystem
      ? `${icon("solar-panel")} Sistema configurado${groupEntries.filter(([k]) => k !== "individual").length > 1 ? ` ${systemN}` : ""}`
      : `${icon("package")} Productos sueltos`;
    return `<section class="cart-group" aria-label="${isSystem ? "Sistema configurado" : "Productos sueltos"}">
      <h2 class="cart-group-title">${title}</h2>
      ${items.map((it) => cartLineHTML(it, state.currency)).join("")}
    </section>`;
  }).join("");

  return `
  <div class="wrap page">
    <div class="page-head"><h1 class="page-title">Tu carrito</h1></div>
    <div class="cart-layout">
      <div>${groupsHTML}</div>
      <aside class="cart-aside panel panel-pad" aria-label="Resumen del pedido">
        <dl class="rows">
          <div><dt>Unidades</dt><dd class="mono">${t.units}</dd></div>
        </dl>
        <div class="summary-total" style="margin-bottom:20px"><span class="muted">Total estimado</span>${priceTagHTML(t, state.currency, "lg")}</div>
        <a class="btn btn-primary btn-lg btn-block" href="${whatsappLink(quoteMessage(state))}" target="_blank" rel="noopener">${icon("whatsapp-logo", "", "fill")} Pedir cotización por WhatsApp</a>
        <button type="button" class="btn btn-secondary btn-block" style="margin-top:10px" data-action="cart-quote">Prefiero usar el formulario</button>
        <p class="xsmall dim" style="margin-top:12px">Precios con IVA incluido. Todavía no procesamos pagos: te contactamos para confirmar precio, stock, envío e instalación.</p>
      </aside>
    </div>
    <section class="process process-compact" aria-labelledby="cart-process-title">
      <h2 id="cart-process-title" class="process-title">Qué pasa cuando pedís la cotización</h2>
      ${processStepsHTML()}
    </section>
    ${techNoteHTML()}
  </div>`;
}
