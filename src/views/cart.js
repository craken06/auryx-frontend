/* AURYX: carrito. Depende de: utils/format.js. */

function cartTotals(cart) {
  return {
    priceARS: cart.reduce((s, it) => s + it.product.priceARS * it.qty, 0),
    priceUSD: cart.reduce((s, it) => s + it.product.priceUSD * it.qty, 0),
    units: cart.reduce((s, it) => s + Number(it.qty), 0),
  };
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
          <div><dt>Moneda</dt><dd class="mono">${state.currency}</dd></div>
        </dl>
        <div class="summary-total" style="margin-bottom:20px"><span class="muted">Total estimado</span>${priceTagHTML(t, state.currency, "lg")}</div>
        <button type="button" class="btn btn-primary btn-lg btn-block" data-action="cart-quote">Solicitar cotización</button>
        <p class="xsmall dim" style="margin-top:12px">Todavía no procesamos pagos. Te contactamos para confirmar precio, stock e instalación.</p>
      </aside>
    </div>
  </div>`;
}
