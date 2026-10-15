/* AURYX: carrito, checkout (Mercado Pago) y estado del pedido. Depende de: utils/format.js, lib/api.js. */

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
        ${checkoutFormHTML(state)}
        <div class="checkout-alt">
          <a class="btn btn-secondary btn-block" href="${whatsappLink(quoteMessage(state))}" target="_blank" rel="noopener">${icon("whatsapp-logo", "", "fill")} Pedir cotización por WhatsApp</a>
          <button type="button" class="btn btn-ghost btn-block" style="margin-top:6px" data-action="cart-quote">Prefiero usar el formulario</button>
        </div>
        <p class="xsmall dim" style="margin-top:12px">Precios con IVA incluido. No incluyen envío ni instalación: los coordinamos con vos después del pedido. Tenés 10 días corridos para arrepentirte de la compra (<a href="#arrepentimiento">Botón de arrepentimiento</a>).</p>
      </aside>
    </div>
    <section class="process process-compact" aria-labelledby="cart-process-title">
      <h2 id="cart-process-title" class="process-title">Qué pasa cuando pedís la cotización</h2>
      ${processStepsHTML()}
    </section>
    ${techNoteHTML()}
  </div>`;
}

/* ---------------------------------------------------------------------------
   Checkout: los datos del cliente y el carrito van a POST /orders. El backend
   recalcula los precios y devuelve el link de pago de Mercado Pago (o guarda el
   pedido como cotización si el pago online no está habilitado).
   --------------------------------------------------------------------------- */
function cartCanPayOnline(cart) {
  return cart.length > 0 && cart.every((it) => dbIdOf(it.product));
}

function checkoutFormHTML(state) {
  const c = state.checkout || {};
  const errors = c.errors || {};
  const fieldError = (k) => errors[k] ? `<p id="checkout-${k}-error" class="field-error">${errors[k]}</p>` : "";
  const invalid = (k) => errors[k] ? `aria-invalid="true" aria-describedby="checkout-${k}-error"` : "";
  if (!cartCanPayOnline(state.cart)) {
    return `<p class="small muted">Tu carrito tiene productos de ejemplo: pedí la cotización y te pasamos el precio final.</p>`;
  }
  return `
  <form class="form checkout-form" data-form="checkout" novalidate>
    <h2 class="checkout-title">Datos para el pedido</h2>
    <div class="field">
      <label class="field-label" for="checkout-name">Nombre y apellido</label>
      <input id="checkout-name" class="input" name="name" autocomplete="name" value="${esc(c.name || "")}" data-bind="checkout" data-field="name" ${invalid("name")} />
      ${fieldError("name")}
    </div>
    <div class="field">
      <label class="field-label" for="checkout-email">Email</label>
      <input id="checkout-email" class="input" name="email" type="email" autocomplete="email" spellcheck="false" value="${esc(c.email || "")}" data-bind="checkout" data-field="email" ${invalid("email")} />
      ${fieldError("email")}
    </div>
    <div class="field">
      <label class="field-label" for="checkout-phone">Teléfono <span class="unit">(para coordinar el envío)</span></label>
      <input id="checkout-phone" class="input" name="tel" type="tel" autocomplete="tel" inputmode="tel" value="${esc(c.phone || "")}" data-bind="checkout" data-field="phone" />
    </div>
    ${c.status ? `<p class="form-status tone-${c.status.tone}" role="status">${esc(c.status.text)}</p>` : ""}
    <button type="submit" class="btn btn-primary btn-lg btn-block" ${c.sending ? "disabled" : ""}>
      ${icon("credit-card")} ${c.sending ? "Preparando el pago…" : "Pagar con Mercado Pago"}
    </button>
    <p class="xsmall dim">El pago lo procesa Mercado Pago: Auryx no ve ni guarda los datos de tu tarjeta. Al pagar aceptás los <a href="#terms">Términos</a>.</p>
  </form>`;
}

/* Agrupa el carrito por producto para el pedido (un sistema y un producto suelto pueden repetir ítem). */
function checkoutItems(cart) {
  const byId = new Map();
  cart.forEach((it) => {
    const id = dbIdOf(it.product);
    byId.set(id, (byId.get(id) || 0) + Number(it.qty));
  });
  return [...byId].map(([productId, qty]) => ({ productId, qty }));
}

/* Página de vuelta del pago (#pedido/<id>): consulta el estado a la API. */
const ORDER_STATUS_COPY = {
  pagado: { tone: "ok", icon: "check-circle", title: "¡Pago aprobado!", text: "Recibimos tu pago. En las próximas 48 h hábiles te contactamos para coordinar el envío y la instalación." },
  pendiente_pago: { tone: "warn", icon: "hourglass-medium", title: "Pago pendiente", text: "Mercado Pago todavía no confirmó el pago. Si pagaste en efectivo o por transferencia puede demorar; esta página se actualiza sola." },
  rechazado: { tone: "bad", icon: "x-circle", title: "El pago no se aprobó", text: "Mercado Pago rechazó el pago. Podés volver al carrito e intentar con otro medio, o escribirnos por WhatsApp." },
  cancelado: { tone: "bad", icon: "x-circle", title: "Pedido cancelado", text: "El pago se canceló o se devolvió. Si fue un error, escribinos." },
  cotizacion: { tone: "ok", icon: "chat-circle-text", title: "Recibimos tu pedido", text: "Lo guardamos como solicitud de cotización: te contactamos para confirmar precio, stock, envío e instalación." },
};

function renderOrder(state) {
  const o = state.order || {};
  if (o.error) {
    return `<div class="wrap page"><div class="empty" style="max-width:640px;margin-inline:auto">${icon("warning-circle")}
      <h1 class="page-title" style="font-size:1.75rem">No encontramos el pedido</h1><p>${esc(o.error)}</p>
      <a class="btn btn-secondary" href="${whatsappLink(`Hola, tengo una consulta por mi pedido ${o.id || ""}`)}" target="_blank" rel="noopener">${icon("whatsapp-logo", "", "fill")} Consultanos</a></div></div>`;
  }
  if (!o.data) {
    return `<div class="wrap page"><div class="empty" style="max-width:640px;margin-inline:auto">${icon("hourglass-medium")}
      <h1 class="page-title" style="font-size:1.75rem">Consultando tu pedido…</h1></div></div>`;
  }
  const d = o.data;
  const copy = ORDER_STATUS_COPY[d.status] || ORDER_STATUS_COPY.pendiente_pago;
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">${icon(copy.icon, `tone-text-${copy.tone}`, "fill")} ${esc(copy.title)}</h1>
      <p class="page-lead" role="status">${esc(copy.text)}</p>
      <p class="xsmall dim">Pedido <span class="mono">${esc(d.publicId)}</span>. Guardá este número por cualquier consulta.</p>
    </div>
    <div class="panel panel-pad" style="max-width:720px">
      <ul class="summary-lines" style="border-top:0;padding-top:0">
        ${d.items.map((i) => `<li><span class="name"><span class="mono">${i.quantity}×</span> ${esc(i.productName)}</span><span class="price">${fmtARS(i.unitPriceArs * i.quantity)}</span></li>`).join("")}
      </ul>
      <div class="summary-total"><span class="muted">Total</span><span class="price price-lg">${fmtARS(d.totalArs)}<small class="iva">IVA incluido</small></span></div>
    </div>
    <div class="hero-ctas" style="margin-top:24px">
      ${d.status === "rechazado" ? `<a href="#cart" class="btn btn-primary">Volver al carrito</a>` : `<a href="#store" class="btn btn-secondary">Seguir viendo productos</a>`}
      <a class="btn btn-secondary" href="${whatsappLink(`Hola, tengo una consulta por mi pedido ${d.publicId}`)}" target="_blank" rel="noopener">${icon("whatsapp-logo", "", "fill")} Consultar por WhatsApp</a>
    </div>
  </div>`;
}
