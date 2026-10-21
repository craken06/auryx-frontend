/* AURYX: analítica con consentimiento (GA4 + Microsoft Clarity) y origen de la visita (UTM).
   Depende de: config.js (GA4_ID, CLARITY_ID). Se carga justo después de config.js.

   Reglas:
   - Sin GA4_ID ni CLARITY_ID no se hace nada: ni scripts de terceros, ni llamadas de red, ni banner.
   - Con IDs, los scripts de Google y de Microsoft se cargan SOLO si el visitante tocó "Aceptar"
     en el banner de cookies (localStorage "auryx-consent" = "all"). "Solo necesarias" = "essential".
   - Consent Mode v2 de Google: todo denegado por defecto; al aceptar se habilita solo la medición
     (analytics_storage). Los permisos de anuncios (ad_*) quedan denegados: el banner no los pide.
   - El router manda un page_view por cada página con una URL "virtual" sin "#"
     (#product/db-12 → /product/db-12), así GA4 muestra cada pantalla por separado.
     En GA4 hay que desactivar "Cambios de página basados en el historial" (Medición mejorada).
   - El origen de la visita (utm_source/medium/campaign, o el sitio que la mandó) se guarda en el
     navegador para el código "Ref:" de los mensajes de WhatsApp. No sale del navegador salvo en ese
     mensaje, que el visitante ve y decide mandar. */

const Analytics = (function () {
  const CONSENT_KEY = "auryx-consent";
  const FIRST_TOUCH_KEY = "auryx-origin-first"; // localStorage: la primera visita con origen conocido
  const SESSION_KEY = "auryx-origin";           // sessionStorage: el origen de esta visita

  const gaId = typeof GA4_ID === "string" && /^G-[A-Z0-9]+$/i.test(GA4_ID.trim()) ? GA4_ID.trim() : "";
  const clarityId = typeof CLARITY_ID === "string" && /^[a-z0-9]+$/i.test(CLARITY_ID.trim()) ? CLARITY_ID.trim() : "";
  let gaLoaded = false;
  let clarityLoaded = false;

  function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function write(store, key, value) { try { window[store].setItem(key, value); } catch (e) { /* modo privado: se ignora */ } }
  function remove(store, key) { try { window[store].removeItem(key); } catch (e) { /* se ignora */ } }

  function enabled() { return Boolean(gaId || clarityId); }
  function consent() {
    const c = read("localStorage", CONSENT_KEY);
    return c === "all" || c === "essential" ? c : null;
  }
  const active = () => enabled() && consent() === "all";

  /* ---------------------------------------------------------------- Google Analytics 4 */
  // gtag() estándar: encola en dataLayer; gtag.js lo procesa cuando termina de cargar.
  function gtag() { window.dataLayer.push(arguments); }
  if (gaId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    });
  }

  function loadGA() {
    if (!gaId) return;
    gtag("consent", "update", { analytics_storage: "granted" });
    if (gaLoaded) return;
    gaLoaded = true;
    gtag("js", new Date());
    gtag("config", gaId, { send_page_view: false }); // los page_view los manda el router
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- Microsoft Clarity */
  function loadClarity() {
    if (!clarityId) return;
    if (!clarityLoaded) {
      clarityLoaded = true;
      // snippet oficial de Clarity, sin minificar
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`;
      document.head.appendChild(s);
    }
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
  }

  /* Revoca lo que ya se cargó en esta visita (los scripts no se pueden descargar, pero dejan de medir). */
  function revoke() {
    if (gaLoaded) gtag("consent", "update", { analytics_storage: "denied" });
    if (clarityLoaded && window.clarity) window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
  }

  function rerenderBanner() {
    if (typeof App !== "undefined" && App.renderCookieBanner) App.renderCookieBanner();
  }

  /* "all" | "essential". Con "all" carga GA4 y Clarity y cuenta la página actual. */
  function setConsent(value) {
    if (value !== "all" && value !== "essential") return;
    write("localStorage", CONSENT_KEY, value);
    if (value === "all") {
      loadGA();
      loadClarity();
      pageView(); // la página en la que aceptó también cuenta
    } else {
      revoke();
    }
    rerenderBanner();
  }

  /* "Configurar cookies" del pie: borra la decisión, deja de medir y vuelve a mostrar el banner. */
  function resetConsent() {
    remove("localStorage", CONSENT_KEY);
    revoke();
    rerenderBanner();
  }

  /* Dirección de la página actual (el sitio navega sin recargar, así que se manda en cada page_view) */
  function virtualLocation() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function pageView() {
    if (!active() || !gaLoaded) return;
    gtag("event", "page_view", { page_location: virtualLocation(), page_title: document.title });
  }

  /* Evento de GA4 (nombres recomendados de e-commerce: view_item, add_to_cart, purchase…).
     Devuelve true si se mandó (sirve para no marcar como enviada una compra sin consentimiento). */
  function event(name, params = {}) {
    if (!active()) return false;
    let sent = false;
    if (gaLoaded) { gtag("event", name, params); sent = true; }
    // en Clarity, el evento permite filtrar las grabaciones ("sesiones con add_to_cart")
    if (clarityLoaded && window.clarity) { window.clarity("event", name); sent = true; }
    return sent;
  }

  /* ---------------------------------------------------------------- origen de la visita */
  const REFERRERS = [
    [/(^|\.)google\./, "google"], [/(^|\.)bing\.com$/, "bing"], [/(^|\.)instagram\.com$/, "instagram"],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"], [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
    [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"], [/(^|\.)tiktok\.com$/, "tiktok"],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"], [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  ];
  /* Sitios a los que el visitante va y vuelve dentro de su compra (pagar en Mercado Pago, ingresar con
     Google): no son el origen de la visita. */
  const NOT_ORIGINS = [/(^|\.)mercadopago\.com(\.ar)?$/, /(^|\.)mercadolibre\.com(\.ar)?$/, /^accounts\.google\./];
  const sameSite = (host) => host.replace(/^www\./, "") === location.hostname.replace(/^www\./, "");

  /* utm_* de la URL (también después del "#", por links viejos); si no hay, el sitio que mandó la visita. */
  function detectOrigin() {
    const params = new URLSearchParams(location.search);
    const hashQuery = location.hash.split("?")[1];
    if (hashQuery) new URLSearchParams(hashQuery).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
    const clean = (v) => (v || "").trim().slice(0, 80);
    let source = clean(params.get("utm_source"));
    let medium = clean(params.get("utm_medium"));
    const campaign = clean(params.get("utm_campaign"));
    if (!source && params.has("gclid")) { source = "google"; medium = medium || "cpc"; }
    if (!source && params.has("fbclid")) { source = "facebook"; medium = medium || "social"; }
    if (!source && document.referrer) {
      let host = "";
      try { host = new URL(document.referrer).hostname; } catch (e) { host = ""; }
      if (host && !sameSite(host) && !NOT_ORIGINS.some((re) => re.test(host))) {
        const known = REFERRERS.find(([re]) => re.test(host));
        source = known ? known[1] : host.replace(/^www\./, "");
        medium = known && /google|bing/.test(known[1]) ? "organic" : "referral";
      }
    }
    if (!source) return null;
    return { source, medium, campaign, landing: `${location.pathname}${location.hash}`, at: new Date().toISOString() };
  }

  (function captureOrigin() {
    const origin = detectOrigin();
    if (!origin) return;
    const json = JSON.stringify(origin);
    if (!read("sessionStorage", SESSION_KEY)) write("sessionStorage", SESSION_KEY, json);
    if (!read("localStorage", FIRST_TOUCH_KEY)) write("localStorage", FIRST_TOUCH_KEY, json);
  })();

  function parse(json) { try { const o = JSON.parse(json || "null"); return o && typeof o === "object" ? o : null; } catch (e) { return null; } }

  /* { first, session }: el origen de la primera visita y el de esta (null si fue directa). */
  function attribution() {
    return { first: parse(read("localStorage", FIRST_TOUCH_KEY)), session: parse(read("sessionStorage", SESSION_KEY)) };
  }

  const SOURCE_CODES = {
    instagram: "IG", ig: "IG", facebook: "FB", fb: "FB", google: "GOOGLE", bing: "BING", whatsapp: "WA",
    linkedin: "LI", youtube: "YT", tiktok: "TT", x: "X", email: "EMAIL", mail: "EMAIL", newsletter: "EMAIL",
  };
  const PAGE_CODES = {
    home: "INICIO", store: "TIENDA", "product-detail": "PRODUCTO", calculators: "CALC", cart: "CARRITO",
    order: "PEDIDO", "my-orders": "MIS-PEDIDOS", "my-account": "MIS-DATOS", login: "INGRESAR",
    contact: "CONTACTO", info: "INFO", terms: "TERMINOS", privacy: "PRIVACIDAD", revocation: "ARREPENTIMIENTO",
    installers: "INSTALADORES", "not-found": "NO-ENCONTRADA",
  };
  /* Guías (views/guides.js): un código corto por slug. */
  const GUIDE_CODES = {
    "cuantos-paneles-solares-necesito": "PANELES", "cuanto-cuesta-instalar-paneles-solares": "COSTO",
    "inversor-on-grid-off-grid-o-hibrido": "INVERSOR", "cuanto-se-ahorra-con-paneles-solares": "AHORRO",
  };
  const code = (v, max) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

  /* Código corto para el "Ref:" de WhatsApp: <origen>-<página>, ej. "IG-PRODUCTO", "GOOGLE-CALC-AHORRO";
     sin origen conocido, solo la página ("CARRITO"). El origen es el de ESTA visita: el de la primera
     (attribution().first) queda guardado aparte, pero no se usa acá, porque alguien que llegó una vez
     por Instagram y hoy entra directo no viene de Instagram. */
  function refCode() {
    const src = (attribution().session || {}).source;
    const srcCode = src ? SOURCE_CODES[String(src).toLowerCase()] || code(src, 10) : "";
    let page = "";
    if (typeof App !== "undefined" && App.state) {
      const s = App.state;
      if (s.view === "configurator") page = s.cfgTool === "steps" ? "CONFIGURADOR" : "DIMENSIONADOR";
      else if (s.view === "calculators") page = `CALC${s.calcSection ? `-${code(s.calcSection, 12)}` : ""}`;
      else if (s.view === "guides") page = s.guideSlug ? `GUIA-${GUIDE_CODES[s.guideSlug] || code(s.guideSlug, 12)}` : "GUIAS";
      else page = PAGE_CODES[s.view] || "";
    }
    return [srcCode, page].filter(Boolean).join("-");
  }

  // Si ya había aceptado en una visita anterior, se carga todo de entrada.
  if (active()) { loadGA(); loadClarity(); }

  return { enabled, consent, setConsent, resetConsent, pageView, event, attribution, refCode };
})();
