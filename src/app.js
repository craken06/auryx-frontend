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

/* Analítica (lib/analytics.js). Si ese archivo no cargó (un bloqueador, un error de red), el
   sitio tiene que funcionar igual: se usa un reemplazo que no hace nada. */
const Track = typeof Analytics !== "undefined" ? Analytics : {
  enabled: () => false, consent: () => null, setConsent() {}, resetConsent() {},
  pageView() {}, event: () => false, attribution: () => ({ first: null, session: null }), refCode: () => "",
};

const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* modo privado: se ignora */ } }

/* Mensaje para un error de la API. Sin status = no hubo respuesta (red caída): se evita el
   "Failed to fetch" del navegador; el timeout ya trae su propio mensaje. */
function apiErrorText(err) {
  return err.status || /tardó/.test(err.message) ? err.message : "No pudimos conectar con el servidor. Probá de nuevo en un rato.";
}

/* Lo tipeado en el checkout se guarda en sessionStorage antes de pagar: si la sesión venció
   (401), después de ingresar de nuevo se vuelve al carrito con todo como estaba. El borrador
   lleva el id del cliente: solo se recupera si vuelve a ingresar la misma persona. */
const CHECKOUT_DRAFT_KEY = "auryx-checkout-draft";
function saveCheckoutDraft(c, customerId) {
  const { errors, sending, slow, status, ...draft } = c;
  draft.customerId = customerId;
  try { sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* se ignora */ }
}
function peekCheckoutDraft() {
  try { return JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT_KEY) || "null"); } catch (e) { return null; }
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
   actual). Las líneas cuyo producto ya no está en el catálogo (se despublicó) se conservan
   aparte para no perderlas si vuelve. */
const CART_KEY = "auryx-cart";

/* Tope de unidades por línea (ficha, carrito, configurador): evita totales absurdos por un tipeo. */
const MAX_QTY = typeof DETAIL_QTY_MAX === "number" ? DETAIL_QTY_MAX : 999; // el mismo tope que muestra la ficha
const clampQty = (n, min = 1) => Math.max(min, Math.min(MAX_QTY, Math.round(Number(n)) || min));
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
    const qty = clampQty(it && it.qty);
    const product = it && PRODUCTS.find((p) => p.id === it.id);
    if (!product) { if (it && it.id) unresolvedCart.push({ id: it.id, qty, systemId: it.systemId || null }); return; }
    const line = { product, qty };
    if (it.systemId) line.systemId = it.systemId;
    cart.push(line);
  });
  return cart;
}

/* Unidades del carrito guardado, sin el catálogo: el ícono del menú las muestra desde la home. */
function storedCartCount() {
  let saved = [];
  try { saved = JSON.parse(storageGet(CART_KEY) || "[]"); } catch (e) { saved = []; }
  return Array.isArray(saved) ? saved.reduce((s, it) => s + (it && it.id ? clampQty(it.qty) : 0), 0) : 0;
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
      cost: { kwh: 300, province: "ba", dist: "edenor" },
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
    revocationSending: false, // el formulario de arrepentimiento se está enviando
    login: defaultLogin(), // estado de #ingresar
    // "idle" (todavía no se pidió: solo lo piden las páginas de CATALOG_VIEWS) | "loading" | "slow" (tarda
    // más de lo normal) | "ready" | "error"
    catalog: "idle",
  },

  cartReady: false, // hasta restaurar el carrito guardado no se escribe nada (evita pisarlo con uno vacío)
  lastRouteKey: null,
  homeRevealed: false,
  toastTimer: null,
  toastAction: null,
  gsiInitialized: false, // google.accounts.id.initialize se llama una sola vez
  gsiMount: 0, // número de montaje del botón de Google: solo dibuja el último pedido
  scrollByRoute: {}, // posición de scroll de cada página, para restaurarla con "Atrás"
  renderPending: false, // render diferido hasta que termine el clic en curso (ver deferRender)
  meFetchedToken: null, // GET /me se pide una vez por visita (y de nuevo si cambia la sesión)
  accountOwnerId: null, // id del cliente cuyos datos están en memoria (checkout, Mis datos, pedidos)

  get cartCount() { return this.cartReady ? this.state.cart.reduce((s, it) => s + Number(it.qty), 0) : storedCartCount(); },

  /* ---------------------------------------------------------------- render */
  render({ focusSelector } = {}) {
    const s = this.state;
    const active = document.activeElement;
    const fid = active && active !== document.body ? (active.dataset.fid || (active.id ? `#${active.id}` : null)) : null;

    document.getElementById("nav-root").innerHTML = renderNav({
      view: s.view, currency: s.currency, cart: s.cart, cartCount: this.cartCount, mobileNavOpen: s.mobileNavOpen, theme: s.theme,
      session: getSession(),
    });
    if (this.accountMenuOpen) setAccountMenu(document.querySelector('#nav-root [data-action="toggle-account-menu"]')?.closest(".dropdown"), true);

    let body = "";
    const waitingCatalog = CATALOG_VIEWS.includes(s.view) && s.catalog !== "ready";
    // en una página estática (/productos/…) se deja el contenido ya dibujado mientras llega el catálogo
    if (waitingCatalog) body = s.catalog !== "error" && onStaticRoute() ? PRERENDER_HTML : catalogStatusHTML(s.catalog);
    else switch (s.view) {
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
      case "not-found": body = notFoundHTML(); break;
      default: body = renderHome(s);
    }
    document.getElementById("app-root").innerHTML = body;

    // el pie se dibuja una vez por estado del catálogo (muestra la cotización cuando llega)
    const footer = document.getElementById("footer-root");
    if (footer.dataset.ready !== s.catalog) { footer.innerHTML = renderFooter(); footer.dataset.ready = s.catalog; }
    this.renderPending = false;

    this.setupReveal();
    if (this.cartReady) persistCart(s.cart);
    if (s.view === "calculators") this.calcFetchWarnings();
    if ((s.view === "login" || s.view === "cart") && !waitingCatalog) this.mountGoogleButton();
    linkifyRoutes();
    updateRouteMeta(); // título, link del botón de WhatsApp y page_view

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
  /* message y action.label son texto plano: se escapan acá (quien llama no escapa).
     Se cierra solo (4 s, o 10 s si tiene una acción como "Deshacer"), pero el tiempo se
     pausa mientras el puntero o el foco están sobre el aviso (WCAG 2.2.1). */
  toast(message, action) {
    const root = document.getElementById("toast-root");
    clearTimeout(this.toastTimer);
    this.toastAction = action || null;
    this.toastDelay = action ? 10000 : 4000;
    root.innerHTML = `
      <div class="toast">
        ${icon("check-circle", "", "fill")}
        <span class="msg">${esc(message)}</span>
        ${action ? (action.href
          ? `<a class="btn btn-secondary btn-sm" href="${esc(action.href)}" data-action="toast-dismiss">${esc(action.label)}</a>`
          : `<button type="button" class="btn btn-secondary btn-sm" data-action="toast-action">${esc(action.label)}</button>`) : ""}
        <button type="button" class="icon-btn toast-close" data-action="toast-dismiss" aria-label="Cerrar aviso">${icon("x")}</button>
      </div>`;
    this.toastTimer = setTimeout(() => this.dismissToast(), this.toastDelay);
  },
  pauseToast() { clearTimeout(this.toastTimer); },
  resumeToast() {
    const root = document.getElementById("toast-root");
    if (!root.firstElementChild || root.matches(":hover") || root.contains(document.activeElement)) return;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.dismissToast(), this.toastDelay || 4000);
  },
  dismissToast() {
    clearTimeout(this.toastTimer);
    this.toastAction = null;
    document.getElementById("toast-root").innerHTML = "";
  },

  /* ---------------------------------------------------------------- cookies */
  /* El banner vive en #cookie-root (fuera de #app-root): se dibuja al iniciar y cuando cambia
     la decisión, no en cada render (así no le roba el foco a nadie). */
  renderCookieBanner() {
    const root = document.getElementById("cookie-root");
    if (!root) return;
    const html = typeof cookieBannerHTML === "function" ? cookieBannerHTML() : "";
    const hadFocus = root.contains(document.activeElement);
    root.innerHTML = html;
    if (hadFocus && !html) document.getElementById("main")?.focus({ preventScroll: true });
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
    // cada render pide un montaje nuevo; si varios esperan al script, solo dibuja el último
    // (antes, cada uno agregaba otro botón al mismo contenedor)
    const mount = ++this.gsiMount;
    loadGoogleScript().then(() => {
      if (mount !== this.gsiMount) return;
      if (!this.gsiInitialized) {
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (resp) => App.loginWithGoogle(resp.credential) });
        this.gsiInitialized = true;
      }
      const el = document.getElementById("gsi-button");
      if (!el) return;
      // va invisible encima de nuestro botón (ver googleSlotHTML): mismo ancho que el contenedor (Google
      // acepta de 200 a 400 px) y "large" mide 44 px de alto, como .btn
      const width = Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320)));
      el.replaceChildren();
      google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width, locale: "es" });
      el.closest(".google-signin")?.removeAttribute("aria-busy");
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
      // ingresó otra persona: no le queda a la vista nada de la anterior (solo un borrador suyo)
      if (this.accountOwnerId !== data.customer.id) this.forgetAccountData({ keepDraftFor: data.customer.id });
      setSession(data);
      this.accountOwnerId = data.customer.id;
      this.state.login = defaultLogin();
      const after = takeAfterLogin();
      // desde el carrito se sigue en el carrito, ya con el formulario de compra
      navigate(this.state.view === "cart" ? "cart" : after);
      Track.event("login", { method: "google" });
      this.toast(`Hola, ${customerFirstName(data.customer)}. Ya ingresaste.`);
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
    this.accountOwnerId = null;
    this.state.mobileNavOpen = false;
    if (stay) this.render();
    else navigate("");
    this.toast("Cerraste sesión.");
  },

  /* Sin sesión (o con otra cuenta) no quedan a la vista datos de la cuenta anterior.
     keepDraftFor: se conserva el borrador del checkout solo si es de ese cliente. */
  forgetAccountData({ keepDraftFor = null } = {}) {
    const s = this.state;
    s.checkout = defaultCheckout();
    s.account = defaultAccountForm();
    s.myOrders = null;
    if (s.order && isOrderCode(s.order.id)) s.order = null;
    this.meFetchedToken = null;
    const draft = peekCheckoutDraft();
    if (!(draft && keepDraftFor !== null && draft.customerId === keepDraftFor)) clearCheckoutDraft();
  },

  /* Al entrar al carrito: si se volvió de ingresar después de un 401, se recupera lo tipeado;
     si no, con sesión se precarga lo guardado en la cuenta (sin pisar lo que el usuario escribió). */
  prepareCheckout(entering) {
    const s = this.state;
    const session = getSession();
    if (!session) return; // el borrador espera a que se vuelva a ingresar
    const draft = takeCheckoutDraft();
    if (draft && draft.customerId === session.customer.id) {
      const { customerId, ...fields } = draft;
      s.checkout = { ...defaultCheckout(), ...fields, address: { ...emptyAddress(), ...(fields.address || {}) }, touched: true };
    }
    if (!s.checkout.touched) fillFromCustomer(s.checkout, session.customer);
    // GET /me una vez por visita al carrito (o si cambió la sesión, p. ej. se ingresó desde el carrito)
    if (entering || this.meFetchedToken !== session.token) this.refreshMe("checkout");
  },

  /* Trae los datos de la cuenta (pueden haber cambiado en otro dispositivo) y, si el usuario
     todavía no tocó el formulario, lo vuelve a completar. Sin respuesta queda lo de la sesión. */
  async refreshMe(formKey) {
    const session = getSession();
    if (!session) return;
    this.meFetchedToken = session.token;
    const viewFor = { checkout: "cart", account: "my-account" }[formKey];
    let me;
    try {
      // sin redirección automática: la respuesta puede llegar un minuto después, en otra página
      me = await apiRequest("/me", { auth: true, timeoutMs: 70000, redirectOn401: false });
    } catch (err) {
      if (err.status !== 401 || getSession()) return; // sin respuesta: queda lo de la sesión
      const s = this.state;
      if (s.view === "cart" && viewFor === "cart") {
        // sesión vencida en el carrito: se sigue en el carrito como invitado, con el aviso
        takeSessionExpired();
        if (!s.login.busy) s.login = { ...defaultLogin(), error: "Tu sesión venció. Ingresá de nuevo." };
        this.render();
      } else if (s.view === "my-account" && viewFor === "my-account") {
        rememberAfterLogin(currentRoute()); // Mis datos necesita sesión
        navigate("ingresar");
      } else {
        takeSessionExpired(); // el usuario ya está en otra página: solo se actualiza el header
        this.render();
      }
      return;
    }
    const now = getSession();
    if (!now || now.token !== session.token || !me || typeof me !== "object") return;
    setSession({ token: now.token, customer: me });
    const form = this.state[formKey];
    if (!form || form.touched || form.sending) return;
    fillFromCustomer(form, me);
    if (this.state.view === viewFor) this.render();
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
    navigate(this.storeHash({ filters: { [key]: current === value ? null : value } }));
  },
  clearStoreFilters() {
    navigate(this.storeHash({ filters: { brand: null, tech: null, systemType: null } }));
  },
  setStoreSort(value) { navigate(this.storeHash({ sort: value })); },

  /* ---------------------------------------------------------------- carrito */
  addToCart(productId, qty) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    const n = clampQty(qty);
    const existing = this.state.cart.find((it) => !it.systemId && it.product.id === productId);
    const before = existing ? existing.qty : 0;
    if (existing) existing.qty = clampQty(existing.qty + n);
    else this.state.cart.push({ product, qty: n });
    const added = (existing ? existing.qty : n) - before;
    if (added > 0) Track.event("add_to_cart", gaItemsParams([{ product, qty: added }]));
    this.render();
    if (added < n) this.toast(`Podés comprar hasta ${MAX_QTY} unidades por producto. Si necesitás más, escribinos.`, { label: "Ver carrito", href: "#cart" });
    else this.toast(`Agregaste ${product.name} al carrito.`, { label: "Ver carrito", href: "#cart" });
  },
  addSystemToCart(items) {
    const systemId = `sys-${Date.now()}`;
    const lines = items.map((it) => ({ product: it.product, qty: clampQty(it.qty) }));
    lines.forEach((it) => this.state.cart.push({ ...it, systemId }));
    Track.event("add_to_cart", gaItemsParams(lines));
    this.state.configurator = defaultConfigurator();
    navigate("cart");
    this.toast("Agregaste el sistema completo al carrito.");
  },
  cartQtyStep(idx, delta) {
    const item = this.state.cart[idx];
    if (!item) return;
    const next = clampQty(Number(item.qty) + delta);
    if (next === item.qty) {
      if (delta > 0) this.toast(`Podés comprar hasta ${MAX_QTY} unidades por producto. Si necesitás más, escribinos.`);
      return;
    }
    if (next > item.qty) Track.event("add_to_cart", gaItemsParams([{ product: item.product, qty: next - item.qty }]));
    else Track.event("remove_from_cart", gaItemsParams([{ product: item.product, qty: item.qty - next }]));
    item.qty = next;
    this.render();
  },
  cartRemove(idx) {
    const [removed] = this.state.cart.splice(idx, 1);
    if (!removed) return;
    Track.event("remove_from_cart", gaItemsParams([removed]));
    this.render({ focusSelector: "#main" });
    this.toast(`Quitaste ${removed.product.name}.`, {
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

    Track.event("begin_checkout", gaItemsParams(s.cart));
    // antes de llamar: si la sesión venció (401), apiRequest lleva a #ingresar y al volver se recupera
    const owner = getSession();
    saveCheckoutDraft(c, owner ? owner.customer.id : null);
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
      navigate(`pedido/${order.code}`);
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
    if (attempt > 0 && (!s.order || s.order.id !== id || s.view !== "order")) return; // ya se fue de la página
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
      if (data.status === "pagado") trackPurchase(data, id);
      if (s.view === "order") this.render();
      // pago pendiente: cada 4 s al principio (el aviso de MP suele llegar enseguida) y después
      // cada 30 s hasta unos 10 minutos (pagos en efectivo o por transferencia)
      if (data.status === "pendiente_pago" && attempt < 25) setTimeout(() => this.loadOrder(id, attempt + 1), attempt < 6 ? 4000 : 30000);
    } catch (err) {
      if (!s.order || s.order.id !== id) return;
      if (byCode && err.status === 401) { s.order = null; return; } // apiRequest ya pidió ingresar; al volver se consulta de nuevo
      if (byCode && err.status === 404) s.order.notMine = true;
      else if (byCode) s.order.error = apiErrorText(err);
      else s.order.error = /no encontrado|Validation|uuid/i.test(err.message) ? "El número de pedido no es válido." : apiErrorText(err);
      if (s.view === "order") this.render();
    }
  },

  requestQuote() {
    const s = this.state;
    s.contactDraft = { ...s.contactDraft, message: quoteMessage(s) };
    s.contactStatus = null;
    navigate("contact");
  },

  /* ---------------------------------------------------------------- configurador */
  cfgRender() { this.render({ focusSelector: "#cfg-step-title" }); },
  /* El paso va en la URL (#configurator/paso-a-paso?paso=N): "Atrás" del navegador vuelve un
     paso y el link se puede compartir. El router valida que se pueda llegar a ese paso. */
  cfgGoStep(step) {
    const c = this.state.configurator;
    const n = Math.max(0, Math.min(step, configuratorSteps(c).length - 1));
    if (n > c.step) Track.event("configurator_step", { step: n + 1, system_type: c.systemTypeId || "" });
    navigate(n > 0 ? `configurator/paso-a-paso?paso=${n + 1}` : "configurator/paso-a-paso");
  },
  cfgSelectSystemType(id) {
    this.state.configurator = defaultConfigurator();
    this.state.configurator.systemTypeId = id;
    this.render();
  },
  cfgAddSystemToCart() {
    const cfg = this.state.configurator;
    const { lines } = cfgTotals(cfg);
    const value = lines.reduce((sum, l) => sum + l.product.priceARS * l.qty, 0);
    Track.event("configurator_complete", { value, currency: "ARS", system_type: cfg.systemTypeId || "" });
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
        costo: ["/calculators/cost", { kwh: c.cost.kwh, pricePerKwh: costTotals(c.cost).perKwh }],
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

  /* calculator_use: una vez por calculadora y visita, cuando muestra un resultado (al tipear). */
  calcUsed: {},
  calcTrackUse(calc) {
    if (this.calcUsed[calc]) return;
    this.calcUsed[calc] = true;
    Track.event("calculator_use", { calc });
  },
  calcConsumptionRecompute() {
    this.calcTrackUse("consumo");
    const t = consumptionTotals(this.state.calc.consumption);
    this.setText("consumption-daily", t.daily);
    this.setText("consumption-monthly", t.monthly);
    this.setText("consumption-yearly", t.yearly);
    this.calcFetchWarnings();
  },
  calcCostRecompute() {
    this.calcTrackUse("costo");
    const t = costTotals(this.state.calc.cost);
    this.setText("cost-total", fmtARS(t.bill));
    this.setText("cost-net", fmtARS(t.net));
    this.setText("cost-other", fmtARS(t.other));
    this.setText("cost-tax", fmtARS(t.tax));
    this.setText("cost-perkwh", `${fmtARS(t.perKwh)}/kWh`);
    this.setText("cost-yearly", fmtARS(t.yearly));
    this.setText("cost-vs", costPct(t.vsNational));
    this.calcFetchWarnings();
  },
  calcSavingsRecompute() {
    this.calcTrackUse("ahorro");
    const t = savingsTotals(this.state.calc.savings);
    this.setText("sav-monthly", t.monthly);
    this.setText("sav-yearly", t.yearly);
    this.setText("sav-pct", t.pct);
    this.calcFetchWarnings();
  },
  calcOrientationRecompute() {
    this.calcTrackUse("orientacion");
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
    const tech = document.getElementById("sizer-tech");
    const parts = sizerOutputParts(this.state.sizer, this.state.currency);
    if (out) out.innerHTML = parts.buy;
    if (tech) tech.innerHTML = parts.tech;
    this.announceSizer();
  },
  /* El resultado se reemplaza entero en cada tecla: en vez de anunciarlo todo, un resumen breve
     ("Sistema sugerido Compatible: 3,30 kWp, 410 kWh/mes generados") cuando se deja de tipear. */
  announceSizer() {
    clearTimeout(this.sizerLiveTimer);
    this.sizerLiveTimer = setTimeout(() => {
      const live = document.getElementById("sr-live");
      const out = document.getElementById("sizer-out");
      const tech = document.getElementById("sizer-tech");
      if (!live || !out || !tech) return;
      const part = (el, sel) => (el.querySelector(sel)?.textContent || "").replace(/\s+/g, " ").trim();
      const text = [part(tech, ".sz-out-head"), part(tech, ".sz-figure").replace(/(\d)kWp/, "$1 kWp"), part(out, ".sz-total")].filter(Boolean).join(": ") || part(out, "p");
      if (text && live.textContent !== text) live.textContent = text;
    }, 900);
  },
  sizerSet(scope, field, value) {
    this.calcTrackUse("dimensionador");
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
      Track.event("generate_lead", { method: "form", context: "contacto" });
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
      // Sin backend ni email configurado, el canal es WhatsApp con el mensaje armado. Después de
      // un await el navegador bloquea window.open (popup): la vista muestra un botón (status.action).
      s.contactStatus = {
        tone: "bad",
        text: "No pudimos conectar con el servidor. Probá de nuevo en un rato o escribinos por WhatsApp con el botón de esta página.",
        action: { href: whatsappLink(body), label: "Abrir WhatsApp con el mensaje" },
      };
    }
    this.render({ focusSelector: ".form-status" });
  },
};

App.submitRevocation = async function () {
  const s = this.state;
  const r = s.revocation;
  if (s.revocationSending) return; // evita el doble envío
  const email = (r.email || "").trim();
  const phone = (r.phone || "").trim();
  const errors = {};
  if (!(r.orderId || "").trim()) errors.orderId = "Indicá el código de pedido (está en el mail o en la página del pedido).";
  if ((r.name || "").trim().length < 2) errors.name = "Escribí tu nombre y apellido.";
  if (!email && !phone) errors.email = "Completá el email o el WhatsApp para poder responderte.";
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Revisá el email: tiene que tener la forma nombre@dominio.com.";
  if (phone && phone.replace(/\D/g, "").length < 8) errors.phone = "Revisá el WhatsApp: escribilo con código de área, por ejemplo 11 2345-6789.";
  r.errors = errors;
  const first = ["orderId", "name", "email", "phone"].find((k) => errors[k]);
  if (first) { r.status = null; this.render({ focusSelector: `#rev-${first}` }); return; }

  const message = `[BOTÓN DE ARREPENTIMIENTO] Pedido: ${r.orderId.trim()}${phone ? `\nWhatsApp: ${phone}` : ""}\n\n${(r.reason || "").trim() || "(sin comentarios)"}`;
  // Sin email la API no puede registrar la solicitud (pide un email para responder): se manda por
  // WhatsApp. Se abre acá, antes de cualquier await, para que el navegador no lo bloquee como popup.
  if (!email) {
    window.open(whatsappLink(`Hola, quiero arrepentirme de mi compra.\nPedido: ${r.orderId.trim()}\nNombre: ${r.name.trim()}${(r.reason || "").trim() ? `\nMotivo: ${r.reason.trim()}` : ""}`), "_blank", "noopener");
    r.status = { tone: "ok", text: "Abrimos WhatsApp con tu solicitud escrita: solo falta que la envíes. Te respondemos por ahí dentro de las 24 h. Si no se abrió, usá el botón “Pedirlo por WhatsApp”." };
    this.render({ focusSelector: ".form-status" });
    return;
  }
  s.revocationSending = true;
  r.status = null;
  this.render();
  try {
    await apiRequest("/contact", { method: "POST", timeoutMs: 70000, body: { name: r.name, email, phone: phone || undefined, message } });
    s.revocationSending = false;
    s.revocation = { errors: {}, done: true };
  } catch (err) {
    s.revocationSending = false;
    // validación (4xx): el mensaje de la API tal cual; sin respuesta o error del servidor: texto propio
    const text = err.status && err.status < 500 && err.status !== 404 ? err.message
      : err.status ? "Tuvimos un problema al recibir tu solicitud. Probá de nuevo en un rato." : apiErrorText(err);
    r.status = { tone: "bad", text: `${text} También podés pedirlo por WhatsApp.` };
  }
  if (s.view === "revocation") this.render({ focusSelector: ".form-status" });
};

/* =========================================================================
   CATÁLOGO, 404 Y DATOS PARA ANALÍTICA
   ========================================================================= */

/* Vistas que necesitan el catálogo (productos y precios). Mientras carga, o si no se pudo
   cargar, muestran un estado propio; el resto del sitio (legales, contacto, calculadoras,
   arrepentimiento, cuenta) funciona igual. Nunca se muestran productos inventados. */
/* Páginas que usan el catálogo: lo piden al entrar (la primera vez, o de nuevo si falló). El resto,
   la home incluida, se muestra sin esperar a la API. */
const CATALOG_VIEWS = ["store", "product-detail", "configurator", "cart"];

function catalogStatusHTML(status) {
  if (status === "error") {
    return `
      <div class="wrap page">
        <div class="empty">
          ${icon("cloud-slash")}
          <h1 class="page-title page-title-sm">No pudimos cargar el catálogo</h1>
          <p>Puede ser un problema de conexión o un corte momentáneo de nuestro lado. Probá de nuevo en unos segundos; si sigue pasando, escribinos por WhatsApp y te pasamos precios y stock.</p>
          <div class="hero-ctas hero-ctas-center">
            <button type="button" class="btn btn-primary" data-action="catalog-retry">Reintentar</button>
            <a class="btn btn-secondary" href="${whatsappLink("Hola, quiero consultar precios y stock.")}" target="_blank" rel="noopener" data-context="catalogo-error">${icon("whatsapp-logo", "", "fill")} Escribinos por WhatsApp</a>
          </div>
        </div>
      </div>`;
  }
  const text = status === "slow" ? "Está tardando más de lo normal. Seguimos intentando…" : "Estamos cargando el catálogo…";
  return `
      <div class="wrap boot" aria-busy="true">
        <p class="boot-msg" role="status"><span class="spinner" aria-hidden="true"></span><span>${text}</span></p>
        <div class="skeleton" style="height:48px;max-width:420px"></div>
        <div class="skeleton" style="height:20px;max-width:560px"></div>
        <div class="skeleton" style="height:320px"></div>
      </div>`;
}

/* Hash desconocido o incompleto (#zzz, #product sin id, un link viejo mal copiado). */
function notFoundHTML() {
  return `
    <div class="wrap page">
      <div class="empty">
        ${icon("compass")}
        <h1 class="page-title page-title-sm">No encontramos esa página</h1>
        <p>Puede que el link esté mal copiado o que la página ya no exista.</p>
        <div class="hero-ctas hero-ctas-center">
          <a href="#" class="btn btn-primary">Ir al inicio</a>
          <a href="#store" class="btn btn-secondary">Ver productos</a>
        </div>
      </div>
    </div>`;
}

/* Título de la pestaña por página: "<página> | AURYX". */
function pageTitle(s) {
  const named = (t) => `${t} | AURYX`;
  switch (s.view) {
    case "home": return "AURYX | Equipos de energía solar";
    case "store": return named(CATEGORY_META[s.storeCategory] ? CATEGORY_META[s.storeCategory].label : "Productos");
    case "product-detail": {
      const p = findProduct(s.selectedProductId);
      return named(p ? `${p.name}${p.brand ? ` · ${p.brand}` : ""}` : "Producto");
    }
    case "configurator": return named(s.cfgTool === "steps" ? "Configurador paso a paso" : "Diseñá tu sistema");
    case "calculators": {
      const c = CALCULATOR_LINKS.find((x) => x.id === s.calcSection);
      return named(c ? `Calculadora de ${c.name.toLowerCase()}` : "Calculadoras");
    }
    case "cart": return named("Carrito");
    case "order": return named("Tu pedido");
    case "revocation": return named("Botón de arrepentimiento");
    case "login": return named("Ingresar");
    case "my-orders": return named("Mis pedidos");
    case "my-account": return named("Mis datos");
    case "info": return named("Información");
    case "contact": return named("Contacto");
    case "terms": return named("Términos y condiciones");
    case "privacy": return named("Política de privacidad");
    case "not-found": return named("Página no encontrada");
    default: return "AURYX | Equipos de energía solar";
  }
}

/* Parámetros de e-commerce de GA4 para una lista de líneas { product, qty }. */
function gaItemsParams(lines) {
  const items = lines.map((l) => ({
    item_id: l.product.id, item_name: l.product.name, item_brand: l.product.brand || "",
    item_category: l.product.category, price: l.product.priceARS, quantity: Number(l.qty) || 1,
  }));
  return { currency: "ARS", value: items.reduce((sum, i) => sum + i.price * i.quantity, 0), items };
}

/* purchase: una sola vez por pedido aprobado (localStorage), aunque recargue la página.
   Si todavía no aceptó las cookies no se marca como enviada (se manda si acepta y vuelve). */
function trackPurchase(order, id) {
  const code = String(order.code || order.publicId || id);
  const key = `auryx-purchase-sent-${code}`;
  if (storageGet(key)) return;
  const items = (order.items || []).map((i) => ({
    item_id: i.productId != null ? `db-${i.productId}` : i.productName, item_name: i.productName,
    price: Number(i.unitPriceArs) || 0, quantity: Number(i.quantity) || 1,
  }));
  const sent = Track.event("purchase", { transaction_id: code, value: Number(order.totalArs) || 0, currency: "ARS", items });
  if (sent) storageSet(key, "1");
}

/* Título, link del botón flotante de WhatsApp (su "Ref:" depende de la página) y eventos de
   página. Corre después de cada render; el page_view sale una vez por página, recién cuando la
   página muestra su contenido real (no mientras espera el catálogo). */
function updateRouteMeta() {
  const s = App.state;
  const waiting = CATALOG_VIEWS.includes(s.view) && s.catalog !== "ready";
  if (!(waiting && onStaticRoute())) document.title = pageTitle(s); // la página estática ya trae el título del producto
  const waFab = document.getElementById("wa-fab");
  if (waFab) waFab.href = whatsappLink("Hola, quiero hacer una consulta.");
  if (waiting || !App.routeTrackKey || App.routeTrackKey === App.lastTrackedKey) return;
  App.lastTrackedKey = App.routeTrackKey;
  Track.pageView();
  if (s.view === "product-detail") {
    const p = findProduct(s.selectedProductId);
    if (p) Track.event("view_item", gaItemsParams([{ product: p, qty: 1 }]));
  } else if (s.view === "store") {
    Track.event("view_item_list", { item_list_id: s.storeCategory, item_list_name: CATEGORY_META[s.storeCategory] ? CATEGORY_META[s.storeCategory].label : "Productos" });
  } else if (s.view === "cart" && s.cart.length) {
    Track.event("view_cart", gaItemsParams(s.cart));
  }
}

/* Carga (o reintenta) el catálogo. Mientras tanto las vistas de catálogo muestran "Estamos
   cargando el catálogo…"; si después de ~70 s no hubo respuesta, "No pudimos cargar el catálogo"
   con "Reintentar". El carrito guardado se restaura recién con el catálogo (precios actuales). */
App.loadCatalog = async function () {
  const s = this.state;
  if (this.catalogLoading) return this.catalogLoading;
  const waitingHere = () => CATALOG_VIEWS.includes(s.view);
  s.catalog = "loading";
  if (waitingHere()) this.render();
  this.catalogLoading = (async () => {
    const products = await loadCatalog({
      onSlow: () => {
        if (s.catalog !== "loading") return;
        s.catalog = "slow";
        if (waitingHere()) this.render();
      },
    });
    if (products) {
      PRODUCTS = products;
      s.catalog = "ready";
      if (!this.cartReady) {
        s.cart = restoreCart();
        this.cartReady = true;
      }
      if (!DEMO_MODE) loadCompatibilityParams(); // la API ya está despierta: responde enseguida
      // la ruta se vuelve a aplicar: la tienda, la ficha y el configurador validan contra el catálogo
      applyRoute({ keepScroll: true });
      // /productos/db-44/ (link viejo) → /productos/<slug>/
      const canonical = routeToPath(currentRoute());
      if (s.view !== "not-found" && canonical !== location.pathname + location.search) history.replaceState(history.state, "", canonical);
    } else {
      s.catalog = "error";
      this.render(waitingHere() ? { focusSelector: '[data-action="catalog-retry"]' } : {});
    }
  })();
  try { await this.catalogLoading; } finally { this.catalogLoading = null; }
};

/* Re-render diferido: si el usuario está en medio de un clic (puntero apretado), se espera a que
   termine. Antes, el "change" de un campo de cantidad re-renderizaba al perder el foco y el botón
   que recibía el clic ("Agregar al carrito", "Siguiente") desaparecía: el primer clic se perdía. */
let pointerIsDown = false;
App.deferRender = function () {
  if (pointerIsDown) this.renderPending = true;
  else this.render();
};
document.addEventListener("pointerdown", () => { pointerIsDown = true; }, true);
["pointerup", "pointercancel"].forEach((type) => document.addEventListener(type, () => {
  pointerIsDown = false;
  // después del clic: si la acción ya re-renderizó, renderPending quedó en false
  if (App.renderPending) setTimeout(() => { if (App.renderPending) App.render(); }, 0);
}, true));

/* Menú de la cuenta (nav): se abre con clic (también en táctiles, donde no hay hover). */
function setAccountMenu(dropdown, open) {
  if (!dropdown) return;
  App.accountMenuOpen = open; // el header se redibuja en cada render: App.render lo vuelve a aplicar
  dropdown.classList.toggle("is-open", open);
  const btn = dropdown.querySelector('[data-action="toggle-account-menu"]');
  if (btn) btn.setAttribute("aria-expanded", String(open));
}
function closeAccountMenus(except) {
  document.querySelectorAll(".dropdown.is-open").forEach((d) => { if (d !== except) setAccountMenu(d, false); });
}

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
  "catalog-retry": () => App.loadCatalog(),
  "toast-dismiss": () => App.dismissToast(),
  "toast-action": () => { const a = App.toastAction; App.dismissToast(); if (a && a.run) a.run(); },
  // link "Ingresar": recuerda la página actual para volver después (el link navega solo)
  "login-start": () => rememberAfterLogin(currentRoute()),
  "logout": (d) => App.logout({ stay: d.stay === "1" }),
  "my-orders-retry": () => { App.loadMyOrders(); App.render(); },
  "toggle-account-menu": (d, el) => {
    const dropdown = el.closest(".dropdown");
    const open = !(dropdown && dropdown.classList.contains("is-open"));
    closeAccountMenus(dropdown);
    setAccountMenu(dropdown, open);
  },

  // cookies (banner de views/cookies.js y "Configurar cookies" del pie)
  "consent-all": () => Track.setConsent("all"),
  "consent-essential": () => Track.setConsent("essential"),
  "cookie-settings": () => {
    Track.resetConsent();
    document.querySelector("#cookie-root button")?.focus();
  },

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
    App.state.productDetailQty = clampQty((Number(App.state.productDetailQty) || 1) + Number(d.delta));
    App.render();
  },

  "cfg-type": (d) => App.cfgSelectSystemType(d.id),
  "cfg-panel": (d) => { App.state.configurator.panelId = d.id; App.render(); },
  "cfg-converter": (d) => { App.state.configurator.converterId = d.id; App.render(); },
  "cfg-battery": (d) => { App.state.configurator.batteryId = d.id; App.render(); },
  "cfg-panel-step": (d) => { const c = App.state.configurator; c.panelQty = clampQty(c.panelQty + Number(d.delta)); App.render(); },
  "cfg-battery-step": (d) => { const c = App.state.configurator; c.batteryQty = clampQty(c.batteryQty + Number(d.delta)); App.render(); },
  "cfg-extra-step": (d) => {
    const c = App.state.configurator;
    c.extras[d.id] = clampQty((c.extras[d.id] || 0) + Number(d.delta), 0);
    App.render();
  },
  "cfg-next": () => {
    const c = App.state.configurator;
    if (!cfgCanAdvance(c)) return;
    App.cfgGoStep(c.step + 1);
  },
  "cfg-back": () => App.cfgGoStep(App.state.configurator.step - 1),
  "cfg-goto": (d) => App.cfgGoStep(Number(d.step)),
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

  // el modo del dimensionador queda en la URL (al recargar se mantiene), sin sumar una entrada al historial
  "sizer-mode": (d) => {
    App.state.sizer.mode = d.mode === "custom" ? "custom" : "quick";
    history.replaceState(null, "", routeToPath(App.state.sizer.mode === "custom" ? "configurator?modo=personalizado" : "configurator"));
    App.renderSizer();
  },
  "sizer-pick": (d) => { App.sizerSet(d.scope, d.field, d.value); App.renderSizer(); },
};

/* Inputs: actualización en vivo sin re-render (no se pierde el cursor). */
/* Checkout y Mis datos: los campos de dirección van en form.address; touched = ya tipeó (la precarga no lo pisa). */
function setFormField(form, el) {
  if (el.dataset.group === "address") form.address[el.dataset.field] = el.value;
  else form[el.dataset.field] = el.value;
  form.touched = true;
}

/* Número no negativo de un campo (los precios o consumos negativos no tienen sentido). */
const nonNegative = (el) => Math.max(0, Number(el.value) || 0);

const INPUT_BINDINGS = {
  "detail-qty": (el) => { App.state.productDetailQty = clampQty(el.value); },
  "cfg-panel-qty": (el) => {
    const cfg = App.state.configurator;
    cfg.panelQty = clampQty(el.value);
    const panel = PRODUCTS.find((p) => p.id === cfg.panelId);
    if (panel) App.setText("panel-total-power", fmtNum(panel.specs.pmax * cfg.panelQty));
  },
  "cfg-battery-qty": (el) => {
    const cfg = App.state.configurator;
    cfg.batteryQty = clampQty(el.value);
    const battery = PRODUCTS.find((p) => p.id === cfg.batteryId);
    if (battery) App.setText("battery-total-kwh", fmtNum((battery.specs.capacityWh * cfg.batteryQty) / 1000, 2));
  },
  "consumption": (el) => {
    const it = App.state.calc.consumption[Number(el.dataset.i)];
    if (!it) return;
    const f = el.dataset.field;
    // las horas de uso por día no pueden pasar de 24
    it[f] = f === "name" ? el.value : f === "hours" ? Math.min(24, nonNegative(el)) : nonNegative(el);
    App.calcConsumptionRecompute();
  },
  "cost": (el) => { App.state.calc.cost[el.dataset.field] = nonNegative(el); App.calcCostRecompute(); },
  "savings": (el) => { App.state.calc.savings[el.dataset.field] = nonNegative(el); App.calcSavingsRecompute(); },
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
    App.calcTrackUse("dimensionador");
    App.state.sizer[el.dataset.scope][el.dataset.field] = el.value;
    App.renderSizerOutput();
  },
};

/* Change: cuando el valor queda confirmado (selects, o al salir de un número). */
const CHANGE_BINDINGS = {
  // provincia o distribuidora: al cambiar de provincia se toma su primera distribuidora y se redibuja la calculadora
  "cost-sel": (el) => {
    const c = App.state.calc.cost;
    c[el.dataset.field] = el.value;
    if (el.dataset.field === "province") c.dist = costProvince(el.value).dists[0];
    App.render();
    App.calcCostRecompute();
  },
  "store-sort": (el) => App.setStoreSort(el.value),
  "cfg-wiring": (el) => { App.state.configurator.wiring = el.value; App.render(); },
  "cfg-voltage": (el) => { App.state.configurator.systemVoltage = Number(el.value); App.render(); },
  "cfg-tmin": (el) => {
    const t = Math.round(Number(el.value));
    App.state.configurator.tMinC = Number.isFinite(t) && el.value !== "" ? Math.max(-40, Math.min(30, t)) : null;
    App.deferRender();
  },
  // cantidades: el render (que recalcula compatibilidad y totales) espera a que termine el clic
  "cfg-panel-qty": () => App.deferRender(),
  "cfg-battery-qty": () => App.deferRender(),
  "detail-qty": () => App.deferRender(),
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
  // menú de la cuenta abierto: un clic afuera lo cierra
  closeAccountMenus(e.target.closest(".dropdown.is-open"));

  // clic a WhatsApp (cualquier link a wa.me): generate_lead con el lugar desde donde se hizo
  const wa = e.target.closest('a[href^="https://wa.me"]');
  if (wa) {
    const context = wa.dataset.context || (wa.id === "wa-fab" ? "boton-flotante" : App.state.view);
    const params = { method: "whatsapp", context };
    if (App.state.view === "cart" && App.state.cart.length) Object.assign(params, { currency: "ARS", value: gaItemsParams(App.state.cart).value });
    Track.event("generate_lead", params);
  }

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

// El aviso (toast) no se cierra mientras el puntero o el foco están encima
const toastRoot = document.getElementById("toast-root");
if (toastRoot) {
  toastRoot.addEventListener("mouseenter", () => App.pauseToast());
  toastRoot.addEventListener("focusin", () => App.pauseToast());
  toastRoot.addEventListener("mouseleave", () => App.resumeToast());
  toastRoot.addEventListener("focusout", () => setTimeout(() => App.resumeToast(), 0));
}

// La foto de la cuenta que no carga se quita y queda la inicial ("error" no burbujea: captura)
document.addEventListener("error", (e) => {
  if (!(e.target && e.target.matches && e.target.matches("img[data-avatar-img]"))) return;
  BROKEN_AVATARS.add(e.target.getAttribute("src"));
  e.target.remove();
}, true);

// Ingreso o salida en otra pestaña: se actualiza el header. Si se cerró la sesión y la página
// actual es de la cuenta (Mis pedidos, Mis datos, un pedido con código), se pide ingresar.
window.addEventListener("storage", (e) => {
  if (e.key !== SESSION_KEY) return;
  const s = App.state;
  const session = getSession();
  if (!session) {
    const accountPage = s.view === "my-orders" || s.view === "my-account" || (s.view === "order" && s.order && isOrderCode(s.order.id));
    App.forgetAccountData();
    App.accountOwnerId = null;
    if (accountPage) {
      rememberAfterLogin(currentRoute());
      navigate("ingresar");
      return;
    }
  } else {
    // ingresó otra cuenta en otra pestaña: nada de lo tipeado por la anterior queda a la vista
    if (App.accountOwnerId !== session.customer.id) {
      App.forgetAccountData({ keepDraftFor: session.customer.id });
      App.accountOwnerId = session.customer.id;
      if (s.view === "my-orders") App.loadMyOrders();
      if (s.view === "my-account") { fillFromCustomer(s.account, session.customer); App.refreshMe("account"); }
    }
    if (s.view === "cart") App.prepareCheckout(false);
  }
  App.render();
});

// Sesión vencida (401): se descartan los pedidos en memoria; el checkout queda para la misma persona
window.addEventListener("auryx:session-expired", () => {
  const s = App.state;
  s.myOrders = null;
  if (s.order && isOrderCode(s.order.id)) s.order = null;
  s.account = defaultAccountForm();
  App.meFetchedToken = null;
});

// Volver desde Mercado Pago con "Atrás" restaura la página de la caché (bfcache): el botón
// de pago no tiene que quedar en "Preparando el pago…"
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  const c = App.state.checkout;
  if (!c.sending && !c.slow) return;
  Object.assign(c, { sending: false, slow: false });
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
  if (e.key !== "Escape") return;
  const openMenu = document.querySelector(".dropdown.is-open");
  if (openMenu) {
    setAccountMenu(openMenu, false);
    openMenu.querySelector('[data-action="toggle-account-menu"]')?.focus();
    return;
  }
  if (App.state.mobileNavOpen) {
    App.toggleMobileNav(false);
    document.querySelector('[data-fid="menu"]')?.focus();
  }
});

// El botón de Google se dibuja con un ancho fijo: al rotar o cambiar el tamaño de la ventana se redibuja
let gsiResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(gsiResizeTimer);
  gsiResizeTimer = setTimeout(() => {
    const el = document.getElementById("gsi-button");
    if (!el || !App.gsiInitialized) return;
    const width = Math.floor(el.clientWidth);
    if (width && width !== App.gsiWidth) { App.gsiWidth = width; App.mountGoogleButton(); }
  }, 250);
});

// Foco del botón de Google: el botón real va invisible encima del nuestro y, con el foco dentro de su
// iframe, el navegador no marca :focus-within. Lo único que se ve desde acá es que la página pierde el
// foco con el iframe como elemento activo. Con el mouse encima no se marca (como :focus-visible).
window.addEventListener("blur", () => {
  const active = document.activeElement;
  const wrap = active && active.tagName === "IFRAME" ? active.closest(".google-signin") : null;
  if (wrap && !wrap.matches(":hover")) wrap.classList.add("is-focused");
});
const clearGoogleFocus = () => document.querySelectorAll(".google-signin.is-focused").forEach((el) => el.classList.remove("is-focused"));
window.addEventListener("focus", clearGoogleFocus);
document.addEventListener("focusin", clearGoogleFocus);

/* =========================================================================
   ROUTER
   Traduce el hash (#store/panel?marca=X, #product/db-1, #calculators/ahorro,
   #configurator?tipo=hybrid…) en estado + render.
   ========================================================================= */
/* Páginas estáticas para buscadores (/productos/<slug>/, /categorias/<slug>/; las genera
   scripts/build-seo-pages.mjs): traen el contenido ya dibujado, que se deja a la vista
   mientras carga el catálogo y no se navegó a otra página. */
const INITIAL_PATH = location.pathname;
const PRERENDER_HTML = document.querySelector("[data-prerender]")?.outerHTML || "";
const onStaticRoute = () => !!PRERENDER_HTML && location.pathname === INITIAL_PATH;

function applyRoute({ keepScroll = false } = {}) {
  const raw = currentRoute();
  const [path, query] = raw.split("?");
  const [view, rawParam] = path.split("/");
  let param = "";
  try { param = rawParam ? decodeURIComponent(rawParam) : ""; } catch (e) { param = null; } // %E0 mal formado
  const params = new URLSearchParams(query || "");
  const s = App.state;
  let focusSelector = null;

  if (param === null) {
    s.view = "not-found";
  } else if (!path || view === "home") {
    s.view = "home";
  } else if (view === "store") {
    s.view = "store";
    s.storeCategory = param || "all";
    if (param && !CATEGORY_META[param]) { // categoría inexistente: la tienda completa
      s.storeCategory = "all";
      history.replaceState(history.state, "", routeToPath(`store${query ? `?${query}` : ""}`));
    }
    s.storeFilters = {
      brand: params.get("marca") || null,
      tech: params.get("tecnologia") || null,
      systemType: params.get("sistema") || null,
    };
    s.storeSort = params.get("orden") || "none";
  } else if (view === "product") {
    if (!param) s.view = "not-found";
    else {
      s.view = "product-detail";
      if (s.selectedProductId !== param) s.productDetailQty = 1;
      s.selectedProductId = param;
    }
  } else if (view === "configurator") {
    s.view = "configurator";
    s.cfgTool = param === "paso-a-paso" ? "steps" : "sizer";
    if (s.cfgTool === "sizer") s.sizer.mode = params.get("modo") === "personalizado" ? "custom" : "quick";
    const tipo = params.get("tipo");
    if (tipo && SYSTEM_TYPES.some((t) => t.id === tipo)) {
      s.cfgTool = "steps";
      s.configurator = defaultConfigurator();
      s.configurator.systemTypeId = tipo;
      s.configurator.step = 1;
      history.replaceState(null, "", routeToPath("configurator/paso-a-paso?paso=2")); // el preseleccionado no queda pegado a la URL
    } else if (s.cfgTool === "steps" && s.catalog === "ready") {
      // ?paso=N (1 = tipo de sistema): solo se avanza hasta donde lo permiten las elecciones hechas
      const c = s.configurator;
      const before = c.step;
      const target = Math.max(0, Math.min((Number(params.get("paso")) || 1) - 1, configuratorSteps(c).length - 1));
      if (target < c.step) c.step = target;
      else while (c.step < target && cfgCanAdvance(c)) c.step++;
      if (c.step !== target) history.replaceState(null, "", routeToPath(c.step ? `configurator/paso-a-paso?paso=${c.step + 1}` : "configurator/paso-a-paso"));
      if (c.step !== before) focusSelector = "#cfg-step-title";
    }
  } else if (view === "calculators") {
    s.view = "calculators";
    s.calcSection = param || null;
  } else if (view === "pedido") {
    if (!param) s.view = "not-found";
    else if (isOrderCode(param) && !getSession()) {
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
  } else if (App.lastRouteKey !== null && document.getElementById(raw)) {
    return; // ancla dentro de la página (p. ej. "Saltar al contenido" → #main): no es una ruta
  } else {
    s.view = "not-found"; // hash desconocido: página 404 con header y pie
  }

  s.mobileNavOpen = false;
  App.accountMenuOpen = false;

  // Solo se vuelve arriba (y se mueve el foco) al cambiar de página; cambiar
  // un filtro o el orden de la tienda mantiene la posición.
  const routeKey = view === "calculators" ? "calculators" : `${s.view}/${param}`;
  const pageChanged = routeKey !== App.lastRouteKey && !keepScroll;
  const isFirst = App.lastRouteKey === null;
  App.lastRouteKey = routeKey;
  App.routeTrackKey = `${s.view}/${param}`;

  if (CATALOG_VIEWS.includes(s.view) && (s.catalog === "idle" || s.catalog === "error")) App.loadCatalog();
  App.render(pageChanged && !isFirst ? { focusSelector: "#main" } : focusSelector ? { focusSelector } : {});
  if (pageChanged) {
    if (s.view !== "home") App.homeRevealed = false;
    // con "Atrás"/"Adelante" se vuelve a la posición en la que estaba esa página (ver setupScrollMemory)
    const saved = history.state && Number.isFinite(history.state.scrollY) ? history.state.scrollY : 0;
    window.scrollTo({ top: saved, behavior: "auto" });
  }
}

/* Página que necesita sesión: se recuerda el destino y se muestra #ingresar en su lugar. */
function routeToLogin(raw) {
  const s = App.state;
  rememberAfterLogin(raw);
  history.replaceState(null, "", routeToPath("ingresar"));
  if (s.view !== "login" && !s.login.busy) s.login = defaultLogin();
  s.view = "login";
}

/* Único punto de entrada para navegar desde código: suma una entrada al historial con la
   dirección limpia (ver lib/routes.js), así "Atrás" del navegador y los links quedan consistentes. */
function navigate(route) {
  const url = routeToPath(route);
  if (url === location.pathname + location.search) { applyRoute(); return; }
  clearTimeout(scrollMemoryTimer); // la posición pendiente es de la página que se deja
  history.pushState(null, "", url);
  applyRoute();
}

window.addEventListener("popstate", () => applyRoute());

/* Links viejos con "#" (#store/panel, #pedido/AX-123 de Mercado Pago, favoritos guardados):
   se pasan a la dirección limpia sin recargar. */
function redirectLegacyHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h || !isRoute(h)) return false;
  history.replaceState(null, "", routeToPath(h));
  return true;
}
window.addEventListener("hashchange", () => { if (redirectLegacyHash()) applyRoute(); });

/* Los links de las vistas se escriben como href="#store/panel": después de cada render se
   reescriben a la dirección limpia (sirve para abrir en otra pestaña, copiar el link y para Google). */
function linkifyRoutes() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    const route = a.getAttribute("href").slice(1);
    if (isRoute(route)) a.setAttribute("href", routeToPath(route));
  });
}

/* Clic en un link interno: se navega sin recargar la página. Se registra al iniciar, después
   de la delegación de acciones (que puede cancelar el clic). */
function setupLinkNavigation() {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (href.startsWith("#")) {
      if (isRoute(href.slice(1))) { e.preventDefault(); navigate(href.slice(1)); }
      return; // ancla dentro de la página ("Saltar al contenido")
    }
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
    e.preventDefault();
    navigate(pathToRoute(url.pathname, url.search));
  });
}

/* Memoria del scroll: la posición de cada página se guarda en su entrada del historial
   (history.state.scrollY), así al volver con "Atrás" de una ficha a la tienda se vuelve
   al mismo producto. Una página nueva (link) no tiene posición guardada: empieza arriba. */
let scrollMemoryTimer = null;
function setupScrollMemory() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  // al cambiar de página se descarta lo pendiente: si no, la posición de la página anterior
  // se guardaría en la entrada nueva
  window.addEventListener("popstate", () => clearTimeout(scrollMemoryTimer), true);
  window.addEventListener("scroll", () => {
    clearTimeout(scrollMemoryTimer);
    scrollMemoryTimer = setTimeout(() => {
      try { history.replaceState({ ...(history.state || {}), scrollY: Math.round(window.scrollY) }, ""); } catch (e) { /* se ignora */ }
    }, 150);
  }, { passive: true });
}

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
   Las páginas que no dependen del catálogo se muestran enseguida; las de
   catálogo esperan a la API (con reintentos, ver App.loadCatalog).
   ========================================================================= */
document.addEventListener("DOMContentLoaded", () => {
  setupBackToTop();
  setupScrollMemory();
  try {
    const bootSession = getSession();
    App.accountOwnerId = bootSession ? bootSession.customer.id : null;
    App.renderCookieBanner();
    redirectLegacyHash();
    setupLinkNavigation();
    applyRoute(); // si la página usa el catálogo, lo pide (ver CATALOG_VIEWS)
    // en el resto, ya mostrada la página, un pedido chico despierta la API (Render free se duerme a los
    // 15 min; además la mantiene despierta un monitor de UptimeRobot) para que la tienda no espere el
    // arranque en frío. /health no toca la base.
    if (App.state.catalog === "idle" && !DEMO_MODE) setTimeout(() => { if (App.state.catalog === "idle") apiRequest("/health", { timeoutMs: 45000 }).catch(() => {}); }, 1500);
  } catch (err) {
    document.getElementById("app-root").innerHTML = `
      <div class="wrap page">
        <div class="empty">
          ${icon("warning-circle")}
          <h1 class="page-title page-title-sm">No pudimos cargar la página</h1>
          <p>Recargá para intentar de nuevo. Si sigue pasando, escribinos por WhatsApp y te ayudamos.</p>
          <div class="hero-ctas hero-ctas-center">
            <button type="button" class="btn btn-primary" data-action="reload">Recargar</button>
            <a class="btn btn-secondary" href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>
      </div>`;
    throw err; // queda en la consola para diagnosticar
  }
});
