/* AURYX: header (navegación, moneda, tema, carrito) + menú móvil. Depende de: data/products.js, utils/format.js. */

/* =========================================================================
   AURYX: Vistas. Cada función devuelve un string de HTML. Las acciones del
   usuario se declaran con data-action / data-bind y las resuelve el
   delegador de eventos de app.js (sin onclick inline).
   ========================================================================= */

const NAV_LINKS = [
  { id: "home", href: "#", label: "Inicio" },
  { id: "store", href: "#store", label: "Productos" },
  { id: "configurator", href: "#configurator", label: "Diseñá tu sistema" },
  { id: "calculators", href: "#calculators", label: "Calculadoras" },
  { id: "info", href: "#info", label: "Información" },
  { id: "contact", href: "#contact", label: "Contacto" },
];

function navCurrent(linkId, view) {
  if (linkId === "store" && view === "product-detail") return true;
  return linkId === view;
}

function renderNav(state) {
  const { view, currency, cart, cartCount, mobileNavOpen, theme } = state;

  const links = NAV_LINKS.map((l) => {
    const current = navCurrent(l.id, view) ? ' aria-current="page"' : "";
    if (l.id !== "store") return `<a href="${l.href}" class="nav-link"${current}>${l.label}</a>`;
    const items = Object.entries(CATEGORY_META).map(([key, meta]) =>
      `<a href="#store/${key}" class="menu-item">${icon(meta.icon)}${meta.label}</a>`).join("");
    return `
      <div class="dropdown">
        <a href="#store" class="nav-link"${current}>${l.label} ${icon("caret-down")}</a>
        <div class="dropdown-panel align-left">
          <a href="#store" class="menu-item">${icon("squares-four")}Todos los productos</a>
          <div class="menu-sep" role="presentation"></div>
          ${items}
        </div>
      </div>`;
  }).join("");

  const preview = cart.slice(0, 4);
  const cartPanel = preview.length === 0
    ? `<div class="cart-preview-list"><p class="small dim" style="padding:8px 0">Tu carrito está vacío.</p></div>`
    : `<div class="cart-preview-list">
        ${preview.map((it) => `
          <div class="cart-preview-row">
            <span class="name"><span class="mono">${it.qty}×</span> ${esc(it.product.name)}</span>
            ${priceTagHTML(it.product, currency)}
          </div>`).join("")}
        ${cart.length > preview.length ? `<p class="xsmall dim" style="padding-top:8px">y ${cart.length - preview.length} más</p>` : ""}
      </div>
      <div class="cart-preview-foot"><a href="#cart" class="btn btn-primary btn-block">Ver carrito</a></div>`;

  const nextCurrency = currency === "ARS" ? "USD" : "ARS";
  const nextTheme = theme === "dark" ? "claro" : "oscuro";

  return `
  <div class="wrap header-row">
    <a href="#" class="wordmark" aria-label="AURYX, ir al inicio" translate="no">AURYX</a>
    <nav class="main-nav" aria-label="Principal">${links}</nav>
    <div class="header-actions">
      <button type="button" class="icon-btn currency-btn" data-action="currency-toggle"
        aria-label="Moneda: ${currency}. Cambiar a ${nextCurrency}" data-fid="currency">${currency}</button>
      <button type="button" class="icon-btn" data-action="theme-toggle" aria-label="Cambiar a tema ${nextTheme}" data-fid="theme">
        ${icon(theme === "dark" ? "sun" : "moon")}
      </button>
      <div class="dropdown cart-dropdown">
        <a href="#cart" class="icon-btn" style="position:relative" aria-label="Carrito, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}">
          ${icon("shopping-cart-simple")}
          ${cartCount > 0 ? `<span class="cart-count" aria-hidden="true">${cartCount}</span>` : ""}
        </a>
        <div class="dropdown-panel align-right">${cartPanel}</div>
      </div>
      <button type="button" class="icon-btn menu-btn" data-action="nav-toggle" data-fid="menu"
        aria-expanded="${mobileNavOpen}" aria-controls="mobile-nav" aria-label="${mobileNavOpen ? "Cerrar menú" : "Abrir menú"}">
        ${icon(mobileNavOpen ? "x" : "list")}
      </button>
    </div>
  </div>
  <nav id="mobile-nav" class="mobile-nav wrap" aria-label="Principal (móvil)" ${mobileNavOpen ? "" : "hidden"}>
    ${NAV_LINKS.map((l) => `<a href="${l.href}"${navCurrent(l.id, view) ? ' aria-current="page"' : ""}>${l.label}</a>`).join("")}
  </nav>`;
}
