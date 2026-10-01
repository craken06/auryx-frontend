/* AURYX — Barra de navegación superior + menú móvil. Depende de: data/products.js, utils/format.js. */

/* =========================================================================
   AURYX — Vistas. Cada función devuelve un string de HTML. Los manejadores
   de eventos llaman a métodos del objeto global `App` (definido en app.js).
   ========================================================================= */

const NAV_LINKS = [
  { id: "home", label: "Inicio" },
  { id: "store", label: "Productos" },
  { id: "configurator", label: "Diseñá tu sistema" },
  { id: "calculators", label: "Calculadoras" },
  { id: "info", label: "Información" },
  { id: "contact", label: "Contacto" },
];

function renderNav(state) {
  const links = NAV_LINKS.map((l) => {
    if (l.id === "store") {
      const menuItems = Object.entries(CATEGORY_META).map(([key, meta]) => `
        <a href="#store/${key}" class="flex items-center gap-2 px-4 py-2.5 text-sm sf-nav-link">
          ${iconTag(meta.icon, 15)} ${meta.label}
        </a>`).join("");
      return `
      <div class="sf-dropdown-wrap">
        <a href="#store" class="sf-nav-link pb-3 ${state.view === l.id ? "active" : ""}">${l.label}</a>
        <div class="sf-dropdown sf-mega py-2">
          <a href="#store" class="flex items-center gap-2 px-4 py-2.5 text-sm sf-nav-link border-b" style="border-color:var(--line)">Todos los productos</a>
          ${menuItems}
        </div>
      </div>`;
    }
    return `<a href="#${l.id}" class="sf-nav-link pb-3 ${state.view === l.id ? "active" : ""}">${l.label}</a>`;
  }).join("");

  const mobileLinks = NAV_LINKS.map((l) => `
    <a href="#${l.id}" onclick="App.toggleMobileNav(false)" class="text-left sf-nav-link ${state.view === l.id ? "active" : ""}">${l.label}</a>
  `).join("");

  const cartItems = state.cart.slice(0, 4);
  const cartDropdown = cartItems.length === 0
    ? `<div class="p-4 text-sm" style="color:var(--text-dim)">Tu carrito está vacío.</div>`
    : `<div class="p-3 space-y-2 max-h-72 overflow-y-auto sf-scrollbar">
        ${cartItems.map((it) => `
          <div class="flex items-center justify-between gap-2 text-sm py-1.5 border-b" style="border-color:var(--line)">
            <span class="truncate" style="max-width:180px">${it.qty}× ${it.product.name}</span>
            ${priceTagHTML(it.product, state.currency)}
          </div>`).join("")}
        ${state.cart.length > cartItems.length ? `<p class="text-xs pt-1" style="color:var(--text-dim)">+ ${state.cart.length - cartItems.length} producto(s) más</p>` : ""}
      </div>
      <a href="#cart" class="sf-btn-primary flex items-center justify-center gap-2 py-2.5 text-sm font-semibold">${iconTag("shopping-cart", 14)} Ver carrito completo</a>`;

  return `
  <div class="border-b" style="background:#000;border-color:var(--line)">
    <div class="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
      <a href="#home" class="flex items-center gap-2 sf-display font-bold text-lg tracking-wide">
        ${iconTag("sun", 22, "--yellow")} AURYX
      </a>
      <nav class="hidden md:flex items-center gap-7 text-sm">${links}</nav>
      <div class="flex items-center gap-3">
        <button onclick="App.toggleCurrency()" class="sf-mono text-xs sf-btn-outline px-2 py-1" title="Cambiar moneda">${state.currency}</button>
        <div class="sf-dropdown-wrap">
          <a href="#cart" class="relative sf-btn-outline p-2 inline-flex">
            ${iconTag("shopping-cart", 18)}
            ${state.cartCount > 0 ? `<span class="absolute -top-2 -right-2 text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold" style="background:var(--yellow);color:#000">${state.cartCount}</span>` : ""}
          </a>
          <div class="sf-dropdown sf-cart-dropdown flex flex-col">${cartDropdown}</div>
        </div>
        <button class="md:hidden sf-btn-outline p-2" onclick="App.toggleMobileNav()">${iconTag("menu", 18)}</button>
      </div>
    </div>
    ${state.mobileNavOpen ? `<div class="md:hidden flex flex-col px-5 pb-4 gap-3 text-sm">${mobileLinks}</div>` : ""}
  </div>`;
}
