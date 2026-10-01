/* =========================================================================
   AURYX — App: estado global + orquestación de renderizado.
   Sin framework: cada acción del usuario llama a un método de `App`, que
   actualiza el estado y decide si conviene un re-render completo (clics,
   cambios de paso) o una actualización puntual del DOM (inputs de texto,
   para no perder el foco mientras se tipea).
   ========================================================================= */

function defaultConfigurator() {
  return {
    step: 0, systemTypeId: null, panelId: null, panelQty: 2, wiring: "series",
    systemVoltage: 24, converterId: null, batteryId: null, batteryQty: 1, extras: {},
  };
}

const App = {
  state: {
    view: "home",
    currency: "ARS",
    cart: [],
    mobileNavOpen: false,
    storeCategory: "all",
    storeSort: "none",
    storeFilters: {},
    selectedProductId: null,
    productDetailQty: 1,
    configurator: defaultConfigurator(),
    calc: {
      consumption: [{ name: "Heladera", power: 150, qty: 1, hours: 8 }],
      cost: { kwh: 300, pricePerKwh: 140 },
      savings: { currentKwh: 350, solarKwh: 220, energyPrice: 140 },
      orientation: { lat: -34.6, hemisphere: "sur", previewAngle: 35 },
    },
  },

  get cartCount() { return this.state.cart.reduce((s, it) => s + Number(it.qty), 0); },

  /* ---------------- navegación / render principal ---------------- */
  setView(view) {
    navigateHash(view === "home" ? "" : view);
  },
  toggleMobileNav(force) {
    this.state.mobileNavOpen = force !== undefined ? force : !this.state.mobileNavOpen;
    this.render();
  },
  toggleCurrency() {
    this.state.currency = this.state.currency === "ARS" ? "USD" : "ARS";
    this.render();
  },

  render() {
    const s = this.state;
    document.getElementById("nav-root").innerHTML = renderNav({ view: s.view, currency: s.currency, cartCount: this.cartCount, cart: s.cart, mobileNavOpen: s.mobileNavOpen });
    let body = "";
    switch (s.view) {
      case "home": body = renderHome(); break;
      case "store": body = renderStore(s); break;
      case "product-detail": body = renderProductDetail(s); break;
      case "configurator": body = renderConfigurator(s); break;
      case "calculators": body = renderCalculators(s); break;
      case "cart": body = renderCart(s); break;
      case "info": body = renderInfo(); break;
      case "contact": body = renderContact(); break;
      default: body = renderHome();
    }
    document.getElementById("app-root").innerHTML = body;
    document.getElementById("footer-root").innerHTML = renderFooter();
    if (window.lucide) lucide.createIcons();
  },

  /* ---------------- tienda / producto ---------------- */
  setStoreCategory(cat) { navigateHash(cat === "all" ? "store" : `store/${cat}`); },
  openProduct(id) { navigateHash(`product/${id}`); },

  setStoreSort(value) {
    this.state.storeSort = value;
    this.render();
  },
  setStoreFilter(key, value) {
    const current = this.state.storeFilters || {};
    // click de nuevo sobre el mismo valor = lo saca (toggle)
    current[key] = current[key] === value ? null : value;
    this.state.storeFilters = current;
    this.render();
  },
  clearStoreFilters() {
    this.state.storeFilters = {};
    this.render();
  },
  detailQtyStep(delta) {
    this.state.productDetailQty = Math.max(1, (Number(this.state.productDetailQty) || 1) + delta);
    this.render();
  },
  detailQtySet(val) { this.state.productDetailQty = Math.max(1, Number(val) || 1); },

  /* ---------------- carrito ---------------- */
  addToCart(productId, qty) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    this.state.cart.push({ product, qty: Math.max(1, Number(qty) || 1) });
    this.render();
  },
  addSystemToCart(items) {
    const systemId = `sys-${Date.now()}`;
    items.forEach((it) => this.state.cart.push({ product: it.product, qty: it.qty, systemId }));
    this.state.configurator = defaultConfigurator();
    this.setView("cart");
  },
  cartQtyStep(idx, delta) {
    const item = this.state.cart[idx];
    if (!item) return;
    item.qty = Math.max(1, Number(item.qty) + delta);
    this.render();
  },
  cartRemove(idx) { this.state.cart.splice(idx, 1); this.render(); },

  /* ---------------- configurador ---------------- */
  cfgSet(field, value) { this.state.configurator[field] = value; this.render(); },
  cfgSelectSystemType(id) {
    this.state.configurator = defaultConfigurator();
    this.state.configurator.systemTypeId = id;
    this.render();
  },
  cfgSelectPanel(id) { this.state.configurator.panelId = id; this.render(); },
  cfgSelectConverter(id) { this.state.configurator.converterId = id; this.render(); },
  cfgSelectBattery(id) { this.state.configurator.batteryId = id; this.render(); },
  cfgPanelQtyStep(delta) {
    const cfg = this.state.configurator;
    cfg.panelQty = Math.max(1, cfg.panelQty + delta);
    this.render();
  },
  cfgPanelQtyLive(val) {
    const cfg = this.state.configurator;
    cfg.panelQty = Math.max(1, Number(val) || 1);
    const panel = PRODUCTS.find((p) => p.id === cfg.panelId);
    const totalPowerEl = document.getElementById("panel-total-power");
    if (totalPowerEl && panel) totalPowerEl.textContent = panel.specs.pmax * cfg.panelQty;
  },
  cfgBatteryQtyStep(delta) {
    const cfg = this.state.configurator;
    cfg.batteryQty = Math.max(1, cfg.batteryQty + delta);
    this.render();
  },
  cfgBatteryQtyLive(val) {
    const cfg = this.state.configurator;
    cfg.batteryQty = Math.max(1, Number(val) || 1);
    const battery = PRODUCTS.find((p) => p.id === cfg.batteryId);
    const el = document.getElementById("battery-total-kwh");
    if (el && battery) el.textContent = ((battery.specs.capacityWh * cfg.batteryQty) / 1000).toFixed(2);
  },
  cfgExtraStep(productId, delta) {
    const cfg = this.state.configurator;
    const current = cfg.extras[productId] || 0;
    cfg.extras[productId] = Math.max(0, current + delta);
    this.render();
  },
  cfgNext() {
    const cfg = this.state.configurator;
    const steps = configuratorSteps(cfg);
    cfg.step = Math.min(cfg.step + 1, steps.length - 1);
    this.render();
  },
  cfgBack() {
    const cfg = this.state.configurator;
    cfg.step = Math.max(cfg.step - 1, 0);
    this.render();
  },
  cfgAddSystemToCart() {
    const cfg = this.state.configurator;
    const { panel, converter, battery, extraLines } = cfgTotals(cfg);
    const items = [];
    if (panel) items.push({ product: panel, qty: cfg.panelQty });
    if (converter) items.push({ product: converter, qty: 1 });
    if (battery) items.push({ product: battery, qty: cfg.batteryQty });
    extraLines.forEach((l) => items.push({ product: l.product, qty: l.qty }));
    this.addSystemToCart(items);
  },

  /* ---------------- calculadoras ---------------- */
  calcConsumptionRecompute() {
    const items = this.state.calc.consumption;
    const dailyWh = items.reduce((s, it) => s + it.power * it.qty * it.hours, 0);
    const daily = document.getElementById("consumption-daily");
    const monthly = document.getElementById("consumption-monthly");
    const yearly = document.getElementById("consumption-yearly");
    if (daily) daily.textContent = `${(dailyWh / 1000).toFixed(2)} kWh`;
    if (monthly) monthly.textContent = `${((dailyWh * 30) / 1000).toFixed(1)} kWh`;
    if (yearly) yearly.textContent = `${((dailyWh * 365) / 1000).toFixed(0)} kWh`;
  },
  calcConsumptionEdit(i, field, value) {
    const it = this.state.calc.consumption[i];
    if (!it) return;
    it[field] = field === "name" ? value : (Number(value) || 0);
    this.calcConsumptionRecompute();
  },
  calcConsumptionAdd() {
    this.state.calc.consumption.push({ name: "", power: 0, qty: 1, hours: 1 });
    this.render();
  },
  calcConsumptionRemove(i) {
    this.state.calc.consumption.splice(i, 1);
    this.render();
  },

  calcCostEdit(field, value) {
    this.state.calc.cost[field] = Number(value) || 0;
    const { kwh, pricePerKwh } = this.state.calc.cost;
    const el = document.getElementById("cost-total");
    if (el) el.textContent = `$ ${(kwh * pricePerKwh).toLocaleString("es-AR")}`;
  },

  calcSavingsEdit(field, value) {
    this.state.calc.savings[field] = Number(value) || 0;
    const { currentKwh, solarKwh, energyPrice } = this.state.calc.savings;
    const saved = Math.max(0, solarKwh) * energyPrice;
    const pct = currentKwh > 0 ? Math.min(100, (solarKwh / currentKwh) * 100) : 0;
    const m = document.getElementById("sav-monthly");
    const y = document.getElementById("sav-yearly");
    const p = document.getElementById("sav-pct");
    if (m) m.textContent = `$ ${saved.toLocaleString("es-AR")}`;
    if (y) y.textContent = `$ ${(saved * 12).toLocaleString("es-AR")}`;
    if (p) p.textContent = `${pct.toFixed(0)} %`;
  },

  calcOrientationEdit(field, value) {
    this.state.calc.orientation[field] = field === "lat" ? (Number(value) || 0) : value;
    const { lat, hemisphere } = this.state.calc.orientation;
    const recommendedAngle = Math.round(Math.abs(lat));
    const azimuth = hemisphere === "sur" ? "Norte (0°)" : "Sur (180°)";
    const a = document.getElementById("orient-azimuth");
    const g = document.getElementById("orient-angle");
    if (a) a.textContent = azimuth;
    if (g) g.textContent = `≈ ${recommendedAngle}°`;
    // el botón "usar recomendado" muestra el valor actualizado sin re-render completo
    const useBtn = document.querySelector('[onclick="App.calcOrientationUseRecommended()"]');
    if (useBtn) useBtn.textContent = `Usar ángulo recomendado (${recommendedAngle}°)`;
  },

  calcOrientationAngleEdit(value) {
    let n = Math.round(Number(value));
    if (Number.isNaN(n)) n = 0;
    n = Math.max(0, Math.min(90, n));
    this.state.calc.orientation.previewAngle = n;

    // sincronizar número <-> slider entre sí
    const numInput = document.getElementById("orient-angle-number");
    const slider = document.getElementById("orient-angle-slider");
    if (numInput && Number(numInput.value) !== n) numInput.value = n;
    if (slider && Number(slider.value) !== n) slider.value = n;

    // vista isométrica: se ajusta con signo negativo para que se incline hacia arriba
    const isoPanel = document.getElementById("panel-3d-iso");
    if (isoPanel) isoPanel.style.transform = `rotateX(${-n}deg)`;

    // vista lateral: recalculamos la geometría real (misma función que usa el render inicial)
    const g = lateralPanelGeometry(n);
    const panelLine = document.getElementById("lateral-panel");
    if (panelLine) { panelLine.setAttribute("x2", g.far.x); panelLine.setAttribute("y2", g.far.y); }
    const strut = document.getElementById("lateral-strut");
    if (strut) { strut.setAttribute("x2", g.strutAttach.x); strut.setAttribute("y2", g.strutAttach.y); }
    const ticksGroup = document.getElementById("lateral-ticks");
    if (ticksGroup) ticksGroup.innerHTML = lateralTicksHTML(g.ticks);
    const arc = document.getElementById("lateral-arc");
    if (arc) arc.setAttribute("d", `M ${g.arcStart.x} ${g.arcStart.y} A 34 34 0 0 1 ${g.arcEnd.x} ${g.arcEnd.y}`);
    const label = document.getElementById("lateral-label");
    if (label) { label.setAttribute("x", g.label.x); label.setAttribute("y", g.label.y); label.textContent = `${n}°`; }
  },

  calcOrientationUseRecommended() {
    const { lat } = this.state.calc.orientation;
    this.state.calc.orientation.previewAngle = Math.round(Math.abs(lat));
    this.render();
  },
};

/* =========================================================================
   INICIALIZACIÓN
   Intenta cargar productos reales desde la API. Si el backend no responde
   (apagado, CORS, red), sigue mostrando los datos de demo de data.js para
   que la página nunca quede en blanco.
   ========================================================================= */
/* =========================================================================
   ROUTER: traduce cambios de hash (#store, #store/panel, #product/db-1, etc.)
   en cambios de estado + render. Sin esto, los links del nav (que usan
   href="#...") cambiaban la URL pero la pantalla se quedaba estática, porque
   nada escuchaba el evento "hashchange".
   ========================================================================= */
function applyRouteFromHash() {
  const raw = location.hash.replace(/^#/, "");
  const [view, param] = raw.split("/");

  if (!raw || view === "home") {
    App.state.view = "home";
  } else if (view === "store") {
    App.state.view = "store";
    const newCat = param || "all";
    if (newCat !== App.state.storeCategory) App.state.storeFilters = {}; // los filtros dependen de la categoría
    App.state.storeCategory = newCat;
  } else if (view === "product") {
    if (!param) return;
    App.state.view = "product-detail";
    App.state.selectedProductId = param;
    App.state.productDetailQty = 1;
  } else if (["configurator", "calculators", "cart", "info", "contact"].includes(view)) {
    App.state.view = view;
  } else {
    return; // hash desconocido: no tocamos el estado actual
  }

  App.state.mobileNavOpen = false;
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  App.render();
}

/* Único punto de entrada para navegar: siempre pasa por el hash de la URL,
   así el botón "Atrás" del navegador y los links con href quedan consistentes
   con los botones que llaman a App.setView()/etc. directamente. */
function navigateHash(newHash) {
  const current = location.hash.replace(/^#/, "");
  if (current === newHash) {
    applyRouteFromHash(); // mismo hash: forzamos igual el render (ej. re-click en la misma categoría)
  } else {
    location.hash = newHash;
  }
}

window.addEventListener("hashchange", applyRouteFromHash);

/* =========================================================================
   MEJORAS: nav que se oculta al bajar y reaparece al subir o acercar el
   mouse al borde superior; botón flotante de "volver arriba".
   ========================================================================= */
(function setupScrollBehaviors() {
  let lastScrollY = window.scrollY;
  const HIDE_THRESHOLD = 120; // píxeles desde arriba antes de empezar a ocultar
  const MOUSE_REVEAL_ZONE = 40; // píxeles desde el borde superior que revelan el nav

  function updateOnScroll() {
    const navRoot = document.getElementById("nav-root");
    const backToTop = document.getElementById("back-to-top");
    const currentY = window.scrollY;

    if (navRoot) {
      if (currentY > lastScrollY && currentY > HIDE_THRESHOLD) {
        navRoot.classList.add("sf-nav-hidden"); // bajando: se esconde
      } else if (currentY < lastScrollY) {
        navRoot.classList.remove("sf-nav-hidden"); // subiendo: reaparece
      }
    }

    if (backToTop) {
      backToTop.classList.toggle("visible", currentY > 400);
    }

    lastScrollY = currentY;
  }

  window.addEventListener("scroll", updateOnScroll, { passive: true });

  window.addEventListener("mousemove", (e) => {
    if (e.clientY <= MOUSE_REVEAL_ZONE) {
      const navRoot = document.getElementById("nav-root");
      if (navRoot) navRoot.classList.remove("sf-nav-hidden");
    }
  });
})();

/* =========================================================================
   INICIALIZACIÓN
   Intenta cargar productos reales desde la API. Si el backend no responde
   (apagado, CORS, red), sigue mostrando los datos de demo de data.js para
   que la página nunca quede en blanco.
   ========================================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("app-root").innerHTML = `
    <div class="max-w-6xl mx-auto px-5 py-20 text-center" style="color:var(--text-dim)">
      Cargando productos...
    </div>`;

  try {
    const apiProducts = await loadProductsFromAPI();
    if (apiProducts && apiProducts.length > 0) {
      PRODUCTS = apiProducts;
    } else {
      console.warn("Usando catálogo de demo: no se pudo conectar con la API en", API_BASE_URL);
    }

    if (location.hash) {
      applyRouteFromHash();
    } else {
      App.render();
    }
  } catch (err) {
    console.error("Error inicializando la app:", err);
    document.getElementById("app-root").innerHTML = `
      <div class="max-w-2xl mx-auto px-5 py-20 text-center" style="color:var(--bad)">
        Ocurrió un error al iniciar la página. Revisá la consola (F12) para más detalle.
      </div>`;
  }
});
