/* AURYX: Cliente de la API real (compragamer-api). Depende de: config.js (API_BASE_URL, USD_ARS_RATE), data/products.js (DEMO_MODE, DEMO_PRODUCTS), lib/session.js. */

/* =========================================================================
   AURYX: Conexión con el backend real (compragamer-api / NestJS + Prisma)
   Trae los productos desde la API y los adapta al formato que ya espera
   el resto del frontend (mismo shape que antes usaba el array estático
   PRODUCTS en data.js).
   ========================================================================= */

// stock_status en la base vs. el formato "availability" que ya usa el frontend
const AVAILABILITY_MAP = {
  disponible: "disponible",
  a_pedido: "a pedido",
  sin_stock: "sin stock",
};

/**
 * El motor de compatibilidad y el configurador leen las claves normalizadas
 * (pmax, capacityWh). La API usa claves en español: se agregan los alias sin
 * pisar lo que ya venga cargado. La ficha (views/productDetail.js) muestra la
 * clave normalizada y oculta la de la API cuando están las dos, así el dato
 * no aparece repetido.
 */
function normalizeApiSpecs(slug, specs) {
  const out = { ...specs };
  if (slug === "panel" && out.pmax == null && out.potencia_wp != null) out.pmax = out.potencia_wp;
  if (slug === "bateria" && out.capacityWh == null && out.capacidad_kwh != null) out.capacityWh = out.capacidad_kwh * 1000;
  return out;
}

/**
 * Convierte un producto tal como lo devuelve la API (compragamer-api)
 * al shape que espera el resto del frontend (el mismo que tenía cada
 * objeto dentro del array PRODUCTS hardcodeado en data.js).
 */
function adaptApiProduct(apiProduct) {
  const price = Number(apiProduct.price);
  const isUSD = apiProduct.currency === "USD";
  const firstImage = [...(apiProduct.images || [])].sort((a, b) => (a.order || 0) - (b.order || 0))[0];

  return {
    id: `db-${apiProduct.id}`, // prefijo para no colisionar con IDs de demo
    category: apiProduct.category ? apiProduct.category.slug : "otro",
    brand: apiProduct.brand,
    name: apiProduct.name,
    priceUSD: isUSD ? price : +(price / USD_ARS_RATE).toFixed(2),
    priceARS: isUSD ? Math.round(price * USD_ARS_RATE) : price,
    availability: AVAILABILITY_MAP[apiProduct.stockStatus] || "disponible",
    description: apiProduct.description || "",
    specs: normalizeApiSpecs(apiProduct.category?.slug, apiProduct.specs || {}),
    // El configurador filtra inversores/reguladores por systemTypes (ver
    // configurator.js). Ahora que el spec_schema de "inversor" incluye ese
    // campo, lo leemos directo de specs en vez de dejarlo vacío. Si un
    // producto viejo todavía no lo tiene cargado, cae a [] (no aparece en
    // el configurador hasta que se le complete el dato, sin inventarlo).
    systemTypes: apiProduct.specs?.systemTypes || [],
    // primera imagen de product_images (por orden); sin imágenes se muestra el ícono de la categoría.
    // imageAlt: el texto alternativo que se carga en el admin (vacío = productThumbHTML decide).
    image: firstImage?.url || null,
    imageAlt: (firstImage && typeof firstImage.altText === "string" && firstImage.altText.trim()) || "",
    inStore: apiProduct.showInStore !== false, // false: fuera de la tienda, solo para el dimensionador
    updatedAt: apiProduct.updatedAt || null, // las guías fechan los precios con la última actualización
    _fromApi: true,
  };
}

/* id numérico de la base a partir del id del frontend ("db-24" -> 24); null si es de demo. */
function dbIdOf(product) {
  const m = /^db-(\d+)$/.exec(product && product.id || "");
  return m ? Number(m[1]) : null;
}

/**
 * Llamada a la API con timeout. Devuelve el JSON o lanza Error con el mensaje
 * que mandó el backend (validaciones en castellano), para mostrarlo tal cual.
 * Con `auth: true` manda el token del cliente; si la API responde 401 la sesión
 * venció: se borra (el carrito no se toca) y se pide ingresar de nuevo, volviendo
 * después a la página actual. Con `redirectOn401: false` solo se borra la sesión y
 * se avisa (evento "auryx:session-expired"); quien llama decide qué mostrar.
 */
async function apiRequest(path, { method = "GET", body, timeoutMs = 8000, auth = false, redirectOn401 = true } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Content-Type solo con cuerpo: un GET sin headers extra no necesita preflight de CORS
  const headers = body === undefined ? {} : { "Content-Type": "application/json" };
  const session = auth ? getSession() : null;
  if (session) headers.Authorization = `Bearer ${session.token}`;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data && data.message;
      const err = new Error(Array.isArray(msg) ? msg.join(" ") : msg || `La API respondió ${res.status}`);
      err.status = res.status; // sin status = no hubo respuesta (red caída, timeout)
      // 401 de un token que ya no es el actual (se ingresó con otra cuenta mientras tanto): se ignora
      const current = getSession();
      if (auth && res.status === 401 && session && current && current.token === session.token) {
        clearSession();
        markSessionExpired();
        window.dispatchEvent(new CustomEvent("auryx:session-expired"));
        if (redirectOn401) {
          rememberAfterLogin(currentRoute());
          navigateHash("ingresar");
        }
      }
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("El servidor tardó demasiado en responder.");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* Avisos de diagnóstico: solo en desarrollo local (en el sitio publicado la consola queda limpia). */
function devWarn(...args) {
  if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) console.warn(...args);
}

/* Parámetros del motor de compatibilidad (temperatura mínima de diseño, márgenes).
   Si la API no responde se usan los mismos valores por defecto que el backend. */
let COMPAT_PARAMS = { tMinC: -10, tCellMaxC: 70 };
async function loadCompatibilityParams() {
  try {
    const data = await apiRequest("/compatibility/rules", { timeoutMs: 8000 });
    if (data && data.params) COMPAT_PARAMS = { ...COMPAT_PARAMS, ...data.params };
  } catch (err) {
    devWarn("No se pudieron cargar los parámetros de compatibilidad:", err.message);
  }
}

/**
 * Pide la cotización USD→ARS vigente a la API (la misma con la que el backend cobra los
 * productos cargados en USD) y actualiza USD_ARS_RATE. Devuelve true si la obtuvo.
 * EXCHANGE_INFO guarda el origen para mostrarlo en el pie de página.
 */
let EXCHANGE_INFO = null;
async function loadExchangeRate(timeoutMs = 8000) {
  try {
    const data = await apiRequest("/exchange-rate", { timeoutMs });
    const rate = Number(data && data.usdArs);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("cotización inválida");
    USD_ARS_RATE = rate;
    EXCHANGE_INFO = { rate, updatedAt: data.updatedAt || null, source: data.source };
    return true;
  } catch (err) {
    devWarn("No se pudo cargar la cotización del dólar:", err.message);
    return false;
  }
}

/**
 * Carga el catálogo: productos + cotización (las dos cosas hacen falta para mostrar precios
 * que coincidan con lo que cobra el backend). La API está en Render gratis: si estuvo un rato
 * sin uso, la primera respuesta tarda de 30 a 60 s. Por eso se reintenta hasta `deadlineMs`
 * (70 s) antes de rendirse; `onSlow` avisa a los 2,5 s para cambiar el mensaje de espera.
 * Devuelve la lista de productos adaptados, o null si no se pudo (quien llama muestra el error).
 * Nunca cae a un catálogo de ejemplo, salvo en el modo demo de desarrollo local (DEMO_MODE).
 */
async function loadCatalog({ deadlineMs = 70000, onSlow } = {}) {
  if (typeof DEMO_MODE !== "undefined" && DEMO_MODE) {
    USD_ARS_RATE = 1500; // cotización de ejemplo, solo para la demo local
    return DEMO_PRODUCTS.slice();
  }
  const start = Date.now();
  const left = () => deadlineMs - (Date.now() - start);
  const slowTimer = onSlow ? setTimeout(onSlow, 2500) : null;
  let products = null;
  let rateOk = false;
  try {
    while (left() > 0) {
      // un intento largo cubre el arranque en frío; si falla rápido (502 de Render, red), se espera y se repite
      const timeoutMs = Math.max(1000, Math.min(left(), 45000));
      const [list, ok] = await Promise.all([
        products ? products : apiRequest("/products", { timeoutMs }).catch((err) => { devWarn("No se pudo cargar el catálogo:", err.message); return null; }),
        rateOk ? true : loadExchangeRate(timeoutMs),
      ]);
      if (Array.isArray(list)) products = list;
      rateOk = ok;
      if (products && rateOk) return products.map(adaptApiProduct);
      if (left() > 3000) await new Promise((r) => setTimeout(r, 3000));
      else break;
    }
    return null;
  } finally {
    clearTimeout(slowTimer);
  }
}
