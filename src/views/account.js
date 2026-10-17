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

  let slot;
  if (!GOOGLE_CLIENT_ID) {
    slot = `<p class="form-status tone-warn" role="status">El ingreso todavía no está habilitado. ${waHelpLink("Escribinos por WhatsApp")}.</p>`;
  } else if (l.gsiError) {
    slot = `<p class="form-status tone-bad" role="status">No pudimos cargar el ingreso con Google. Desactivá el bloqueador o ${waHelpLink("escribinos por WhatsApp")}.</p>`;
  } else {
    // Google dibuja su botón acá después de cada render (ver App.mountGoogleButton)
    slot = `<div id="gsi-button" class="gsi-slot"><p class="small dim"><span class="spinner" aria-hidden="true"></span> Cargando el ingreso con Google…</p></div>`;
  }

  let status = "";
  if (l.busy) {
    status = `<p class="form-status login-status" role="status"><span class="spinner" aria-hidden="true"></span> ${l.slow ? "Despertando el servidor, puede tardar hasta un minuto…" : "Ingresando…"}</p>`;
  } else if (l.error) {
    status = `<p class="form-status tone-bad login-status" role="alert">${esc(l.error)}</p>`;
  }

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

/* #mis-pedidos (la Tarea 9 completa la lista) */
function renderMyOrders() {
  return `
  <div class="wrap page">
    <div class="page-head"><h1 class="page-title">Mis pedidos</h1></div>
    <div class="empty">${icon("package")}<h2>Todavía no hay pedidos para mostrar</h2>
      <p>Cuando compres, vas a ver acá el estado del pago y de la entrega.</p>
      <a href="#store" class="btn btn-secondary">Ver productos</a></div>
  </div>`;
}

/* #mi-cuenta (la Tarea 9 suma teléfono, dirección y facturación editables) */
function renderMyAccount() {
  const session = getSession();
  const c = (session && session.customer) || {};
  return `
  <div class="wrap page">
    <div class="page-head"><h1 class="page-title">Mis datos</h1></div>
    <div class="panel panel-pad login-card">
      <div class="login-who">${avatarHTML(c, 48)}<div><p class="login-name">${esc(c.name || "")}</p><p class="small dim">${esc(c.email || "")}</p></div></div>
      <p class="small dim">El nombre y el email vienen de tu cuenta de Google.</p>
    </div>
  </div>`;
}
