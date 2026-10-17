/* AURYX: Cuenta del cliente: Ingresar, Mis pedidos, Mis datos y avatar. Depende de: config.js (GOOGLE_CLIENT_ID), lib/session.js, utils/format.js. */

/* Inicial del nombre (o del email) en mayúscula, para el avatar sin foto. */
function customerInitial(customer) {
  const source = ((customer && (customer.name || customer.email)) || "").trim();
  const first = Array.from(source)[0];
  return first ? first.toLocaleUpperCase("es-AR") : "?";
}

/* Primer nombre, para el menú del header. */
function customerFirstName(customer) {
  const name = ((customer && customer.name) || "").trim();
  return name ? name.split(/\s+/)[0] : ((customer && customer.email) || "").split("@")[0];
}

/**
 * Foto de la cuenta o círculo con la inicial. La inicial queda siempre debajo:
 * si la foto no carga, app.js quita la <img> (evento "error") y se ve la inicial,
 * nunca una imagen rota.
 */
const BROKEN_AVATARS = new Set(); // fotos que ya fallaron: no se vuelven a pedir en cada render

function avatarHTML(customer, size = 32) {
  const url = customer && customer.avatarUrl && !BROKEN_AVATARS.has(customer.avatarUrl) ? customer.avatarUrl : null;
  return `
    <span class="avatar" style="--avatar-size:${Number(size) || 32}px" aria-hidden="true">
      <span class="avatar-initial">${esc(customerInitial(customer))}</span>
      ${url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" data-avatar-img />` : ""}
    </span>`;
}

function waHelpLink(label) {
  return `<a href="${whatsappLink("Hola, quiero ingresar a mi cuenta en el sitio.")}" target="_blank" rel="noopener">${label}</a>`;
}

/* Lugar del botón de Google (lo dibuja App.mountGoogleButton después de cada render
   de #ingresar o del carrito), o el aviso si el ingreso no está disponible. */
function googleSlotHTML(l) {
  if (!GOOGLE_CLIENT_ID) {
    return `<p class="form-status tone-warn" role="status">El ingreso todavía no está habilitado. ${waHelpLink("Escribinos por WhatsApp")}.</p>`;
  }
  if (l && l.gsiError) {
    return `<p class="form-status tone-bad" role="status">No pudimos cargar el ingreso con Google. Desactivá el bloqueador o ${waHelpLink("escribinos por WhatsApp")}.</p>`;
  }
  return `<div id="gsi-button" class="gsi-slot"><p class="small dim"><span class="spinner" aria-hidden="true"></span> Cargando el ingreso con Google…</p></div>`;
}

/* "Ingresando…" / "Despertando el servidor…" / error del ingreso. */
function loginStatusHTML(l) {
  if (!l) return "";
  if (l.busy) return pendingStatusHTML("Ingresando…", l.slow);
  if (l.error) return `<p class="form-status tone-bad login-status" role="alert">${esc(l.error)}</p>`;
  return "";
}

/* #ingresar */
function renderLogin(state) {
  const session = getSession();
  const l = state.login || {};

  if (session) {
    const c = session.customer;
    return `
    <div class="wrap page">
      <div class="panel panel-pad login-card">
        <div class="login-who">${avatarHTML(c, 48)}<div><p class="login-name">${esc(c.name || "")}</p><p class="small dim">${esc(c.email || "")}</p></div></div>
        <p class="muted">Ya ingresaste con tu cuenta.</p>
        <div class="hero-ctas"><a href="#mis-pedidos" class="btn btn-primary">Mis pedidos</a><a href="#store" class="btn btn-secondary">Seguir viendo productos</a></div>
      </div>
    </div>`;
  }

  const slot = googleSlotHTML(l);
  const status = loginStatusHTML(l);

  return `
  <div class="wrap page">
    <div class="panel panel-pad login-card">
      <h1 class="page-title" style="font-size:1.75rem">Ingresá a tu cuenta</h1>
      <p class="muted">Necesitás una cuenta para comprar. Usamos tu cuenta solo para identificarte y mostrarte tus pedidos.</p>
      ${slot}
      ${status}
      <p class="xsmall dim">Al ingresar aceptás los <a href="#terms">Términos y condiciones</a>. Mirá qué datos guardamos en la <a href="#privacy">Política de privacidad</a>.</p>
    </div>
  </div>`;
}


/* #mis-pedidos: state.myOrders = { loading, error, data } (lo carga App.loadMyOrders). */
function myOrderCardHTML(o) {
  const payUrl = o.status === "pendiente_pago" ? safePaymentUrl(o.paymentUrl) : null;
  return `
    <li class="panel order-card">
      <div class="order-card-head">
        <a class="order-card-code mono" href="#pedido/${encodeURIComponent(o.code)}">${esc(o.code)}</a>
        <span class="small dim">${esc(fmtOrderDate(o.createdAt))}</span>
      </div>
      <p class="order-card-summary">${esc(orderSummaryText(o.items))}</p>
      <div class="order-card-badges">
        <span class="order-card-pair"><span class="small dim">Pago</span> ${orderBadgeHTML(PAYMENT_LABELS, o.status)}</span>
        <span class="order-card-pair"><span class="small dim">Entrega</span> ${orderBadgeHTML(FULFILLMENT_LABELS, o.fulfillmentStatus)}</span>
        ${o.trackingNumber ? `<span class="small dim">Seguimiento <span class="mono">${esc(o.trackingNumber)}</span></span>` : ""}
      </div>
      <div class="order-card-foot">
        <span class="price">${fmtARS(o.totalArs)}</span>
        <span class="order-card-actions">
          ${payUrl ? `<a class="btn btn-primary btn-sm" href="${esc(payUrl)}">Pagar</a>` : ""}
          <a class="btn btn-secondary btn-sm" href="#pedido/${encodeURIComponent(o.code)}">Ver detalle</a>
        </span>
      </div>
    </li>`;
}

function renderMyOrders(state) {
  const m = state.myOrders || {};
  let body;
  if (m.error) {
    body = `<p class="form-status tone-bad" role="alert">${esc(m.error)}</p>
      <button type="button" class="btn btn-secondary" data-action="my-orders-retry" style="margin-top:12px">Probar de nuevo</button>`;
  } else if (!m.data) {
    body = pendingStatusHTML("Cargando tus pedidos…", m.slow);
  } else if (!m.data.length) {
    body = `<div class="empty">${icon("package")}<h2>Todavía no hay pedidos para mostrar</h2>
      <p>Cuando compres, vas a ver acá el estado del pago y de la entrega.</p>
      <a href="#store" class="btn btn-secondary">Ver productos</a></div>`;
  } else {
    body = `<ul class="order-list">${m.data.map(myOrderCardHTML).join("")}</ul>`;
  }
  return `
  <div class="wrap page">
    <div class="page-head"><h1 class="page-title">Mis pedidos</h1></div>
    ${body}
  </div>`;
}

/* #mi-cuenta: nombre y email de la cuenta (solo lectura); teléfono, dirección y facturación editables.
   state.account = { phone, address, billingDoc, billingName, errors, sending, status, touched }. */
function defaultAccountForm() {
  return { phone: "", address: emptyAddress(), billingDoc: "", billingName: "", errors: {}, sending: false, slow: false, status: null, touched: false };
}

function renderMyAccount(state) {
  const session = getSession();
  const c = (session && session.customer) || {};
  const f = state.account || defaultAccountForm();
  const errors = f.errors || {};
  const { input } = formFieldKit("account", "account", errors);
  let status = "";
  if (f.sending) status = pendingStatusHTML("Guardando…", f.slow);
  else if (f.status) status = `<p class="form-status tone-${f.status.tone}" role="${f.status.tone === "bad" ? "alert" : "status"}">${esc(f.status.text)}</p>`;
  return `
  <div class="wrap page">
    <div class="page-head"><h1 class="page-title">Mis datos</h1></div>
    <div class="account-grid">
      <div class="panel panel-pad login-card account-card">
        <div class="login-who">${avatarHTML(c, 48)}<div><p class="login-name">${esc(c.name || "")}</p><p class="small dim">${esc(c.email || "")}</p></div></div>
        <p class="small dim">El nombre y el email vienen de tu cuenta de Google.</p>
      </div>
      <form class="form panel panel-pad account-form" data-form="account" novalidate>
        <p class="small muted">Los usamos para completar el checkout de tu próxima compra. Dejá vacío lo que no quieras guardar.</p>
        ${input("phone", 'Teléfono <span class="unit">(para coordinar la entrega)</span>', f.phone, 'type="tel" autocomplete="tel" inputmode="tel"')}
        <fieldset class="field account-fieldset">
          <legend class="checkout-title">Dirección de entrega</legend>
          ${addressFieldsHTML("account", "account", f.address, errors)}
        </fieldset>
        <fieldset class="field account-fieldset">
          <legend class="checkout-title">Facturación <span class="unit small dim">(opcional)</span></legend>
          ${billingFieldsHTML("account", "account", f.billingDoc, f.billingName, errors)}
        </fieldset>
        ${status}
        <button type="submit" class="btn btn-primary" ${f.sending ? "disabled" : ""}>${f.sending ? "Guardando…" : "Guardar cambios"}</button>
      </form>
    </div>
  </div>`;
}
