/* =========================================================================
   AURYX: App. Estado global, router por hash, delegación de eventos y
   orquestación del render.

   Sin framework: cada acción del usuario actualiza `App.state` y decide si
   hace falta un re-render completo (clics, cambios de paso) o una
   actualización puntual del DOM (inputs de texto/número, para no perder el
   foco ni el cursor mientras se tipea).

   Los eventos se declaran en el HTML con atributos:
     data-action="..."  → clic (botones)
     data-bind="..."    → input / change (campos)
   y se resuelven acá con un único listener por tipo de evento.
   ========================================================================= */

function defaultConfigurator() {
  return {
    step: 0, systemTypeId: null, panelId: null, panelQty: 2, wiring: "series",
    systemVoltage: 24, converterId: null, batteryId: null, batteryQty: 1, extras: {},
  };
}

const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* modo privado: se ignora */ } }

/* Carrito persistente: se guardan solo id + cantidad (los precios se toman siempre del catálogo
   actual). Las líneas cuyo producto todavía no está en el catálogo cargado (por ejemplo, la API
   no respondió y se usa el catálogo de demo) se conservan aparte para no perderlas. */
const CART_KEY = "auryx-cart";
let unresolvedCart = [];

function persistCart(cart) {
  const resolved = cart.map((it) => ({ id: it.product.id, qty: it.qty, systemId: it.systemId || null }));
  storageSet(CART_KEY, JSON.stringify([...resolved, ...unresolvedCart]));
}

function restoreCart() {
  let saved = [];
  try { saved = JSON.parse(storageGet(CART_KEY) || "[]"); } catch (e) { saved = []; }
  if (!Array.isArray(saved)) return [];
  const cart = [];
  unresolvedCart = [];
  saved.forEach((it) => {
    const qty = Math.max(1, Math.round(Number(it && it.qty)) || 1);
    const product = it && PRODUCTS.find((p) => p.id === it.id);
    if (!product) { if (it && it.id) unresolvedCart.push({ id: it.id, qty, systemId: it.systemId || null }); return; }
    const line = { product, qty };
    if (it.systemId) line.systemId = it.systemId;
    cart.push(line);
  });
  return cart;
}

const App = {
  state: {
    view: "home",
    theme: document.documentElement.getAttribute("data-theme") || "dark",
    currency: storageGet("auryx-currency") === "USD" ? "USD" : "ARS",
    cart: [],
    mobileNavOpen: false,
    storeCategory: "all",
    storeSort: "none",
    storeFilters: {},
    filtersOpen: false,
    selectedProductId: null,
    productDetailQty: 1,
    configurator: defaultConfigurator(),
    homeDemo: { panelId: "panel-jk-575", qty: 6 },
    calcSection: null,
    calc: {
      consumption: [{ name: "Heladera", power: 150, qty: 1, hours: 8 }],
      cost: { kwh: 300, pricePerKwh: 140 },
      savings: { currentKwh: 350, solarKwh: 220, energyPrice: 140 },
      orientation: { lat: -34.6, mode: "optimal", previewAngle: 35 },
    },
    contactDraft: {},
    contactErrors: {},
    contactStatus: null,
  },

  cartReady: false, // hasta restaurar el carrito guardado no se escribe nada (evita pisarlo con uno vacío)
  lastRouteKey: null,
  homeRevealed: false,
  toastTimer: null,
  toastAction: null,

  get cartCount() { return this.state.cart.reduce((s, it) => s + Number(it.qty), 0); },

  /* ---------------------------------------------------------------- render */
  render({ focusSelector } = {}) {
    const s = this.state;
    const active = document.activeElement;
    const fid = active && active !== document.body ? (active.dataset.fid || (active.id ? `#${active.id}` : null)) : null;

    document.getElementById("nav-root").innerHTML = renderNav({
      view: s.view, currency: s.currency, cart: s.cart, cartCount: this.cartCount, mobileNavOpen: s.mobileNavOpen, theme: s.theme,
    });

    let body = "";
    switch (s.view) {
      case "home": body = renderHome(s); break;
      case "store": body = renderStore(s); break;
      case "product-detail": body = renderProductDetail(s); break;
      case "configurator": body = renderConfigurator(s); break;
      case "calculators": body = renderCalculators(s); break;
      case "cart": body = renderCart(s); break;
      case "info": body = renderInfo(); break;
      case "contact": body = renderContact(s); break;
      case "terms": body = renderTerms(); break;
      case "privacy": body = renderPrivacy(); break;
      default: body = renderHome(s);
    }
    document.getElementById("app-root").innerHTML = body;

    const footer = document.getElementById("footer-root");
    if (!footer.dataset.ready) { footer.innerHTML = renderFooter(); footer.dataset.ready = "1"; }

    this.setupReveal();
    if (this.cartReady) persistCart(s.cart);

    // devolver el foco al mismo control después del re-render (teclado / lectores de pantalla)
    const target = focusSelector
      ? document.querySelector(focusSelector)
      : fid ? (fid.startsWith("#") ? document.getElementById(fid.slice(1)) : document.querySelector(`[data-fid="${CSS.escape(fid)}"]`)) : null;
    if (target && !target.disabled) target.focus({ preventScroll: true });
  },

  /* Reveal de secciones en la home: anima la primera vez que se ve la
     página; en re-renders de la misma visita (cambio de moneda, etc.)
     se muestran directo para que no parpadeen. */
  setupReveal() {
    const els = document.querySelectorAll("#app-root [data-reveal]");
    if (!els.length) return;
    if (this.homeRevealed || prefersReducedMotion() || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
    this.homeRevealed = true;
  },

  /* ---------------------------------------------------------------- toast */
  toast(message, action) {
    const root = document.getElementById("toast-root");
    clearTimeout(this.toastTimer);
    this.toastAction = action || null;
    root.innerHTML = `
      <div class="toast">
        ${icon("check-circle", "", "fill")}
        <span class="msg">${message}</span>
        ${action ? (action.href
          ? `<a class="btn btn-secondary btn-sm" href="${action.href}" data-action="toast-dismiss">${action.label}</a>`
          : `<button type="button" class="btn btn-secondary btn-sm" data-action="toast-action">${action.label}</button>`) : ""}
        <button type="button" class="icon-btn" style="border:0;color:inherit" data-action="toast-dismiss" aria-label="Cerrar aviso">${icon("x")}</button>
      </div>`;
    this.toastTimer = setTimeout(() => this.dismissToast(), action ? 7000 : 4000);
  },
  dismissToast() {
    clearTimeout(this.toastTimer);
    this.toastAction = null;
    document.getElementById("toast-root").innerHTML = "";
  },

  /* ---------------------------------------------------------------- header */
  toggleMobileNav(force) {
    this.state.mobileNavOpen = force !== undefined ? force : !this.state.mobileNavOpen;
    this.render();
  },
  toggleCurrency() {
    this.state.currency = this.state.currency === "ARS" ? "USD" : "ARS";
    storageSet("auryx-currency", this.state.currency);
    this.render();
  },
  toggleTheme() {
    const theme = this.state.theme === "dark" ? "light" : "dark";
    this.state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f3f5f9" : "#05080f");
    storageSet("auryx-theme", theme);
    this.render();
  },

  /* ---------------------------------------------------------------- tienda */
  /* Los filtros y el orden viven en la URL: se pueden compartir y el botón
     "Atrás" del navegador los respeta. */
  storeHash(patch) {
    const s = this.state;
    const filters = { ...s.storeFilters, ...(patch.filters || {}) };
    const sort = patch.sort !== undefined ? patch.sort : s.storeSort;
    const params = new URLSearchParams();
    if (filters.brand) params.set("marca", filters.brand);
    if (filters.tech) params.set("tecnologia", filters.tech);
    if (filters.systemType) params.set("sistema", filters.systemType);
    if (sort && sort !== "none") params.set("orden", sort);
    const base = s.storeCategory === "all" ? "store" : `store/${s.storeCategory}`;
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  },
  setStoreFilter(key, value) {
    const current = this.state.storeFilters[key];
    navigateHash(this.storeHash({ filters: { [key]: current === value ? null : value } }));
  },
  clearStoreFilters() {
    navigateHash(this.storeHash({ filters: { brand: null, tech: null, systemType: null } }));
  },
  setStoreSort(value) { navigateHash(this.storeHash({ sort: value })); },

  /* ---------------------------------------------------------------- carrito */
  addToCart(productId, qty) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    const n = Math.max(1, Math.round(Number(qty)) || 1);
    const existing = this.state.cart.find((it) => !it.systemId && it.product.id === productId);
    if (existing) existing.qty += n;
    else this.state.cart.push({ product, qty: n });
    this.render();
    this.toast(`Agregaste ${esc(product.name)} al carrito.`, { label: "Ver carrito", href: "#cart" });
  },
  addSystemToCart(items) {
    const systemId = `sys-${Date.now()}`;
    items.forEach((it) => this.state.cart.push({ product: it.product, qty: it.qty, systemId }));
    this.state.configurator = defaultConfigurator();
    navigateHash("cart");
    this.toast("Agregaste el sistema completo al carrito.");
  },
  cartQtyStep(idx, delta) {
    const item = this.state.cart[idx];
    if (!item) return;
    item.qty = Math.max(1, Number(item.qty) + delta);
    this.render();
  },
  cartRemove(idx) {
    const [removed] = this.state.cart.splice(idx, 1);
    if (!removed) return;
    this.render({ focusSelector: "#main" });
    this.toast(`Quitaste ${esc(removed.product.name)}.`, {
      label: "Deshacer",
      run: () => { this.state.cart.splice(Math.min(idx, this.state.cart.length), 0, removed); this.render(); },
    });
  },
  requestQuote() {
    const s = this.state;
    s.contactDraft = { ...s.contactDraft, message: quoteMessage(s) };
    s.contactStatus = null;
    navigateHash("contact");
  },

  /* ---------------------------------------------------------------- configurador */
  cfgRender() { this.render({ focusSelector: "#cfg-step-title" }); },
  cfgSelectSystemType(id) {
    this.state.configurator = defaultConfigurator();
    this.state.configurator.systemTypeId = id;
    this.render();
  },
  cfgAddSystemToCart() {
    const cfg = this.state.configurator;
    const { lines } = cfgTotals(cfg);
    this.addSystemToCart(lines.map((l) => ({ product: l.product, qty: l.qty })));
  },

  /* ---------------------------------------------------------------- calculadoras (actualización puntual) */
  setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; },

  calcConsumptionRecompute() {
    const t = consumptionTotals(this.state.calc.consumption);
    this.setText("consumption-daily", t.daily);
    this.setText("consumption-monthly", t.monthly);
    this.setText("consumption-yearly", t.yearly);
  },
  calcCostRecompute() {
    const { kwh, pricePerKwh } = this.state.calc.cost;
    this.setText("cost-total", fmtMoney(kwh * pricePerKwh));
  },
  calcSavingsRecompute() {
    const t = savingsTotals(this.state.calc.savings);
    this.setText("sav-monthly", t.monthly);
    this.setText("sav-yearly", t.yearly);
    this.setText("sav-pct", t.pct);
  },
  calcOrientationRecompute() {
    const t = orientationTotals(this.state.calc.orientation);
    this.setText("orient-azimuth", t.azimuth);
    this.setText("orient-angle", `≈ ${t.angle}°`);
    this.calcOrientationDraw(t.angle);
  },
  calcOrientationAngleEdit(value) {
    let n = Math.round(Number(value));
    if (Number.isNaN(n)) n = 0;
    n = Math.max(0, Math.min(90, n));
    this.state.calc.orientation.previewAngle = n;

    const numInput = document.getElementById("orient-angle-number");
    const slider = document.getElementById("orient-angle-slider");
    if (numInput && document.activeElement !== numInput && Number(numInput.value) !== n) numInput.value = n;
    if (slider && Number(slider.value) !== n) slider.value = n;
    this.setText("orient-angle", `≈ ${n}°`);
    this.calcOrientationDraw(n);
  },
  /* Redibuja las dos vistas del panel con el ángulo dado (sin re-render). */
  calcOrientationDraw(n) {
    const iso = document.getElementById("panel-3d-iso");
    if (iso) iso.style.transform = `rotateX(${-n}deg)`;

    const g = lateralPanelGeometry(n);
    const panelLine = document.getElementById("lateral-panel");
    if (panelLine) { panelLine.setAttribute("x2", g.far.x); panelLine.setAttribute("y2", g.far.y); }
    const strut = document.getElementById("lateral-strut");
    if (strut) { strut.setAttribute("x2", g.strutAttach.x); strut.setAttribute("y2", g.strutAttach.y); }
    const ticks = document.getElementById("lateral-ticks");
    if (ticks) ticks.innerHTML = lateralTicksHTML(g.ticks);
    const arc = document.getElementById("lateral-arc");
    if (arc) arc.setAttribute("d", `M ${g.arcStart.x} ${g.arcStart.y} A 34 34 0 0 1 ${g.arcEnd.x} ${g.arcEnd.y}`);
    const label = document.getElementById("lateral-label");
    if (label) { label.setAttribute("x", g.label.x); label.setAttribute("y", g.label.y); label.textContent = `${n}°`; }
    const svg = document.getElementById("lateral-svg");
    if (svg) svg.setAttribute("aria-label", `Vista lateral del panel inclinado ${n} grados`);
  },

  /* ---------------------------------------------------------------- demo de la home */
  renderHomeDemo() {
    const root = document.getElementById("home-demo");
    if (!root) return;
    const active = document.activeElement;
    const fid = active && active.dataset ? active.dataset.fid : null;
    root.innerHTML = renderHomeDemo(this.state.homeDemo);
    if (fid) {
      const el = root.querySelector(`[data-fid="${CSS.escape(fid)}"]`);
      // si el botón quedó deshabilitado (llegó al límite), el foco pasa al opuesto
      if (el && !el.disabled) el.focus({ preventScroll: true });
      else root.querySelector(".stepper .icon-btn:not(:disabled)")?.focus({ preventScroll: true });
    }
  },

  /* ---------------------------------------------------------------- contacto */
  submitContact() {
    const s = this.state;
    const d = s.contactDraft;
    const errors = {};
    if (!(d.name || "").trim()) errors.name = "Escribí tu nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((d.email || "").trim())) errors.email = "Revisá el email: tiene que tener la forma nombre@dominio.com.";
    if (!(d.message || "").trim()) errors.message = "Contanos en qué te podemos ayudar.";
    s.contactErrors = errors;

    const firstError = ["name", "email", "message"].find((k) => errors[k]);
    if (firstError) {
      s.contactStatus = null;
      this.render({ focusSelector: `#contact-${firstError}` });
      return;
    }

    const body = `${d.message}\n\n${d.name}\n${d.email}${d.phone ? `\n${d.phone}` : ""}`;
    if (typeof CONTACT_EMAIL === "string" && CONTACT_EMAIL) {
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Consulta web: ${d.name}`)}&body=${encodeURIComponent(body)}`;
      s.contactStatus = { tone: "ok", text: "Abrimos tu programa de correo con el mensaje listo. Solo falta que lo envíes." };
    } else {
      // Sin backend ni email configurado, el canal es WhatsApp con el mensaje armado.
      window.open(whatsappLink(body), "_blank", "noopener");
      s.contactStatus = { tone: "ok", text: "Abrimos WhatsApp con tu mensaje listo. Solo falta que lo envíes." };
    }
    this.render({ focusSelector: ".form-status" });
  },
};

/* =========================================================================
   DELEGACIÓN DE EVENTOS
   ========================================================================= */
const ACTIONS = {
  "nav-toggle": () => App.toggleMobileNav(),
  "currency-toggle": () => App.toggleCurrency(),
  "theme-toggle": () => App.toggleTheme(),
  "scroll-top": () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    document.querySelector(".wordmark")?.focus({ preventScroll: true });
  },
  "reload": () => location.reload(),
  "toast-dismiss": () => App.dismissToast(),
  "toast-action": () => { const a = App.toastAction; App.dismissToast(); if (a && a.run) a.run(); },

  "filter": (d) => App.setStoreFilter(d.key, d.value),
  "filters-clear": () => App.clearStoreFilters(),

  "cart-add": (d) => {
    const qtyInput = d.qtyFrom ? document.getElementById(d.qtyFrom) : null;
    App.addToCart(d.id, qtyInput ? qtyInput.value : 1);
  },
  "cart-step": (d) => App.cartQtyStep(Number(d.idx), Number(d.delta)),
  "cart-remove": (d) => App.cartRemove(Number(d.idx)),
  "cart-quote": () => App.requestQuote(),
  "detail-step": (d) => {
    App.state.productDetailQty = Math.max(1, (Number(App.state.productDetailQty) || 1) + Number(d.delta));
    App.render();
  },

  "cfg-type": (d) => App.cfgSelectSystemType(d.id),
  "cfg-panel": (d) => { App.state.configurator.panelId = d.id; App.render(); },
  "cfg-converter": (d) => { App.state.configurator.converterId = d.id; App.render(); },
  "cfg-battery": (d) => { App.state.configurator.batteryId = d.id; App.render(); },
  "cfg-panel-step": (d) => { const c = App.state.configurator; c.panelQty = Math.max(1, c.panelQty + Number(d.delta)); App.render(); },
  "cfg-battery-step": (d) => { const c = App.state.configurator; c.batteryQty = Math.max(1, c.batteryQty + Number(d.delta)); App.render(); },
  "cfg-extra-step": (d) => {
    const c = App.state.configurator;
    c.extras[d.id] = Math.max(0, (c.extras[d.id] || 0) + Number(d.delta));
    App.render();
  },
  "cfg-next": () => {
    const c = App.state.configurator;
    if (!cfgCanAdvance(c)) return;
    c.step = Math.min(c.step + 1, configuratorSteps(c).length - 1);
    App.cfgRender();
  },
  "cfg-back": () => { const c = App.state.configurator; c.step = Math.max(c.step - 1, 0); App.cfgRender(); },
  "cfg-goto": (d) => { App.state.configurator.step = Number(d.step); App.cfgRender(); },
  "cfg-add-system": () => App.cfgAddSystemToCart(),

  "calc-consumption-add": () => {
    App.state.calc.consumption.push({ name: "", power: 0, qty: 1, hours: 1 });
    const i = App.state.calc.consumption.length - 1;
    App.render({ focusSelector: `[name="equipo-${i}-nombre"]` });
  },
  "calc-consumption-remove": (d) => {
    App.state.calc.consumption.splice(Number(d.i), 1);
    App.render({ focusSelector: '[data-fid="consumption-add"]' });
  },
  "orient-mode": (d) => {
    const o = App.state.calc.orientation;
    if (d.mode === "manual") o.previewAngle = orientationTotals(o).angle;
    o.mode = d.mode;
    App.render({ focusSelector: `[data-action="orient-mode"][data-mode="${d.mode}"]` });
  },
  "orient-geolocate": () => {
    const status = document.getElementById("orient-geo-status");
    if (!navigator.geolocation) { if (status) status.textContent = " Tu navegador no permite obtener la ubicación."; return; }
    if (status) status.textContent = " Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition((pos) => {
      App.state.calc.orientation.lat = Math.round(pos.coords.latitude * 100) / 100;
      App.render({ focusSelector: "#orient-geo-btn" });
    }, () => { if (status) status.textContent = " No pudimos obtener tu ubicación: ingresá la latitud a mano."; });
  },

  "demo-step": (d) => {
    const demo = App.state.homeDemo;
    demo.qty = Math.max(1, Math.min(14, demo.qty + Number(d.delta)));
    App.renderHomeDemo();
  },
};

/* Inputs: actualización en vivo sin re-render (no se pierde el cursor). */
const INPUT_BINDINGS = {
  "detail-qty": (el) => { App.state.productDetailQty = Math.max(1, Number(el.value) || 1); },
  "cfg-panel-qty": (el) => {
    const cfg = App.state.configurator;
    cfg.panelQty = Math.max(1, Math.round(Number(el.value)) || 1);
    const panel = PRODUCTS.find((p) => p.id === cfg.panelId);
    if (panel) App.setText("panel-total-power", fmtNum(panel.specs.pmax * cfg.panelQty));
  },
  "cfg-battery-qty": (el) => {
    const cfg = App.state.configurator;
    cfg.batteryQty = Math.max(1, Math.round(Number(el.value)) || 1);
    const battery = PRODUCTS.find((p) => p.id === cfg.batteryId);
    if (battery) App.setText("battery-total-kwh", fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2));
  },
  "consumption": (el) => {
    const it = App.state.calc.consumption[Number(el.dataset.i)];
    if (!it) return;
    it[el.dataset.field] = el.dataset.field === "name" ? el.value : Math.max(0, Number(el.value) || 0);
    App.calcConsumptionRecompute();
  },
  "cost": (el) => { App.state.calc.cost[el.dataset.field] = Number(el.value) || 0; App.calcCostRecompute(); },
  "savings": (el) => { App.state.calc.savings[el.dataset.field] = Number(el.value) || 0; App.calcSavingsRecompute(); },
  "orient": (el) => {
    const lat = Number(el.value.replace(",", "."));
    App.state.calc.orientation.lat = Number.isFinite(lat) ? Math.max(-90, Math.min(90, lat)) : 0;
    App.calcOrientationRecompute();
  },
  "orient-angle": (el) => App.calcOrientationAngleEdit(el.value),
  "contact": (el) => { App.state.contactDraft[el.dataset.field] = el.value; },
};

/* Change: cuando el valor queda confirmado (selects, o al salir de un número). */
const CHANGE_BINDINGS = {
  "store-sort": (el) => App.setStoreSort(el.value),
  "cfg-wiring": (el) => { App.state.configurator.wiring = el.value; App.render(); },
  "cfg-voltage": (el) => { App.state.configurator.systemVoltage = Number(el.value); App.render(); },
  "cfg-panel-qty": () => App.render(),
  "cfg-battery-qty": () => App.render(),
  "detail-qty": () => App.render(),
  "demo-panel": (el) => { App.state.homeDemo.panelId = el.value; App.renderHomeDemo(); },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (!fn) return;
  if (el.tagName !== "A") e.preventDefault();
  fn(el.dataset, el);
});

document.addEventListener("input", (e) => {
  const fn = INPUT_BINDINGS[e.target.dataset && e.target.dataset.bind];
  if (fn) fn(e.target);
});

document.addEventListener("change", (e) => {
  const fn = CHANGE_BINDINGS[e.target.dataset && e.target.dataset.bind];
  if (fn) fn(e.target);
});

// <details> no burbujea "toggle": se escucha en captura
document.addEventListener("toggle", (e) => {
  if (e.target.dataset && e.target.dataset.bind === "filters-open") App.state.filtersOpen = e.target.open;
}, true);

document.addEventListener("submit", (e) => {
  if (e.target.dataset.form === "contact") { e.preventDefault(); App.submitContact(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && App.state.mobileNavOpen) {
    App.toggleMobileNav(false);
    document.querySelector('[data-fid="menu"]')?.focus();
  }
});

/* =========================================================================
   ROUTER
   Traduce el hash (#store/panel?marca=X, #product/db-1, #calculators/ahorro,
   #configurator?tipo=hybrid…) en estado + render.
   ========================================================================= */
function applyRouteFromHash() {
  const raw = location.hash.replace(/^#/, "");
  const [path, query] = raw.split("?");
  const [view, rawParam] = path.split("/");
  const param = rawParam ? decodeURIComponent(rawParam) : "";
  const params = new URLSearchParams(query || "");
  const s = App.state;
  let afterRender = null;

  if (!path || view === "home") {
    s.view = "home";
  } else if (view === "store") {
    s.view = "store";
    s.storeCategory = param || "all";
    s.storeFilters = {
      brand: params.get("marca") || null,
      tech: params.get("tecnologia") || null,
      systemType: params.get("sistema") || null,
    };
    s.storeSort = params.get("orden") || "none";
  } else if (view === "product") {
    if (!param) return;
    s.view = "product-detail";
    if (s.selectedProductId !== param) s.productDetailQty = 1;
    s.selectedProductId = param;
  } else if (view === "configurator") {
    s.view = "configurator";
    const tipo = params.get("tipo");
    if (tipo && SYSTEM_TYPES.some((t) => t.id === tipo)) {
      s.configurator = defaultConfigurator();
      s.configurator.systemTypeId = tipo;
      s.configurator.step = 1;
      history.replaceState(null, "", "#configurator"); // el preseleccionado no queda pegado a la URL
    }
  } else if (view === "calculators") {
    s.view = "calculators";
    s.calcSection = param || null;
  } else if (["cart", "info", "contact", "terms", "privacy"].includes(view)) {
    s.view = view;
    if (view === "contact") s.contactErrors = {};
  } else {
    return; // hash desconocido: no tocamos el estado actual
  }

  s.mobileNavOpen = false;

  // Solo se vuelve arriba (y se mueve el foco) al cambiar de página; cambiar
  // un filtro o el orden de la tienda mantiene la posición.
  const routeKey = view === "calculators" ? "calculators" : `${s.view}/${param}`;
  const pageChanged = routeKey !== App.lastRouteKey;
  if (pageChanged) {
    if (s.view !== "home") App.homeRevealed = false;
    if (!afterRender) window.scrollTo({ top: 0, behavior: "auto" });
  }
  const isFirst = App.lastRouteKey === null;
  App.lastRouteKey = routeKey;

  App.render(pageChanged && !isFirst ? { focusSelector: "#main" } : {});
  if (afterRender) requestAnimationFrame(afterRender);
}

/* Único punto de entrada para navegar desde código: siempre pasa por el hash,
   así "Atrás" del navegador y los links quedan consistentes. */
function navigateHash(newHash) {
  const current = location.hash.replace(/^#/, "");
  if (current === newHash) applyRouteFromHash();
  else location.hash = newHash;
}

window.addEventListener("hashchange", applyRouteFromHash);

/* =========================================================================
   "Volver arriba": se muestra al pasar los 600px de scroll. Usa un
   IntersectionObserver sobre un centinela (sin listener de scroll).
   ========================================================================= */
function setupBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn || !("IntersectionObserver" in window)) return;
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;top:600px;left:0;width:1px;height:1px;pointer-events:none";
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    btn.classList.toggle("is-visible", !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(sentinel);
}

/* =========================================================================
   INICIALIZACIÓN
   Intenta cargar productos reales desde la API. Si el backend no responde
   (apagado, CORS, red), sigue con el catálogo de demo para que la página
   nunca quede en blanco.
   ========================================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  setupBackToTop();
  const waFab = document.getElementById("wa-fab");
  if (waFab) waFab.href = whatsappLink("Hola, quiero hacer una consulta.");

  // Si el catálogo tarda, se avisa en vez de dejar un esqueleto mudo.
  const slowTimer = setTimeout(() => {
    const t = document.getElementById("boot-text");
    if (t) t.textContent = "Está tardando más de lo normal. Seguimos intentando…";
  }, 2500);

  try {
    const apiProducts = await loadProductsFromAPI();
    if (apiProducts && apiProducts.length > 0) {
      PRODUCTS = apiProducts;
    } else {
      console.warn("Usando catálogo de demo: no se pudo conectar con la API en", API_BASE_URL);
    }
    App.state.cart = restoreCart();
    App.cartReady = true;
    clearTimeout(slowTimer);
    applyRouteFromHash();
  } catch (err) {
    clearTimeout(slowTimer);
    console.error("Error inicializando la app:", err);
    document.getElementById("app-root").innerHTML = `
      <div class="wrap page">
        <div class="empty">
          ${icon("warning-circle")}
          <h1 class="page-title" style="font-size:1.75rem">No pudimos cargar la página</h1>
          <p>Recargá para intentar de nuevo. Si sigue pasando, revisá la consola del navegador (F12).</p>
          <button type="button" class="btn btn-primary" data-action="reload">Recargar</button>
        </div>
      </div>`;
  }
});
