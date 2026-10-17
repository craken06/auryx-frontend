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
    tMinC: null, // null = la temperatura de diseño por defecto del backend
  };
}

/* Estado de #ingresar: busy = esperando a la API; slow = pasaron 5 s (Render despertando);
   gsiError = no cargó el script de Google. */
function defaultLogin() { return { busy: false, slow: false, error: null, gsiError: false }; }

const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* modo privado: se ignora */ } }

/* Mensaje para un error de la API. Sin status = no hubo respuesta (red caída): se evita el
   "Failed to fetch" del navegador; el timeout ya trae su propio mensaje. */
function apiErrorText(err) {
  return err.status || /tardó/.test(err.message) ? err.message : "No pudimos conectar con el servidor. Probá de nuevo en un rato.";
}

/* Lo tipeado en el checkout se guarda en sessionStorage antes de pagar: si la sesión venció
   (401), después de ingresar de nuevo se vuelve al carrito con todo como estaba. */
const CHECKOUT_DRAFT_KEY = "auryx-checkout-draft";
function saveCheckoutDraft(c) {
  const { errors, sending, slow, status, ...draft } = c;
  try { sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* se ignora */ }
}
function clearCheckoutDraft() {
  try { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); } catch (e) { /* se ignora */ }
}
function takeCheckoutDraft() {
  let draft = null;
  try { draft = JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT_KEY) || "null"); } catch (e) { draft = null; }
  clearCheckoutDraft();
  return draft && typeof draft === "object" ? draft : null;
}

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
    sizer: defaultSizer(),
    cfgTool: "sizer", // "sizer" (dimensionador) o "steps" (paso a paso)
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
    contactSending: false,
    checkout: defaultCheckout(), // formulario del checkout (ver cart.js)
    order: null, // { id, data, error, notMine } de la página #pedido/<id>
    myOrders: null, // { data, error, slow } de #mis-pedidos
    account: defaultAccountForm(), // formulario de #mi-cuenta
    revocation: { errors: {} },
    login: defaultLogin(), // estado de #ingresar
  },

  cartReady: false, // hasta restaurar el carrito guardado no se escribe nada (evita pisarlo con uno vacío)
  lastRouteKey: null,
  homeRevealed: false,
  toastTimer: null,
  toastAction: null,
  gsiInitialized: false, // google.accounts.id.initialize se llama una sola vez
  meFetchedToken: null, // GET /me se pide una vez por visita (y de nuevo si cambia la sesión)

  get cartCount() { return this.state.cart.reduce((s, it) => s + Number(it.qty), 0); },

  /* ---------------------------------------------------------------- render */
  render({ focusSelector } = {}) {
    const s = this.state;
    const active = document.activeElement;
    const fid = active && active !== document.body ? (active.dataset.fid || (active.id ? `#${active.id}` : null)) : null;

    document.getElementById("nav-root").innerHTML = renderNav({
      view: s.view, currency: s.currency, cart: s.cart, cartCount: this.cartCount, mobileNavOpen: s.mobileNavOpen, theme: s.theme,
      session: getSession(),
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
      case "order": body = renderOrder(s); break;
      case "revocation": body = renderRevocation(s); break;
      case "login": body = renderLogin(s); break;
      case "my-orders": body = renderMyOrders(s); break;
      case "my-account": body = renderMyAccount(s); break;
      default: body = renderHome(s);
    }
    document.getElementById("app-root").innerHTML = body;

    const footer = document.getElementById("footer-root");
    if (!footer.dataset.ready) { footer.innerHTML = renderFooter(); footer.dataset.ready = "1"; }

    this.setupReveal();
    if (this.cartReady) persistCart(s.cart);
    if (s.view === "calculators") this.calcFetchWarnings();
    if (s.view === "login" || s.view === "cart") this.mountGoogleButton();

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

  /* ---------------------------------------------------------------- cuenta */
  /* El render reemplaza el HTML de la página: el botón de Google se vuelve a
     dibujar en #gsi-button después de cada render de #ingresar o del carrito
     (el script se carga solo cuando hay que mostrar el botón). */
  mountGoogleButton() {
    const s = this.state;
    if (!GOOGLE_CLIENT_ID || s.login.gsiError || getSession() || !document.getElementById("gsi-button")) return;
    loadGoogleScript().then(() => {
      if (!this.gsiInitialized) {
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (resp) => App.loginWithGoogle(resp.credential) });
        this.gsiInitialized = true;
      }
      const el = document.getElementById("gsi-button");
      if (el) google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "continue_with", locale: "es" });
    }).catch(() => {
      s.login.gsiError = true;
      if (s.view === "login" || s.view === "cart") this.render();
    });
  },

  /* El comprobante de Google se cambia por un token propio. Con la API dormida
     (Render gratis) puede tardar cerca de un minuto: se avisa a los 5 s. */
  async loginWithGoogle(credential) {
    const l = this.state.login;
    if (l.busy) return;
    Object.assign(l, { busy: true, slow: false, error: null });
    this.render();
    const onLoginPage = () => this.state.view === "login" || this.state.view === "cart";
    const slowTimer = setTimeout(() => {
      if (!l.busy) return;
      l.slow = true;
      if (onLoginPage()) this.render();
    }, 5000);
    try {
      const data = await apiRequest("/customer-auth/google", { method: "POST", body: { credential }, timeoutMs: 70000 });
      // sin token o sin cliente no se guarda nada: sería una sesión rota
      if (!data || typeof data.token !== "string" || !data.token || !data.customer || typeof data.customer !== "object") {
        const bad = new Error("No pudimos completar el ingreso. Probá de nuevo.");
        bad.status = 0;
        throw bad;
      }
      setSession(data);
      this.state.login = defaultLogin();
      const after = takeAfterLogin();
      // desde el carrito se sigue en el carrito, ya con el formulario de compra
      navigateHash(this.state.view === "cart" ? "cart" : after);
      this.toast(`Hola, ${esc(customerFirstName(data.customer))}. Ya ingresaste.`);
    } catch (err) {
      // sin respuesta de la API (red caída): mensaje propio en vez del "Failed to fetch" del navegador
      const error = err.status === 0 ? err.message : apiErrorText(err);
      Object.assign(l, { busy: false, slow: false, error });
      if (onLoginPage()) this.render({ focusSelector: ".login-status" });
    } finally {
      clearTimeout(slowTimer);
    }
  },

  /* stay: "¿No sos vos? Salir" del checkout se queda en el carrito. */
  logout({ stay = false } = {}) {
    clearSession();
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* se ignora */ }
    this.forgetAccountData();
    this.state.mobileNavOpen = false;
    if (stay) this.render();
    else navigateHash("");
    this.toast("Cerraste sesión.");
  },

  /* Sin sesión no quedan a la vista datos de la cuenta anterior. */
  forgetAccountData() {
    const s = this.state;
    s.checkout = defaultCheckout();
    s.account = defaultAccountForm();
    s.myOrders = null;
    if (s.order && isOrderCode(s.order.id)) s.order = null;
    this.meFetchedToken = null;
    clearCheckoutDraft();
  },

  /* Al entrar al carrito: si se volvió de ingresar después de un 401, se recupera lo tipeado;
     si no, con sesión se precarga lo guardado en la cuenta (sin pisar lo que el usuario escribió). */
  prepareCheckout(entering) {
    const s = this.state;
    const draft = takeCheckoutDraft();
    if (draft) {
      s.checkout = { ...defaultCheckout(), ...draft, address: { ...emptyAddress(), ...(draft.address || {}) }, touched: true };
    }
    const session = getSession();
    if (!session) return;
    if (!s.checkout.touched) fillFromCustomer(s.checkout, session.customer);
    if (entering || this.meFetchedToken !== session.token) this.refreshMe("checkout");
  },

  /* Trae los datos de la cuenta (pueden haber cambiado en otro dispositivo) y, si el usuario
     todavía no tocó el formulario, lo vuelve a completar. Sin respuesta queda lo de la sesión. */
  async refreshMe(formKey) {
    const session = getSession();
    if (!session) return;
    this.meFetchedToken = session.token;
    let me;
    try { me = await apiRequest("/me", { auth: true, timeoutMs: 70000 }); } catch (err) { return; } // 401: apiRequest ya pidió ingresar
    const now = getSession();
    if (!now || now.token !== session.token || !me || typeof me !== "object") return;
    setSession({ token: now.token, customer: me });
    const form = this.state[formKey];
    if (!form || form.touched || form.sending) return;
    fillFromCustomer(form, me);
    if (this.state.view === { checkout: "cart", account: "my-account" }[formKey]) this.render();
  },

  /* #mis-pedidos: se pide de nuevo en cada visita. */
  async loadMyOrders() {
    const s = this.state;
    const m = { data: null, error: null, slow: false };
    s.myOrders = m;
    const slowTimer = setTimeout(() => {
      m.slow = true;
      if (s.myOrders === m && s.view === "my-orders" && !m.data && !m.error) this.render();
    }, 5000);
    try {
      const data = await apiRequest("/me/orders", { auth: true, timeoutMs: 70000 });
      m.data = Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.status === 401) return; // apiRequest ya pidió ingresar
      m.error = apiErrorText(err);
    } finally {
      clearTimeout(slowTimer);
    }
    if (s.myOrders === m && s.view === "my-orders") this.render();
  },

  /* #mi-cuenta: PATCH /me. Lo que queda vacío se borra de la cuenta (null). */
  async saveMyAccount() {
    const s = this.state;
    const f = s.account;
    if (f.sending) return;
    const errors = {};
    if (trimStr(f.phone)) { const e = phoneError(f.phone); if (e) errors.phone = e; }
    if (!addressIsEmpty(f.address)) Object.assign(errors, addressErrors(f.address));
    Object.assign(errors, billingErrors(f.billingDoc, f.billingName));
    f.errors = errors;
    const first = firstErrorField(errors);
    if (first) { f.status = null; this.render({ focusSelector: `#account-${first}` }); return; }

    const hasBilling = trimStr(f.billingDoc) || trimStr(f.billingName);
    const body = {
      phone: trimStr(f.phone) || null,
      defaultAddress: addressIsEmpty(f.address) ? null : addressBody(f.address),
      billing: hasBilling ? { doc: trimStr(f.billingDoc), name: trimStr(f.billingName) } : null,
    };
    Object.assign(f, { sending: true, slow: false, status: null });
    this.render();
    const slowTimer = setTimeout(() => {
      if (!f.sending) return;
      f.slow = true;
      if (s.account === f && s.view === "my-account") this.render();
    }, 5000);
    try {
      const me = await apiRequest("/me", { method: "PATCH", auth: true, timeoutMs: 70000, body });
      const session = getSession();
      if (session && me && typeof me === "object") {
        setSession({ token: session.token, customer: me });
        fillFromCustomer(f, me);
      }
      Object.assign(f, { sending: false, slow: false, touched: false, status: { tone: "ok", text: "Guardamos tus datos." } });
    } catch (err) {
      Object.assign(f, { sending: false, slow: false });
      if (err.status === 401) return; // apiRequest ya pidió ingresar
      f.status = { tone: "bad", text: apiErrorText(err) };
    } finally {
      clearTimeout(slowTimer);
    }
    if (s.account === f && s.view === "my-account") this.render({ focusSelector: ".account-form .form-status" });
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
  async submitCheckout() {
    const s = this.state;
    const c = s.checkout;
    if (c.sending) return;
    c.errors = checkoutErrors(c);
    const firstError = firstErrorField(c.errors);
    if (firstError) { c.status = null; this.render({ focusSelector: `#checkout-${firstError}` }); return; }

    // antes de llamar: si la sesión venció (401), apiRequest lleva a #ingresar y al volver se recupera
    saveCheckoutDraft(c);
    Object.assign(c, { sending: true, slow: false, status: null });
    this.render();
    // Render gratis puede estar dormido: a los 5 s se avisa que puede tardar
    const slowTimer = setTimeout(() => {
      if (!c.sending) return;
      c.slow = true;
      if (s.checkout === c && s.view === "cart") this.render();
    }, 5000);
    try {
      const order = await apiRequest("/orders", { method: "POST", auth: true, timeoutMs: 70000, body: checkoutBody(c, s.cart) });
      clearCheckoutDraft();
      storageSet("auryx-last-order", order.code);
      const payUrl = safePaymentUrl(order.paymentUrl);
      if (payUrl) { window.location.href = payUrl; return; } // sigue en Mercado Pago
      Object.assign(c, { sending: false, slow: false });
      navigateHash(`pedido/${order.code}`);
    } catch (err) {
      Object.assign(c, { sending: false, slow: false });
      if (err.status === 401) return; // ya se fue a #ingresar; lo tipeado queda en sessionStorage
      clearCheckoutDraft();
      // validación (400) o demasiados intentos (429): el mensaje de la API tal cual
      const text = err.status && err.status < 500 ? err.message : `${apiErrorText(err)} Si sigue fallando, pedí la cotización por WhatsApp.`;
      c.status = { tone: "bad", text };
      if (s.checkout === c && s.view === "cart") this.render({ focusSelector: ".checkout-form .form-status" });
    } finally {
      clearTimeout(slowTimer);
    }
  },

  /* Estado del pedido: si el pago todavía no se acreditó, se reintenta unos segundos (el aviso de MP puede llegar después).
     Con código AX-… el pedido es de un cliente: se pide con su sesión, y un 404 es "no es de tu cuenta".
     Con UUID (pedidos viejos, sin cuenta) se consulta como siempre, sin sesión. */
  async loadOrder(id, attempt = 0) {
    const s = this.state;
    const byCode = isOrderCode(id);
    if (attempt === 0) s.order = { id, data: null, error: null, notMine: false };
    try {
      const data = await apiRequest(`/orders/${encodeURIComponent(id)}`, byCode ? { auth: true, timeoutMs: 70000 } : {});
      if (!s.order || s.order.id !== id) return; // el usuario ya se fue de la página
      s.order.data = data;
      const last = (storageGet("auryx-last-order") || "").toUpperCase();
      if (data.status === "pagado" && last && last === String(data.code || id).toUpperCase()) {
        s.cart = []; // pedido pagado: se vacía el carrito que lo originó
        storageSet("auryx-last-order", "");
      }
      if (s.view === "order") this.render();
      if (data.status === "pendiente_pago" && attempt < 6) setTimeout(() => this.loadOrder(id, attempt + 1), 4000);
    } catch (err) {
      if (!s.order || s.order.id !== id) return;
      if (byCode && err.status === 401) { s.order = null; return; } // apiRequest ya pidió ingresar; al volver se consulta de nuevo
      if (byCode && err.status === 404) s.order.notMine = true;
      else if (byCode) s.order.error = apiErrorText(err);
      else s.order.error = /no encontrado|Validation|uuid/i.test(err.message) ? "El número de pedido no es válido." : err.message;
      if (s.view === "order") this.render();
    }
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

  /* Las fórmulas se muestran al instante en el navegador; el backend (POST /calculators/*)
     agrega las advertencias. Se consulta con una pausa para no llamar en cada tecla. */
  calcWarnTimer: null,
  calcFetchWarnings() {
    clearTimeout(this.calcWarnTimer);
    this.calcWarnTimer = setTimeout(async () => {
      const s = this.state;
      const section = CALCULATOR_RENDERERS[s.calcSection] ? s.calcSection : CALCULATOR_LINKS[0].id;
      const c = s.calc;
      const req = {
        consumo: ["/calculators/consumption", { items: c.consumption }],
        costo: ["/calculators/cost", c.cost],
        ahorro: ["/calculators/savings", c.savings],
        orientacion: c.orientation.mode === "optimal" ? ["/calculators/orientation", { lat: c.orientation.lat }] : null,
      }[section];
      const box = document.getElementById(`calc-warn-${section}`);
      if (!box) return;
      if (!req) { box.innerHTML = ""; return; }
      try {
        const { warnings } = await apiRequest(req[0], { method: "POST", body: req[1], timeoutMs: 5000 });
        const target = document.getElementById(`calc-warn-${section}`);
        if (target) target.innerHTML = calcWarningsHTML(warnings);
      } catch (err) {
        box.innerHTML = ""; // sin API las calculadoras siguen funcionando, sólo sin advertencias
      }
    }, 400);
  },

  calcConsumptionRecompute() {
    const t = consumptionTotals(this.state.calc.consumption);
    this.setText("consumption-daily", t.daily);
    this.setText("consumption-monthly", t.monthly);
    this.setText("consumption-yearly", t.yearly);
    this.calcFetchWarnings();
  },
  calcCostRecompute() {
    const { kwh, pricePerKwh } = this.state.calc.cost;
    this.setText("cost-total", fmtMoney(kwh * pricePerKwh));
    this.calcFetchWarnings();
  },
  calcSavingsRecompute() {
    const t = savingsTotals(this.state.calc.savings);
    this.setText("sav-monthly", t.monthly);
    this.setText("sav-yearly", t.yearly);
    this.setText("sav-pct", t.pct);
    this.calcFetchWarnings();
  },
  calcOrientationRecompute() {
    const t = orientationTotals(this.state.calc.orientation);
    this.setText("orient-azimuth", t.azimuth);
    this.setText("orient-angle", `≈ ${t.angle}°`);
    this.calcOrientationDraw(t.angle);
    this.calcFetchWarnings();
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

  /* ---------------------------------------------------------------- dimensionador */
  /* Re-render del dimensionador completo (cambio de pestaña, objetivo o equipo)
     devolviendo el foco al control que lo disparó. */
  renderSizer() {
    const root = document.getElementById("sizer-root");
    if (!root) return;
    const active = document.activeElement;
    const fid = active && root.contains(active) ? (active.dataset.fid || active.id) : null;
    root.innerHTML = renderSizer(this.state.sizer, this.state.currency);
    if (!fid) return;
    const el = root.querySelector(`[data-fid="${CSS.escape(fid)}"]`) || document.getElementById(fid);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  },
  /* Solo el resultado: mientras se tipea en un número, el formulario no se toca. */
  renderSizerOutput() {
    const out = document.getElementById("sizer-out");
    if (out) out.innerHTML = sizerOutputHTML(this.state.sizer, this.state.currency);
  },
  sizerSet(scope, field, value) {
    const sz = this.state.sizer;
    sz[scope][field] = value;
    if (scope === "custom") sizerNormalizeCustom(sz.custom);
  },

  /* ---------------------------------------------------------------- contacto */
  async submitContact() {
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

    s.contactSending = true;
    s.contactStatus = null;
    this.render();
    try {
      await apiRequest("/contact", { method: "POST", body: { name: d.name, email: d.email, phone: d.phone || undefined, message: d.message, website: d.website || undefined } });
      s.contactSending = false;
      s.contactDraft = {};
      s.contactStatus = { tone: "ok", text: "¡Gracias! Recibimos tu mensaje y te respondemos dentro de las 48 h hábiles." };
      this.render({ focusSelector: ".form-status" });
      return;
    } catch (err) {
      s.contactSending = false;
      // error de validación (4xx): se muestra; sin respuesta o error del servidor: canal alternativo
      if (err.status && err.status < 500 && err.status !== 404) {
        s.contactStatus = { tone: "bad", text: err.message };
        this.render({ focusSelector: ".form-status" });
        return;
      }
    }

    const body = `${d.message}\n\n${d.name}\n${d.email}${d.phone ? `\n${d.phone}` : ""}`;
    if (typeof CONTACT_EMAIL === "string" && CONTACT_EMAIL) {
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Consulta web: ${d.name}`)}&body=${encodeURIComponent(body)}`;
      s.contactStatus = { tone: "ok", text: "Abrimos tu programa de correo con el mensaje listo. Solo falta que lo envíes." };
    } else {
      // Sin backend ni email configurado, el canal es WhatsApp con el mensaje armado.
      window.open(whatsappLink(body), "_blank", "noopener");
      s.contactStatus = { tone: "ok", text: "No pudimos conectar con el servidor: abrimos WhatsApp con tu mensaje listo. Solo falta que lo envíes." };
    }
    this.render({ focusSelector: ".form-status" });
  },
};

App.submitRevocation = async function () {
  const r = this.state.revocation;
  const errors = {};
  if ((r.name || "").trim().length < 2) errors.name = "Escribí tu nombre.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((r.email || "").trim())) errors.email = "Revisá el email.";
  if (!(r.orderId || "").trim()) errors.orderId = "Indicá el número de pedido (está en el mail o en la página del pedido).";
  r.errors = errors;
  const first = ["name", "email", "orderId"].find((k) => errors[k]);
  if (first) { r.status = null; this.render({ focusSelector: `#rev-${first}` }); return; }
  try {
    await apiRequest("/contact", { method: "POST", body: {
      name: r.name, email: r.email, phone: r.phone || undefined,
      message: `[BOTÓN DE ARREPENTIMIENTO] Pedido: ${r.orderId.trim()}\n\n${(r.reason || "").trim() || "(sin comentarios)"}`,
    } });
    this.state.revocation = { errors: {}, done: true };
  } catch (err) {
    r.status = { tone: "bad", text: `${err.message} También podés pedirlo por WhatsApp.` };
  }
  this.render({ focusSelector: ".form-status" });
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
  // link "Ingresar": recuerda la página actual para volver después (el link navega solo)
  "login-start": () => rememberAfterLogin(location.hash),
  "logout": (d) => App.logout({ stay: d.stay === "1" }),
  "my-orders-retry": () => { App.loadMyOrders(); App.render(); },

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

  "sizer-mode": (d) => { App.state.sizer.mode = d.mode; App.renderSizer(); },
  "sizer-pick": (d) => { App.sizerSet(d.scope, d.field, d.value); App.renderSizer(); },
};

/* Inputs: actualización en vivo sin re-render (no se pierde el cursor). */
/* Checkout y Mis datos: los campos de dirección van en form.address; touched = ya tipeó (la precarga no lo pisa). */
function setFormField(form, el) {
  if (el.dataset.group === "address") form.address[el.dataset.field] = el.value;
  else form[el.dataset.field] = el.value;
  form.touched = true;
}

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
  "checkout": (el) => setFormField(App.state.checkout, el),
  "account": (el) => setFormField(App.state.account, el),
  "revocation": (el) => { App.state.revocation[el.dataset.field] = el.value; },
  "sizer": (el) => {
    if (el.tagName === "SELECT") return; // los selects se resuelven en "change"
    App.state.sizer[el.dataset.scope][el.dataset.field] = el.value;
    App.renderSizerOutput();
  },
};

/* Change: cuando el valor queda confirmado (selects, o al salir de un número). */
const CHANGE_BINDINGS = {
  "store-sort": (el) => App.setStoreSort(el.value),
  "cfg-wiring": (el) => { App.state.configurator.wiring = el.value; App.render(); },
  "cfg-voltage": (el) => { App.state.configurator.systemVoltage = Number(el.value); App.render(); },
  "cfg-tmin": (el) => {
    const t = Math.round(Number(el.value));
    App.state.configurator.tMinC = Number.isFinite(t) && el.value !== "" ? Math.max(-40, Math.min(30, t)) : null;
    App.render();
  },
  "cfg-panel-qty": () => App.render(),
  "cfg-battery-qty": () => App.render(),
  "detail-qty": () => App.render(),
  "checkout-delivery": (el) => {
    const c = App.state.checkout;
    c.delivery = el.value === "retiro" ? "retiro" : "envio";
    c.touched = true;
    App.render(); // muestra u oculta la dirección; el foco vuelve al radio
  },
  "checkout-save": (el) => { App.state.checkout.saveDetails = el.checked; App.state.checkout.touched = true; },
  "sizer": (el) => {
    // en el personalizado, consumo, superficie, etc. cambian el inversor automático y sus baterías:
    // al confirmar el valor se redibuja el formulario completo
    if (el.tagName !== "SELECT" && el.dataset.scope !== "custom") return;
    App.sizerSet(el.dataset.scope, el.dataset.field, el.value);
    App.renderSizer();
  },
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

// La foto de la cuenta que no carga se quita y queda la inicial ("error" no burbujea: captura)
document.addEventListener("error", (e) => {
  if (!(e.target && e.target.matches && e.target.matches("img[data-avatar-img]"))) return;
  BROKEN_AVATARS.add(e.target.getAttribute("src"));
  e.target.remove();
}, true);

// Ingreso o salida en otra pestaña: se actualiza el header. Si se cerró la sesión y la página
// actual es de la cuenta (Mis pedidos, Mis datos, un pedido con código), se pide ingresar.
window.addEventListener("storage", (e) => {
  if (e.key !== SESSION_KEY || !App.cartReady) return;
  const s = App.state;
  if (!getSession()) {
    const accountPage = s.view === "my-orders" || s.view === "my-account" || (s.view === "order" && s.order && isOrderCode(s.order.id));
    App.forgetAccountData();
    if (accountPage) {
      rememberAfterLogin(location.hash);
      navigateHash("ingresar");
      return;
    }
  } else if (s.view === "cart") {
    App.prepareCheckout(false);
  }
  App.render();
});

// <details> no burbujea "toggle": se escucha en captura
document.addEventListener("toggle", (e) => {
  if (e.target.dataset && e.target.dataset.bind === "filters-open") App.state.filtersOpen = e.target.open;
  if (e.target.dataset && e.target.dataset.bind === "checkout-billing") App.state.checkout.billingOpen = e.target.open;
}, true);

document.addEventListener("submit", (e) => {
  if (e.target.dataset.form === "contact") { e.preventDefault(); App.submitContact(); }
  if (e.target.dataset.form === "checkout") { e.preventDefault(); App.submitCheckout(); }
  if (e.target.dataset.form === "account") { e.preventDefault(); App.saveMyAccount(); }
  if (e.target.dataset.form === "revocation") { e.preventDefault(); App.submitRevocation(); }
  if (e.target.dataset.form === "sizer") e.preventDefault();
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
    s.cfgTool = param === "paso-a-paso" ? "steps" : "sizer";
    const tipo = params.get("tipo");
    if (tipo && SYSTEM_TYPES.some((t) => t.id === tipo)) {
      s.cfgTool = "steps";
      s.configurator = defaultConfigurator();
      s.configurator.systemTypeId = tipo;
      s.configurator.step = 1;
      history.replaceState(null, "", "#configurator/paso-a-paso"); // el preseleccionado no queda pegado a la URL
    }
  } else if (view === "calculators") {
    s.view = "calculators";
    s.calcSection = param || null;
  } else if (view === "pedido") {
    if (!param) return;
    if (isOrderCode(param) && !getSession()) {
      routeToLogin(raw); // el pedido con código es de una cuenta
    } else {
      s.view = "order";
      if (!s.order || s.order.id !== param) App.loadOrder(param);
    }
  } else if (view === "arrepentimiento") {
    s.view = "revocation";
  } else if (view === "ingresar") {
    if (s.view !== "login" && !s.login.busy) s.login = defaultLogin();
    // llegó por un 401: se explica por qué hay que ingresar de nuevo
    if (takeSessionExpired() && !s.login.busy) s.login.error = "Tu sesión venció. Ingresá de nuevo.";
    s.view = "login";
  } else if (view === "mis-pedidos" || view === "mi-cuenta") {
    const next = view === "mis-pedidos" ? "my-orders" : "my-account";
    if (!getSession()) {
      routeToLogin(raw); // después de ingresar se vuelve acá
    } else if (s.view !== next) {
      s.view = next;
      if (next === "my-orders") App.loadMyOrders();
      else {
        s.account = defaultAccountForm();
        fillFromCustomer(s.account, getSession().customer);
        App.refreshMe("account");
      }
    }
  } else if (view === "cart") {
    const entering = s.view !== "cart";
    if (entering && !s.login.busy) s.login = defaultLogin();
    s.view = "cart";
    App.prepareCheckout(entering);
  } else if (["info", "contact", "terms", "privacy"].includes(view)) {
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

/* Página que necesita sesión: se recuerda el destino y se muestra #ingresar en su lugar. */
function routeToLogin(raw) {
  const s = App.state;
  rememberAfterLogin(raw);
  history.replaceState(null, "", "#ingresar");
  if (s.view !== "login" && !s.login.busy) s.login = defaultLogin();
  s.view = "login";
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
    const [apiProducts] = await Promise.all([loadProductsFromAPI(), loadCompatibilityParams()]);
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
