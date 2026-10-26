/* AURYX: carrito, checkout (Mercado Pago) y estado del pedido. Depende de: utils/format.js, lib/api.js, lib/session.js; usa avatarHTML, googleSlotHTML y loginStatusHTML de views/account.js en tiempo de ejecución. */

function cartTotals(cart) {
  // instalación: un porcentaje de los equipos de los sistemas que la pidieron
  const installed = cart.filter((it) => it.installation);
  const installation = installed.length ? installationPrice(installed) : null;
  return {
    priceARS: cart.reduce((s, it) => s + it.product.priceARS * it.qty, 0) + (installation ? installation.priceARS : 0),
    priceUSD: cart.reduce((s, it) => s + it.product.priceUSD * it.qty, 0) + (installation ? installation.priceUSD : 0),
    units: cart.reduce((s, it) => s + Number(it.qty), 0),
    installation,
  };
}

/* Fila de la instalación al pie de un sistema del carrito: con precio y "Quitar", o la oferta de sumarla. */
function cartInstallationHTML(systemId, items, currency) {
  const pct = Math.round(INSTALLATION_RATE * 100);
  if (!items.some((it) => it.installation)) {
    return `<button type="button" class="cart-install-add" data-action="cart-installation" data-system="${esc(systemId)}" data-on="1">${icon("wrench")} Pedir instalación para este sistema <span class="cfg-install-pct">+${pct} %</span></button>`;
  }
  return `
  <div class="cart-line cart-line-service">
    <span class="thumb">${icon("wrench")}</span>
    <div class="info"><p class="name">${INSTALLATION_LABEL}</p><p class="xsmall dim">${pct} % de los equipos del sistema. Coordinamos la visita técnica después de la compra.</p></div>
    <div class="controls">
      ${priceTagHTML(installationPrice(items.filter((it) => it.installation)), currency)}
      <button type="button" class="icon-btn icon-btn-danger" data-action="cart-installation" data-system="${esc(systemId)}" data-on="0" aria-label="Quitar la instalación">${icon("trash")}</button>
    </div>
  </div>`;
}

function cartLineHTML({ product, qty, idx }, currency) {
  return `
  <div class="cart-line">
    ${productThumbHTML(product)}
    <div class="info">
      <a href="#product/${encodeURIComponent(product.id)}">${productTitleHTML(product)}</a>
      <p class="xsmall dim">${esc(product.brand)}</p>
    </div>
    <div class="controls">
      <div class="stepper" role="group" aria-label="Cantidad de ${esc(product.name)}: ${Number(qty)}">
        <button type="button" class="icon-btn" data-action="cart-step" data-idx="${idx}" data-delta="-1" data-fid="cart-${idx}-m" aria-label="Restar uno" ${qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
        <span class="stepper-value">${Number(qty)}</span>
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
      <div class="empty empty-narrow">
        ${icon("shopping-cart-simple")}
        <h1 class="page-title page-title-sm">Tu carrito está vacío</h1>
        <p>Agregá productos sueltos desde la tienda o armá un sistema completo con el configurador.</p>
        <div class="hero-ctas hero-ctas-center">
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
      ${isSystem ? cartInstallationHTML(key, items, state.currency) : ""}
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
        <div class="summary-total summary-total-spaced"><span class="muted">Total</span>${priceTagHTML(t, state.currency, "lg")}</div>
        ${checkoutFormHTML(state)}
        <p class="xsmall dim cart-note">Precios finales con IVA incluido. ${t.installation ? "No incluyen envío: lo coordinamos con vos después del pedido, igual que la visita técnica de la instalación." : "No incluyen envío ni instalación: los coordinamos con vos después del pedido."} Podés arrepentirte de la compra dentro de los ${REVOCATION_TERM} (<a href="#arrepentimiento">Botón de arrepentimiento</a>).</p>
      </aside>
    </div>
    <section class="process process-compact" aria-labelledby="cart-process-title">
      <h2 id="cart-process-title" class="process-title">Qué pasa después de tu pedido</h2>
      ${processStepsHTML()}
    </section>
    ${techNoteHTML()}
  </div>`;
}


/* ---------------------------------------------------------------------------
   Checkout: para comprar hace falta una cuenta. El nombre y el email salen de
   la cuenta; acá se piden teléfono, entrega y, si hace falta, la facturación.
   El backend recalcula los precios y devuelve el link de pago de Mercado Pago o,
   si se eligió transferencia, los datos bancarios y el plazo. Todo se paga online.
   --------------------------------------------------------------------------- */
function cartCanPayOnline(cart) {
  return cart.length > 0 && cart.every((it) => dbIdOf(it.product));
}

// Las 24 jurisdicciones, con la misma etiqueta exacta que valida la API.
const PROVINCES = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Ciudad Autónoma de Buenos Aires", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const emptyAddress = () => ({ street: "", floor: "", city: "", province: "", zip: "" });

/* touched = el usuario ya tipeó algo: la precarga desde la cuenta no lo pisa. */
function defaultCheckout() {
  return {
    phone: "", delivery: "envio", address: emptyAddress(),
    billingOpen: false, billingDoc: "", billingName: "", saveDetails: true, paymentMethod: "mercadopago",
    errors: {}, sending: false, slow: false, status: null, touched: false,
  };
}

/* Copia teléfono, dirección y facturación guardados en la cuenta a un formulario (checkout o Mis datos). */
function fillFromCustomer(form, customer) {
  const c = customer || {};
  const a = c.defaultAddress || {};
  form.phone = c.phone || "";
  form.address = { street: a.street || "", floor: a.floor || "", city: a.city || "", province: a.province || "", zip: a.zip || "" };
  form.billingDoc = c.billingDoc || "";
  form.billingName = c.billingName || "";
  if ("billingOpen" in form) form.billingOpen = !!(form.billingDoc || form.billingName);
}

/* Validaciones: las mismas reglas y mensajes que la API (customers/validation.ts).
   La API sigue siendo la que decide: si no está de acuerdo, se muestra su mensaje. */
const FORM_FIELD_ORDER = ["phone", "street", "floor", "city", "province", "zip", "billingDoc", "billingName"];
const trimStr = (v) => (typeof v === "string" ? v.trim() : "");

function phoneError(raw) {
  const digits = trimStr(raw).replace(/\D/g, "");
  return digits.length < 8 || digits.length > 15 ? "Revisá el teléfono: tiene que tener entre 8 y 15 números." : null;
}

function addressErrors(address) {
  const a = address || {};
  const errors = {};
  const street = trimStr(a.street);
  if (street.length < 3 || street.length > 120) errors.street = "Falta la calle y el número.";
  if (trimStr(a.floor).length > 40) errors.floor = "Revisá el piso o departamento: es demasiado largo.";
  const city = trimStr(a.city);
  if (city.length < 2 || city.length > 80) errors.city = "Falta la localidad.";
  if (!PROVINCES.includes(trimStr(a.province))) errors.province = "Elegí una provincia de la lista.";
  const zip = trimStr(a.zip).toUpperCase();
  if (!/^\d{4}$/.test(zip) && !/^[A-Z]\d{4}[A-Z]{3}$/.test(zip)) errors.zip = "Revisá el código postal: son 4 números (o el formato CPA, ej. C1425ABC).";
  return errors;
}

// CUIT/CUIL: pesos 5,4,3,2,7,6,5,4,3,2; verificador = 11 - (suma % 11), 11 → 0, 10 → inválido.
function isValidCuit(digits) {
  if (!/^\d{11}$/.test(digits)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((acc, p, i) => acc + p * Number(digits[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(digits[10]);
}

/* Facturación: los dos datos o ninguno. */
function billingErrors(rawDoc, rawName) {
  const docText = trimStr(rawDoc);
  const name = trimStr(rawName);
  const errors = {};
  if (!docText && !name) return errors;
  if (!docText) errors.billingDoc = "Falta el DNI o CUIT para la factura.";
  else {
    const doc = docText.replace(/\D/g, "");
    if (doc.length === 11) { if (!isValidCuit(doc)) errors.billingDoc = "Revisá el CUIT: el número no es válido."; }
    else if (doc.length < 7 || doc.length > 8) errors.billingDoc = "Revisá el documento: el DNI tiene 7 u 8 números y el CUIT 11.";
  }
  if (!name) errors.billingName = "Falta el nombre o razón social para la factura.";
  else if (name.length < 2 || name.length > 120) errors.billingName = "Revisá el nombre o razón social para la factura.";
  return errors;
}

const firstErrorField = (errors) => FORM_FIELD_ORDER.find((k) => errors[k]);

/* Dirección como la espera la API (piso vacío = null). */
function addressBody(a) {
  return { street: trimStr(a.street), floor: trimStr(a.floor) || null, city: trimStr(a.city), province: trimStr(a.province), zip: trimStr(a.zip).toUpperCase() };
}
const addressIsEmpty = (a) => !["street", "floor", "city", "province", "zip"].some((k) => trimStr(a && a[k]));

/* Campos de formulario compartidos por el checkout y Mis datos. prefix arma los id ("checkout-phone"),
   bind es el data-bind que los conecta con el estado. */
function formFieldKit(prefix, bind, errors) {
  const err = (k) => errors[k] ? `<p id="${prefix}-${k}-error" class="field-error">${esc(errors[k])}</p>` : "";
  const inv = (k) => errors[k] ? `aria-invalid="true" aria-describedby="${prefix}-${k}-error"` : "";
  const input = (k, label, value, attrs = "", group = "") => `
    <div class="field">
      <label class="field-label" for="${prefix}-${k}">${label}</label>
      <input id="${prefix}-${k}" class="input" name="${k}" value="${esc(value || "")}" data-bind="${bind}" data-field="${k}"${group ? ` data-group="${group}"` : ""} ${attrs} ${inv(k)} />
      ${err(k)}
    </div>`;
  return { err, inv, input };
}

function addressFieldsHTML(prefix, bind, address, errors) {
  const a = address || {};
  const { input, err, inv } = formFieldKit(prefix, bind, errors);
  const options = PROVINCES.map((p) => `<option value="${esc(p)}"${a.province === p ? " selected" : ""}>${esc(p)}</option>`).join("");
  return `
    ${input("street", "Calle y número", a.street, 'autocomplete="address-line1"', "address")}
    <div class="form-row form-row-tight">
      ${input("floor", 'Piso / depto <span class="unit">(opcional)</span>', a.floor, 'autocomplete="address-line2"', "address")}
      ${input("zip", "Código postal", a.zip, 'autocomplete="postal-code" spellcheck="false"', "address")}
    </div>
    ${input("city", "Localidad", a.city, 'autocomplete="address-level2"', "address")}
    <div class="field">
      <label class="field-label" for="${prefix}-province">Provincia</label>
      <select id="${prefix}-province" class="select" name="province" autocomplete="address-level1" data-bind="${bind}" data-field="province" data-group="address" ${inv("province")}>
        <option value=""${a.province ? "" : " selected"}>Elegí la provincia</option>${options}
      </select>
      ${err("province")}
    </div>`;
}

function billingFieldsHTML(prefix, bind, doc, name, errors) {
  const { input } = formFieldKit(prefix, bind, errors);
  return `
    ${input("billingDoc", 'DNI o CUIT <span class="unit">(solo números)</span>', doc, 'inputmode="numeric" autocomplete="off" spellcheck="false"')}
    ${input("billingName", "Nombre o razón social", name, 'autocomplete="off"')}`;
}

/* Línea de estado mientras se espera a la API: a los 5 s avisa que está tardando más de lo normal. */
function pendingStatusHTML(text, slow) {
  return `<p class="form-status login-status" role="status"><span class="spinner" aria-hidden="true"></span> ${slow ? "Está tardando más de lo normal, seguimos intentando…" : text}</p>`;
}

function checkoutFormHTML(state) {
  if (!cartCanPayOnline(state.cart)) {
    return `<div class="checkout-login">
      <p class="small muted">Algunos productos del carrito ya no están a la venta online. Quitalos para poder pagar el resto.</p>
      <button type="button" class="btn btn-secondary btn-block" data-action="cart-remove-unpayable">${icon("trash")} Quitar los que no se pueden comprar</button>
    </div>`;
  }
  const session = getSession();
  if (!session) {
    // Sin cuenta el carrito funciona igual; para pagar hay que ingresar (después se vuelve acá)
    const l = state.login || {};
    return `
    <div class="checkout-login">
      <h2 class="checkout-title">Ingresá para comprar</h2>
      <p class="small muted">Necesitás una cuenta para comprar. Usamos tu cuenta solo para identificarte y mostrarte tus pedidos. Tu carrito queda guardado.</p>
      ${googleSlotHTML(l)}
      ${loginStatusHTML(l)}
    </div>`;
  }

  const who = session.customer;
  const c = state.checkout;
  const errors = c.errors || {};
  const { input } = formFieldKit("checkout", "checkout", errors);
  const radio = (value, title, note) => `
      <label class="choice">
        <input type="radio" id="checkout-delivery-${value}" name="delivery" value="${value}" data-bind="checkout-delivery"${c.delivery === value ? " checked" : ""} />
        <span><strong>${title}</strong><small>${note}</small></span>
      </label>`;
  const methods = availablePaymentMethods(state.paymentMethods);
  const payMethod = methods.includes(c.paymentMethod) ? c.paymentMethod : methods[0];
  const transfer = (state.paymentMethods && state.paymentMethods.transferencia) || {};
  const payRadio = (value, title, note) => `
      <label class="choice">
        <input type="radio" id="checkout-pay-${value}" name="paymentMethod" value="${value}" data-bind="checkout-pay"${payMethod === value ? " checked" : ""} />
        <span><strong>${title}</strong><small>${note}</small></span>
      </label>`;
  const payChoice = methods.length > 1 ? `
    <fieldset class="field choice-group">
      <legend class="field-label">Forma de pago</legend>
      ${payRadio("mercadopago", "Mercado Pago", "tarjeta, débito, dinero en cuenta o efectivo")}
      ${payRadio("transferencia", `Transferencia bancaria${transfer.discountPct ? ` <span class="badge tone-ok">${Number(transfer.discountPct)} % off</span>` : ""}`, `te mostramos los datos; tenés ${transferDeadlineText(transfer.deadlineHours)} para pagar`)}
    </fieldset>` : "";
  const isTransfer = payMethod === "transferencia";
  const busyText = isTransfer ? "Confirmando el pedido…" : "Preparando el pago…";
  let status = "";
  if (c.sending) status = pendingStatusHTML(busyText, c.slow);
  else if (c.status) status = `<p class="form-status tone-${c.status.tone}" role="${c.status.tone === "bad" ? "alert" : "status"}">${esc(c.status.text)}</p>`;

  return `
  <form class="form checkout-form" data-form="checkout" novalidate>
    <h2 class="checkout-title">Datos para el pedido</h2>
    <div class="checkout-who">
      ${avatarHTML(who, 28)}
      <p class="small">Comprando como <strong>${esc(who.name || who.email || "")}</strong>${who.name && who.email ? ` <span class="dim">(${esc(who.email)})</span>` : ""} · ¿No sos vos? <button type="button" class="link-btn" data-action="logout" data-stay="1">Salir</button></p>
    </div>
    ${input("phone", 'Teléfono <span class="unit">(para coordinar la entrega)</span>', c.phone, 'type="tel" autocomplete="tel" inputmode="tel"')}
    <fieldset class="field choice-group">
      <legend class="field-label">Entrega</legend>
      ${radio("envio", "Envío", "costo a coordinar")}
      ${radio("retiro", "Retiro", "a coordinar")}
    </fieldset>
    ${c.delivery === "envio" ? addressFieldsHTML("checkout", "checkout", c.address, errors) : ""}
    <details class="checkout-billing" data-bind="checkout-billing"${c.billingOpen ? " open" : ""}>
      <summary>¿Necesitás la factura a nombre de otra persona o empresa?</summary>
      <div class="checkout-billing-body">${billingFieldsHTML("checkout", "checkout", c.billingDoc, c.billingName, errors)}</div>
    </details>
    <label class="check">
      <input type="checkbox" id="checkout-save" data-bind="checkout-save"${c.saveDetails ? " checked" : ""} />
      <span>Guardar estos datos para la próxima compra</span>
    </label>
    ${payChoice}
    ${status}
    <button type="submit" class="btn btn-primary btn-lg btn-block" ${c.sending || !methods.length ? "disabled" : ""}>
      ${icon(isTransfer ? "bank" : "credit-card")} ${c.sending ? busyText : isTransfer ? "Confirmar pedido por transferencia" : "Pagar con Mercado Pago"}
    </button>
    ${!methods.length ? `<p class="small muted">El pago online no está disponible en este momento. Probá en un rato.</p>` : ""}
    <p class="xsmall dim">${isTransfer
      ? `Al confirmar te mostramos los datos para transferir${transfer.discountPct ? `, con el ${Number(transfer.discountPct)} % de descuento aplicado` : ""}. Al confirmar aceptás los <a href="#terms">Términos</a>.`
      : `El pago lo procesa Mercado Pago: Auryx no ve ni guarda los datos de tu tarjeta. Al pagar aceptás los <a href="#terms">Términos</a>.`}</p>
  </form>`;
}

/* Medios habilitados según GET /payments/methods. Mientras no llega, se asume Mercado Pago (lo de siempre). */
function availablePaymentMethods(pm) {
  if (!pm) return ["mercadopago"];
  return [pm.mercadopago ? "mercadopago" : null, pm.transferencia && pm.transferencia.enabled ? "transferencia" : null].filter(Boolean);
}

function transferDeadlineText(hours) {
  const h = Number(hours) || 72;
  return h % 24 === 0 ? `${h / 24} día${h / 24 > 1 ? "s" : ""}` : `${h} h`;
}

/* Errores del checkout del lado del sitio ({} si está todo bien). */
function checkoutErrors(c) {
  const errors = {};
  const phone = phoneError(c.phone);
  if (phone) errors.phone = phone;
  if (c.delivery === "envio") Object.assign(errors, addressErrors(c.address));
  if (c.billingOpen) Object.assign(errors, billingErrors(c.billingDoc, c.billingName));
  return errors;
}

/* Cuerpo de POST /orders. La facturación va solo si se abrió y se completó. */
function checkoutBody(c, cart) {
  const body = {
    items: checkoutItems(cart),
    // la API cobra la instalación sobre estos equipos, con sus precios
    ...(cart.some((it) => it.installation) ? { installation: checkoutItems(cart.filter((it) => it.installation)) } : {}),
    phone: trimStr(c.phone),
    delivery: { method: c.delivery },
    saveDetails: !!c.saveDetails,
    paymentMethod: c.paymentMethod === "transferencia" ? "transferencia" : "mercadopago",
  };
  if (c.delivery === "envio") body.delivery.address = addressBody(c.address);
  if (c.billingOpen && (trimStr(c.billingDoc) || trimStr(c.billingName))) {
    body.billing = { doc: trimStr(c.billingDoc), name: trimStr(c.billingName) };
  }
  return body;
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

/* ---------------------------------------------------------------------------
   Pedidos: estados, etiquetas y la página #pedido/<código o id>.
   --------------------------------------------------------------------------- */
const ORDER_CODE_RE = /^AX-[A-Z0-9]{6}$/i;
const isOrderCode = (id) => ORDER_CODE_RE.test(id || "");

const PAYMENT_LABELS = {
  pendiente_pago: { label: "Pendiente de pago", tone: "warn" },
  pagado: { label: "Pagado", tone: "ok" },
  rechazado: { label: "Rechazado", tone: "bad" },
  cancelado: { label: "Cancelado", tone: "bad" },
  cotizacion: { label: "Cotización", tone: "muted" },
};
const FULFILLMENT_LABELS = {
  pendiente: { label: "Pendiente", tone: "muted" },
  preparando: { label: "Preparando", tone: "warn" },
  enviado: { label: "Enviado", tone: "ok" },
  listo_para_retirar: { label: "Listo para retirar", tone: "ok" },
  entregado: { label: "Entregado", tone: "ok" },
};
const DELIVERY_LABELS = { envio: "Envío (costo a coordinar)", retiro: "Retiro (a coordinar)" };

function orderBadgeHTML(map, status) {
  const it = map[status] || { label: status || "—", tone: "muted" };
  return `<span class="badge tone-${it.tone}">${esc(it.label)}</span>`;
}

function fmtOrderDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/* Solo se abre un link de pago https de Mercado Pago: si la API devolviera otro dominio, no hay botón. */
const PAYMENT_HOSTS = ["mercadopago.com", "mercadopago.com.ar", "mercadolibre.com", "mercadolibre.com.ar"];
function safePaymentUrl(url) {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const allowed = PAYMENT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return u.protocol === "https:" && allowed ? u.href : null;
  } catch (e) {
    return null;
  }
}

/* "Producto… y 2 productos más" */
function orderSummaryText(items) {
  const list = items || [];
  if (!list.length) return "";
  const rest = list.length - 1;
  return `${list[0].productName}${rest ? ` y ${rest} producto${rest > 1 ? "s" : ""} más` : ""}`;
}

function orderWhatsappText(code) { return `Hola, tengo una consulta por mi pedido ${code}`; }

/* Página de vuelta del pago (#pedido/<id>): consulta el estado a la API. */
const ORDER_STATUS_COPY = {
  pagado: { tone: "ok", icon: "check-circle", title: "¡Pago aprobado!", text: "Recibimos tu pago. En las próximas 48 h hábiles te contactamos para coordinar el envío y la instalación." },
  pagado_retiro: { tone: "ok", icon: "check-circle", title: "¡Pago aprobado!", text: "Recibimos tu pago. En las próximas 48 h hábiles te contactamos para coordinar el retiro." },
  pendiente_pago: { tone: "warn", icon: "hourglass-medium", title: "Pago pendiente", text: "Mercado Pago todavía no confirmó el pago. Si pagaste en efectivo o por transferencia puede demorar; esta página se actualiza sola." },
  rechazado: { tone: "bad", icon: "x-circle", title: "El pago no se aprobó", text: "Mercado Pago rechazó el pago. Podés volver al carrito e intentar con otro medio, o escribirnos por WhatsApp." },
  cancelado: { tone: "bad", icon: "x-circle", title: "Pedido cancelado", text: "El pago se canceló o se devolvió. Si fue un error, escribinos." },
  cotizacion: { tone: "ok", icon: "chat-circle-text", title: "Recibimos tu pedido", text: "Lo guardamos como solicitud de cotización: te contactamos para confirmar precio, stock, envío e instalación." },
  transferencia: { tone: "warn", icon: "bank", title: "Esperando tu transferencia", text: "Transferí el monto exacto a la cuenta de abajo antes del plazo y subí el comprobante. Cuando verifiquemos la acreditación te avisamos por mail." },
  transferencia_revision: { tone: "warn", icon: "hourglass-medium", title: "Comprobante en revisión", text: "Recibimos tu comprobante. Cuando verifiquemos la acreditación te confirmamos el pago por mail (en general, dentro del día hábil)." },
  transferencia_vencida: { tone: "bad", icon: "x-circle", title: "El plazo para transferir venció", text: "El pedido se canceló porque no recibimos la transferencia a tiempo. Si ya pagaste, escribinos; si no, podés hacer el pedido de nuevo." },
};

function orderStatusCopy(d) {
  if (d.paymentMethod === "transferencia") {
    if (d.status === "pendiente_pago") return ORDER_STATUS_COPY[d.transfer && d.transfer.receiptUploaded ? "transferencia_revision" : "transferencia"];
    if (d.status === "cancelado") return ORDER_STATUS_COPY.transferencia_vencida;
  }
  if (d.status === "pagado" && d.deliveryMethod === "retiro") return ORDER_STATUS_COPY.pagado_retiro;
  return ORDER_STATUS_COPY[d.status] || ORDER_STATUS_COPY.pendiente_pago;
}

function fmtDeadline(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/* Datos para transferir (con botón copiar) y subida del comprobante. state.receipt = { sending, status } */
function transferPanelHTML(d, receipt) {
  const t = d.transfer;
  if (!t || !t.bank) return "";
  const b = t.bank;
  const row = (label, value, copy) => value ? `
      <div><dt>${label}</dt><dd><span class="mono">${esc(value)}</span>${copy ? ` <button type="button" class="link-btn" data-action="copy-text" data-text="${esc(copy)}" aria-label="Copiar ${label}">${icon("copy")} Copiar</button>` : ""}</dd></div>` : "";
  const r = receipt || {};
  let status = "";
  if (r.sending) status = pendingStatusHTML("Subiendo el comprobante…", false);
  else if (r.status) status = `<p class="form-status tone-${r.status.tone}" role="${r.status.tone === "bad" ? "alert" : "status"}">${esc(r.status.text)}</p>`;
  return `
      <section class="panel panel-pad order-transfer" aria-labelledby="order-transfer-title">
        <h2 id="order-transfer-title" class="summary-title">${icon("bank")} Datos para transferir</h2>
        <dl class="order-facts order-bank">
          ${row("Titular", b.holder)}
          ${row("CUIT", b.cuit)}
          ${row("Banco", b.bank)}
          ${row("CBU/CVU", b.cbu, b.cbu)}
          ${row("Alias", b.alias, b.alias)}
          ${row("Monto exacto", fmtARS(d.totalArs), String(Number(d.totalArs).toFixed(2)).replace(".", ","))}
        </dl>
        ${t.deadline ? `<p class="small">Tenés tiempo hasta el <strong>${esc(fmtDeadline(t.deadline))} h</strong>.</p>` : ""}
        <form class="form receipt-form" data-form="receipt" novalidate>
          <label class="field-label" for="receipt-file">${t.receiptUploaded ? "¿Te equivocaste de archivo? Subí otro comprobante" : "Subí el comprobante"} <span class="unit">(PDF, JPG o PNG, hasta 8 MB)</span></label>
          <input id="receipt-file" class="input" type="file" name="receipt" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" ${r.sending ? "disabled" : ""} />
          ${status}
          <button type="submit" class="btn btn-primary" ${r.sending ? "disabled" : ""}>${icon("upload-simple")} Enviar comprobante</button>
        </form>
      </section>`;
}

function orderItemsHTML(d) {
  return `
      <ul class="summary-lines summary-lines-flush">
        ${(d.items || []).map((i) => `<li><span class="name"><span class="mono">${Number(i.quantity) || 0}×</span> ${esc(i.productName)}</span><span class="price">${fmtARS(Number(i.unitPriceArs) * Number(i.quantity))}</span></li>`).join("")}
      </ul>
      <div class="summary-total"><span class="muted">Total</span><span class="price price-lg">${fmtARS(d.totalArs)}<small class="iva">IVA incluido</small></span></div>`;
}

/* Pedido con código (de un cliente): código grande, pago, entrega con seguimiento, productos y dirección. */
function renderCodeOrder(d, receipt) {
  const copy = orderStatusCopy(d);
  const payUrl = d.status === "pendiente_pago" ? safePaymentUrl(d.paymentUrl) : null;
  const a = d.shippingAddress;
  const addressHTML = a ? `<p class="muted">${esc(a.street)}${a.floor ? `, ${esc(a.floor)}` : ""}<br>${esc(a.city)}, ${esc(a.province)} (${esc(a.zip)})</p>` : "";
  return `
  <div class="wrap page">
    <div class="page-head">
      <p class="small dim">Pedido${d.createdAt ? ` del ${esc(fmtOrderDate(d.createdAt))}` : ""}</p>
      <h1 class="page-title order-code mono">${esc(d.code)}</h1>
      <p class="xsmall dim">Guardá este código por cualquier consulta. Si querés devolver la compra, usá el <a class="text-link" href="#arrepentimiento">Botón de arrepentimiento</a>.</p>
    </div>
    <div class="order-grid">
      <section class="panel panel-pad order-status" aria-labelledby="order-status-title">
        <h2 id="order-status-title" class="summary-title">${icon(copy.icon, `tone-text-${copy.tone}`, "fill")} ${esc(copy.title)}</h2>
        <p class="muted" role="status">${esc(copy.text)}</p>
        <dl class="order-facts">
          <div><dt>Pago</dt><dd>${orderBadgeHTML(PAYMENT_LABELS, d.status)}${d.paymentMethod === "transferencia" ? ` <span class="xsmall dim">Transferencia</span>` : ""}</dd></div>
          ${d.status === "pagado" ? `<div><dt>Entrega</dt><dd>${orderBadgeHTML(FULFILLMENT_LABELS, d.fulfillmentStatus)}</dd></div>` : ""}
          ${d.trackingNumber ? `<div><dt>Seguimiento</dt><dd class="mono">${esc(d.trackingNumber)}</dd></div>` : ""}
        </dl>
        ${payUrl ? `<a class="btn btn-primary" href="${esc(payUrl)}">${icon("credit-card")} Pagar con Mercado Pago</a>` : ""}
      </section>
      ${transferPanelHTML(d, receipt)}
      <section class="panel panel-pad" aria-labelledby="order-items-title">
        <h2 id="order-items-title" class="summary-title">Productos</h2>
        ${orderItemsHTML(d)}
      </section>
      <section class="panel panel-pad" aria-labelledby="order-delivery-title">
        <h2 id="order-delivery-title" class="summary-title">Entrega</h2>
        <p>${esc(DELIVERY_LABELS[d.deliveryMethod] || "A coordinar")}</p>
        ${d.deliveryMethod === "envio" ? addressHTML : ""}
        ${d.billingDoc ? `<h3 class="order-subtitle">Facturación</h3><p class="muted">${esc(d.billingName || "")} <span class="mono">${esc(d.billingDoc)}</span></p>` : ""}
      </section>
    </div>
    <div class="hero-ctas hero-ctas-spaced">
      ${d.status === "rechazado" ? `<a href="#cart" class="btn btn-primary">Volver al carrito</a>` : ""}
      <a href="#mis-pedidos" class="btn btn-secondary">Mis pedidos</a>
      <a class="btn btn-secondary" href="${whatsappLink(orderWhatsappText(d.code))}" target="_blank" rel="noopener" data-context="pedido">${icon("whatsapp-logo", "", "fill")} Consultar por WhatsApp</a>
    </div>
  </div>`;
}

function renderOrder(state) {
  const o = state.order || {};
  if (o.notMine) {
    return `<div class="wrap page"><div class="empty empty-narrow">${icon("lock-simple")}
      <h1 class="page-title page-title-sm">Este pedido no es de tu cuenta</h1>
      <p>Revisá que hayas ingresado con la misma cuenta con la que compraste. Si el pedido es tuyo, escribinos.</p>
      <div class="hero-ctas hero-ctas-center">
        <a href="#mis-pedidos" class="btn btn-primary">Ver mis pedidos</a>
        <a class="btn btn-secondary" href="${whatsappLink(orderWhatsappText(o.id || ""))}" target="_blank" rel="noopener" data-context="pedido">${icon("whatsapp-logo", "", "fill")} Consultanos</a>
      </div></div></div>`;
  }
  if (o.error) {
    return `<div class="wrap page"><div class="empty empty-narrow">${icon("warning-circle")}
      <h1 class="page-title page-title-sm">No encontramos el pedido</h1><p>${esc(o.error)}</p>
      <a class="btn btn-secondary" href="${whatsappLink(orderWhatsappText(o.id || ""))}" target="_blank" rel="noopener" data-context="pedido">${icon("whatsapp-logo", "", "fill")} Consultanos</a></div></div>`;
  }
  if (!o.data) {
    return `<div class="wrap page"><div class="empty empty-narrow">${icon("hourglass-medium")}
      <h1 class="page-title page-title-sm">Consultando tu pedido…</h1></div></div>`;
  }
  const d = o.data;
  if (d.code) return renderCodeOrder(d, o.receipt);

  // Pedido viejo (sin cuenta), identificado por UUID: se muestra como antes
  const copy = ORDER_STATUS_COPY[d.status] || ORDER_STATUS_COPY.pendiente_pago;
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">${icon(copy.icon, `tone-text-${copy.tone}`, "fill")} ${esc(copy.title)}</h1>
      <p class="page-lead" role="status">${esc(copy.text)}</p>
      <p class="xsmall dim">Pedido <span class="mono">${esc(d.publicId)}</span>. Guardá este número por cualquier consulta.</p>
    </div>
    <div class="panel panel-pad order-legacy">${orderItemsHTML(d)}</div>
    <div class="hero-ctas hero-ctas-spaced">
      ${d.status === "rechazado" ? `<a href="#cart" class="btn btn-primary">Volver al carrito</a>` : `<a href="#store" class="btn btn-secondary">Seguir viendo productos</a>`}
      <a class="btn btn-secondary" href="${whatsappLink(orderWhatsappText(d.publicId))}" target="_blank" rel="noopener" data-context="pedido">${icon("whatsapp-logo", "", "fill")} Consultar por WhatsApp</a>
    </div>
  </div>`;
}
