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
  return `<a href="${whatsappLink("Hola, quiero ingresar a mi cuenta en el sitio.")}" target="_blank" rel="noopener" data-context="ingresar">${label}</a>`;
}

/* "G" oficial de Google (logo de marca, con sus cuatro colores). */
const GOOGLE_G_SVG = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

/* Botón "Continuar con Google": el que se ve es nuestro (navy, con la G oficial); encima va el botón
   real de Google (lo dibuja App.mountGoogleButton en #gsi-button), invisible y del mismo tamaño, que
   recibe el clic y el teclado. Así el ingreso es el de siempre (sin clave secreta ni endpoint propio)
   y el botón queda con los colores del sitio. Si el script de Google no carga, el aviso con WhatsApp. */
function googleSlotHTML(l) {
  if (!GOOGLE_CLIENT_ID) {
    return `<p class="form-status tone-warn" role="status">El ingreso todavía no está habilitado. ${waHelpLink("Escribinos por WhatsApp")}.</p>`;
  }
  if (l && l.gsiError) {
    return `<p class="form-status tone-bad" role="status">No pudimos cargar el ingreso con Google. Desactivá el bloqueador o ${waHelpLink("escribinos por WhatsApp")}.</p>`;
  }
  return `
    <div class="google-signin" aria-busy="true">
      <span class="btn btn-secondary google-btn" aria-hidden="true">${GOOGLE_G_SVG}<span>Continuar con <span translate="no">Google</span></span></span>
      <div id="gsi-button" class="gsi-slot"></div>
    </div>`;
}

/* "Ingresando…" / "Despertando el servidor…" / error del ingreso. */
function loginStatusHTML(l) {
  if (!l) return "";
  if (l.busy) return pendingStatusHTML("Ingresando…", l.slow);
  if (l.error) return `<p class="form-status tone-bad login-status" role="alert">${esc(l.error)}</p>`;
  return "";
}

/* Qué gana el cliente con la cuenta: se muestra debajo del botón de ingreso. */
const LOGIN_BENEFITS = [
  { icon: "shopping-cart-simple", title: "Comprá online", text: "Pagás con Mercado Pago en pocos pasos." },
  { icon: "package", title: "Seguí tus pedidos", text: "Ves el estado del pago y de la entrega." },
  { icon: "identification-card", title: "Tus datos, guardados", text: "Tu teléfono y tu dirección quedan cargados para la próxima compra." },
];

/* Composición de #ingresar: tarjeta a la izquierda, foto de la home a la derecha (se oculta en pantallas chicas). */
function authLayoutHTML(cardHTML) {
  return `
  <section class="auth">
    <div class="wrap auth-grid">
      <div class="auth-card panel">${cardHTML}</div>
      <div class="auth-media" aria-hidden="true"><img src="${HOME_IMAGES.hero}" alt="" width="1200" height="1500" fetchpriority="low" decoding="async" /></div>
    </div>
  </section>`;
}

/* #ingresar */
function renderLogin(state) {
  const session = getSession();
  const l = state.login || {};

  if (session) {
    const c = session.customer;
    return authLayoutHTML(`
        <div class="auth-who">
          ${avatarHTML(c, 64)}
          <div class="auth-who-text"><p class="login-name">${esc(c.name || "")}</p><p class="small dim">${esc(c.email || "")}</p></div>
        </div>
        <div class="auth-head">
          <h1 class="auth-title">Ya ingresaste</h1>
          <p class="muted">Desde tu cuenta ves tus pedidos y los datos que usamos para la entrega.</p>
        </div>
        <div class="auth-actions">
          <a href="#mis-pedidos" class="btn btn-primary">${icon("package")}Mis pedidos</a>
          <a href="#mi-cuenta" class="btn btn-secondary">${icon("user-circle")}Mis datos</a>
        </div>
        <a href="#store" class="auth-link">Seguir viendo productos ${icon("arrow-right")}</a>`);
  }

  const benefits = LOGIN_BENEFITS.map((b) => `
          <li>${icon(b.icon)}<div><strong>${b.title}</strong><span class="small dim">${b.text}</span></div></li>`).join("");

  return authLayoutHTML(`
        <div class="auth-head">
          <h1 class="auth-title">Ingresá a tu cuenta</h1>
          <p class="muted">Necesitás una cuenta para comprar. La usamos solo para identificarte y mostrarte tus pedidos.</p>
        </div>
        <div class="auth-google">
          ${googleSlotHTML(l)}
          ${loginStatusHTML(l)}
        </div>
        <ul class="auth-benefits">${benefits}
        </ul>
        <p class="xsmall dim auth-legal">Al ingresar aceptás los <a href="#terms">Términos y condiciones</a>. Mirá qué datos guardamos en la <a href="#privacy">Política de privacidad</a>.</p>`);
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
        ${o.status === "pagado" ? `<span class="order-card-pair"><span class="small dim">Entrega</span> ${orderBadgeHTML(FULFILLMENT_LABELS, o.fulfillmentStatus)}</span>` : ""}
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
      <button type="button" class="btn btn-secondary mt-2" data-action="my-orders-retry">Probar de nuevo</button>`;
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
    <div class="page-head">
      <h1 class="page-title">Mis pedidos</h1>
      <p class="small muted">¿Querés devolver una compra? Tenés ${REVOCATION_TERM}: <a class="text-link" href="#arrepentimiento">Botón de arrepentimiento</a>.</p>
    </div>
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
