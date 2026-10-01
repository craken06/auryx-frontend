/* AURYX: Cliente de la API real (compragamer-api). Depende de: config.js (API_BASE_URL, USD_ARS_RATE). */

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
 * Convierte un producto tal como lo devuelve la API (compragamer-api)
 * al shape que espera el resto del frontend (el mismo que tenía cada
 * objeto dentro del array PRODUCTS hardcodeado en data.js).
 */
function adaptApiProduct(apiProduct) {
  const price = Number(apiProduct.price);
  const isUSD = apiProduct.currency === "USD";

  return {
    id: `db-${apiProduct.id}`, // prefijo para no colisionar con IDs de demo
    category: apiProduct.category ? apiProduct.category.slug : "otro",
    brand: apiProduct.brand,
    name: apiProduct.name,
    priceUSD: isUSD ? price : +(price / USD_ARS_RATE).toFixed(2),
    priceARS: isUSD ? Math.round(price * USD_ARS_RATE) : price,
    availability: AVAILABILITY_MAP[apiProduct.stockStatus] || "disponible",
    description: apiProduct.description || "",
    specs: apiProduct.specs || {},
    // El configurador filtra inversores/reguladores por systemTypes (ver
    // configurator.js). Ahora que el spec_schema de "inversor" incluye ese
    // campo, lo leemos directo de specs en vez de dejarlo vacío. Si un
    // producto viejo todavía no lo tiene cargado, cae a [] (no aparece en
    // el configurador hasta que se le complete el dato, sin inventarlo).
    systemTypes: apiProduct.specs?.systemTypes || [],
    _fromApi: true,
  };
}

/**
 * Pide la cotización USD→ARS vigente a la API y actualiza USD_ARS_RATE.
 * Si falla, queda el valor de respaldo de config.js y no se interrumpe nada.
 * EXCHANGE_INFO guarda el origen para mostrarlo en el pie de página.
 */
let EXCHANGE_INFO = null;
async function loadExchangeRate() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE_URL}/exchange-rate`, {
      signal: controller.signal,
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`La API respondió ${res.status}`);
    const data = await res.json();
    const rate = Number(data.usdArs);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("cotización inválida");
    USD_ARS_RATE = rate;
    EXCHANGE_INFO = { rate, updatedAt: data.updatedAt || null, source: data.source };
  } catch (err) {
    console.warn("No se pudo cargar la cotización del dólar, se usa el valor de respaldo:", err.message);
  }
}

/**
 * Pide los productos reales a la API. Si falla (API caída, CORS, etc.)
 * devuelve null para que quien llame decida el fallback.
 */
async function loadProductsFromAPI() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s máximo de espera
    // la cotización se pide en paralelo y tiene que estar lista antes de convertir precios
    const [res] = await Promise.all([
      fetch(`${API_BASE_URL}/products`, {
        signal: controller.signal,
        headers: { "ngrok-skip-browser-warning": "true" },
      }),
      loadExchangeRate(),
    ]);
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`La API respondió ${res.status}`);
    const data = await res.json();
    return data.map(adaptApiProduct);
  } catch (err) {
    console.error("No se pudo cargar productos desde la API:", err.message);
    return null;
  }
}
