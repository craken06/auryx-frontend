/* AURYX: formato de números/moneda, escape de HTML y piezas de UI reutilizables. Depende de: lib/compatibilityEngine.js (STATUS_META), data/products.js (CATEGORY_META). */

/* =========================================================================
   ESCAPE
   Todo texto que viene de la API (nombres, marcas, descripciones, specs)
   pasa por esc() antes de entrar a un string de HTML.
   ========================================================================= */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* =========================================================================
   NÚMEROS (Intl, nunca formatos armados a mano)
   ========================================================================= */
const NF = {
  ars: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }),
  usd: new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
  int: new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }),
};
const nfCache = {};
function fmtNum(n, decimals = 0) {
  if (!nfCache[decimals]) nfCache[decimals] = new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return nfCache[decimals].format(Number(n) || 0);
}
const fmtARS = (n) => NF.ars.format(Math.round(Number(n) || 0));
// USD: sin centavos si el importe es entero; con centavos si no (así las líneas suman el total que se muestra)
const NF_USD_CENTS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isInteger(v) ? NF.usd.format(v) : NF_USD_CENTS.format(v);
};
// Alias viejo de fmtARS: queda solo por compatibilidad con las vistas que todavía lo usan.
const fmtMoney = fmtARS;

function priceText(item, currency) {
  return currency === "USD" ? fmtUSD(item.priceUSD) : fmtARS(item.priceARS);
}

/* Todos los precios del sitio incluyen IVA. En los totales y en la ficha se aclara al lado del número. */
function priceTagHTML(item, currency, size) {
  if (size === "lg") return `<span class="price price-lg">${priceText(item, currency)}<small class="iva">IVA incluido</small></span>`;
  return `<span class="price">${priceText(item, currency)}</span>`;
}

/* Enlace de WhatsApp con el mensaje ya escrito. Al final se agrega un código corto de
   origen ("Ref: IG-PRODUCTO": de dónde vino la visita y desde qué página escribe) para
   anotar en la planilla de leads de dónde salió cada venta cerrada por chat (ver Analytics.refCode).
   Sin texto se usa un saludo, así el código también viaja en los links genéricos. */
function whatsappLink(text) {
  const ref = typeof Analytics !== "undefined" ? Analytics.refCode() : "";
  const body = `${text || "Hola, tengo una consulta."}${ref ? `\n\nRef: ${ref}` : ""}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;
}

/* Aviso técnico general: se muestra donde el usuario ve resultados de compatibilidad o cálculo. */
const TECH_DISCLAIMER = "Los resultados son orientativos. La verificación de compatibilidad usa los datos de la hoja del fabricante y corrige la tensión por la temperatura mínima indicada; las calculadoras son estimaciones con los valores que cargás. Ninguna considera sombras, pérdidas de cableado ni normativa local. No reemplazan un proyecto firmado por un profesional matriculado. El dimensionamiento final lo confirmamos con vos antes de la compra, y la instalación debe hacerla personal matriculado.";

/* Nombre para mostrar. Los nombres del catálogo siguen el patrón "{Qué es} {Marca} {Tecnología} –
   {Línea o modelo} – {Dato clave}" (ej. "Panel Solar Jinko N-Type TOPCon – Tiger Neo – 585 W") y ya
   llevan la marca; los que todavía no, la llevan adelante. Mismo criterio que productTitle de la API
   (src/products/title.ts): los pedidos y el dimensionador tienen que nombrar igual. */
function productTitle(p) {
  const name = String((p && p.name) || "");
  const brandWord = String((p && p.brand) || "").trim().split(/\s+/)[0];
  if (!brandWord) return name;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${brandWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu");
  return re.test(name) ? name : `${p.brand} ${name}`;
}
/* El nombre listo para el HTML: escapado y sin cortar la línea entre el número y la unidad ("5 kW"). */
const productTitleHTML = (p) => esc(productTitle(p)).replace(/(\d) (?=(?:kWh|kWp|kW|Wp|W|V|Ah|A)\b)/g, "$1\u00a0");

/* Modelo técnico del fabricante (el nombre de antes, guardado en specs.modelo al renombrar). */
const productModel = (p) => (p && p.specs && p.specs.modelo) || "";

/* Instalación y asesoría sobre ciertas líneas ({ product, qty }): solo para mostrarla; lo que se
   cobra lo calcula la API con los precios de la base. */
function installationPrice(lines) {
  const pct = (k) => Math.round(lines.reduce((s, l) => s + l.product[k] * l.qty, 0) * INSTALLATION_RATE * 100) / 100;
  return { priceARS: pct("priceARS"), priceUSD: pct("priceUSD") };
}
const INSTALLATION_LABEL = "Instalación y asesoría";

function techNoteHTML(extraClass = "") {
  return `<p class="tech-note${extraClass ? " " + extraClass : ""}">${icon("info")}<span><strong>Aviso técnico.</strong> ${TECH_DISCLAIMER}</span></p>`;
}

/* =========================================================================
   ÍCONOS (Phosphor). Siempre decorativos: el texto accesible va al lado
   o en aria-label del control que los contiene.
   ========================================================================= */
function icon(name, extraClass = "", weight = "regular") {
  const base = weight === "fill" ? `ph-fill ph-${name}` : `ph ph-${name}`;
  return `<i class="${base}${extraClass ? " " + extraClass : ""}" aria-hidden="true"></i>`;
}

/* =========================================================================
   BADGES de estado (compatibilidad y stock)
   ========================================================================= */
function statusBadgeHTML(status) {
  const m = STATUS_META[status];
  if (!m) return "";
  return `<span class="badge tone-${m.tone}">${icon(m.icon, "", "fill")}${m.label}</span>`;
}

function availabilityBadgeHTML(availability) {
  const m = AVAILABILITY_META[availability] || AVAILABILITY_META["disponible"];
  return `<span class="badge tone-${m.tone}">${m.label}</span>`;
}

/* =========================================================================
   MINIATURA DE PRODUCTO
   Sin foto se muestra el ícono de la categoría sobre un fondo de marca.
   Si el producto llega con `image`, se usa esa, con el texto alternativo
   cargado en el admin (`imageAlt`). En la ficha ("thumb-lg") la foto es el
   contenido principal: sin texto alternativo se usa el nombre del producto.
   En las tarjetas, sin texto alternativo queda alt="" (el nombre ya está al lado).
   ========================================================================= */
function productThumbHTML(product, extraClass = "", withBadge = false) {
  const meta = CATEGORY_META[product.category];
  const isMain = /(^|\s)thumb-lg(\s|$)/.test(extraClass);
  const alt = product.imageAlt || (isMain ? product.name : "");
  const inner = product.image
    ? `<img src="${esc(product.image)}" alt="${esc(alt)}" width="400" height="300"${isMain ? "" : ' loading="lazy"'} decoding="async" />`
    : icon(meta ? meta.icon : "package");
  return `<div class="thumb ${extraClass}">${inner}${withBadge ? availabilityBadgeHTML(product.availability) : ""}</div>`;
}

/* Línea de especificación clave según categoría (para tarjetas y listados). */
const KEY_SPECS_BY_CATEGORY = {
  // incluye las claves normalizadas y las que devuelve la API; se toman las presentes.
  // Un sub-array agrupa sinónimos: se usa solo el primero que esté cargado (la clave normalizada
  // va primero, igual que en la tabla de la ficha, que oculta la de la API si están las dos).
  panel: [["pmax", "potencia_wp"], "efficiency", "voc", "isc"],
  inversor: [["ratedPowerAC", "potencia_nominal_w"], "maxPvPower", ["maxPvVoltage", "vmpp_max"], ["maxInputCurrentPerMppt", "corriente_max_entrada"], "efficiency"],
  regulador: ["ratedChargeCurrent", "maxPvVoltage", "trackingEfficiency"],
  bateria: [["capacityWh", "capacidad_kwh"], "nominalVoltage", ["cycles", "vida_util_ciclos"], "maxContinuousCurrent"],
};
function keySpecKeys(product) {
  return (KEY_SPECS_BY_CATEGORY[product.category] || [])
    .map((k) => (Array.isArray(k) ? k : [k]).find((alt) => product.specs?.[alt] != null))
    .filter(Boolean);
}
const SPEC_UNITS = {
  pmax: "W", efficiency: "%", voc: "V", isc: "A", vmp: "V", imp: "A",
  ratedPowerAC: "W", maxPvPower: "W", maxPvVoltage: "V", maxInputCurrentPerMppt: "A",
  ratedChargeCurrent: "A", trackingEfficiency: "%", capacityWh: "Wh", usableWh: "Wh",
  nominalVoltage: "V", maxContinuousCurrent: "A", capacityAh: "Ah",
  cycles: "ciclos", vida_util_ciclos: "ciclos", coef_temp_voc: "%/°C",
};

/* Valores internos de la base con su texto para el público ("trifasico" → "Trifásico"). */
const SPEC_VALUE_LABELS = {
  monofasico: "Monofásico", bifasico: "Bifásico", trifasico: "Trifásico",
  ongrid: "On-grid", hybrid: "Híbrido", offgrid: "Off-grid",
};
const specValueLabel = (v) => (typeof v === "string" && SPEC_VALUE_LABELS[v.trim().toLowerCase()]) || v;

/* Devuelve TEXTO PLANO, sin escapar (los valores pueden venir del JSON de specs que carga
   el admin): quien lo inserta en HTML tiene que pasarlo por esc(). */
function specValueText(key, value) {
  if (value === null || value === undefined || value === "") return "s/d";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  // la unidad sale de la tabla o, si no está, del "(V)" / "(A)" de la etiqueta
  const unit = SPEC_UNITS[key] || ((SPEC_LABELS[key] || "").match(/\((V|A|W|Wh|kWh|Ah|%|%\/°C|mA|m|mm|Pa|kg|°C)\)$/) || [])[1];
  if (Array.isArray(value)) {
    value = value.map(specValueLabel);
    // [min, max] numérico = rango ("-40 a 85 °C"); cualquier otra lista se enumera ("IEC 61215, IEC 61730")
    const isRange = value.length === 2 && value.every((v) => typeof v === "number");
    return isRange ? `${fmtNum(value[0], 1).replace(/,0$/, "")} a ${fmtNum(value[1], 1).replace(/,0$/, "")}${unit ? " " + unit : ""}` : value.join(", ");
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) value = Number(value);
  if (typeof value === "number") {
    const decimals = Number.isInteger(value) ? 0 : Math.min(2, String(value).split(".")[1]?.length || 0);
    return `${fmtNum(value, decimals)}${unit ? " " + unit : ""}`;
  }
  return String(specValueLabel(value));
}

/* Etiqueta corta (sin la unidad entre paréntesis) para tiles y tarjetas. */
function specShortLabel(key) {
  // claves sin etiqueta conocida: "carga_max_kg" → "Carga max kg"
  const label = SPEC_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "));
  return label.replace(/\s*\([^)]*\)\s*$/, "");
}

function keySpecLine(product) {
  const keys = keySpecKeys(product).slice(0, 3);
  if (!keys.length) return "";
  return keys.map((k) => specValueText(k, product.specs[k])).join("  /  ");
}
