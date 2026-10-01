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
const fmtUSD = (n) => NF.usd.format(Math.round(Number(n) || 0));
const fmtMoney = (n) => fmtARS(n);

function priceText(item, currency) {
  return currency === "USD" ? fmtUSD(item.priceUSD) : fmtARS(item.priceARS);
}

/* Todos los precios del sitio incluyen IVA. En los totales y en la ficha se aclara al lado del número. */
function priceTagHTML(item, currency, size) {
  if (size === "lg") return `<span class="price price-lg">${priceText(item, currency)}<small class="iva">IVA incluido</small></span>`;
  return `<span class="price">${priceText(item, currency)}</span>`;
}

/* Enlace de WhatsApp con el mensaje ya escrito. */
function whatsappLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/* Aviso técnico general: se muestra donde el usuario ve resultados de compatibilidad o cálculo. */
const TECH_DISCLAIMER = "La verificación de compatibilidad y las calculadoras son orientativas: usan datos de la hoja del fabricante y no consideran corrección por temperatura, sombras, pérdidas de cableado ni normativa local. No reemplazan un proyecto firmado por un profesional matriculado. El dimensionamiento final lo confirmamos con vos antes de la compra, y la instalación debe hacerla personal matriculado.";

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
   El catálogo todavía no trae fotos: se muestra el ícono de la categoría
   sobre un fondo de marca. Si el producto llega con `image`, se usa esa.
   ========================================================================= */
function productThumbHTML(product, extraClass = "", withBadge = false) {
  const meta = CATEGORY_META[product.category];
  const inner = product.image
    ? `<img src="${esc(product.image)}" alt="" width="400" height="300" loading="lazy" decoding="async" />`
    : icon(meta ? meta.icon : "package");
  return `<div class="thumb ${extraClass}">${inner}${withBadge ? availabilityBadgeHTML(product.availability) : ""}</div>`;
}

/* Línea de especificación clave según categoría (para tarjetas y listados). */
const KEY_SPECS_BY_CATEGORY = {
  // incluye las claves del catálogo de demo y las que devuelve la API; se toman las presentes
  panel: ["pmax", "potencia_wp", "efficiency", "voc", "isc"],
  inversor: ["ratedPowerAC", "potencia_nominal_w", "maxPvPower", "maxPvVoltage", "vmpp_max", "corriente_max_entrada", "efficiency"],
  regulador: ["ratedChargeCurrent", "maxPvVoltage", "trackingEfficiency"],
  bateria: ["capacityWh", "capacidad_kwh", "nominalVoltage", "cycles", "vida_util_ciclos", "maxContinuousCurrent"],
};
const SPEC_UNITS = {
  pmax: "W", efficiency: "%", voc: "V", isc: "A", vmp: "V", imp: "A",
  ratedPowerAC: "W", maxPvPower: "W", maxPvVoltage: "V", maxInputCurrentPerMppt: "A",
  ratedChargeCurrent: "A", trackingEfficiency: "%", capacityWh: "Wh", usableWh: "Wh",
  nominalVoltage: "V", maxContinuousCurrent: "A", capacityAh: "Ah",
};

function specValueText(key, value) {
  if (value === null || value === undefined || value === "") return "s/d";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  // la unidad sale de la tabla o, si no está, del "(V)" / "(A)" de la etiqueta
  const unit = SPEC_UNITS[key] || ((SPEC_LABELS[key] || "").match(/\((V|A|W|Wh|kWh|Ah|%|mA|m|mm|Pa|kg|°C)\)$/) || [])[1];
  if (Array.isArray(value)) {
    // [min, max] numérico = rango ("-40 a 85 °C"); cualquier otra lista se enumera ("IEC 61215, IEC 61730")
    const isRange = value.length === 2 && value.every((v) => typeof v === "number");
    return isRange ? `${fmtNum(value[0], 1).replace(/,0$/, "")} a ${fmtNum(value[1], 1).replace(/,0$/, "")}${unit ? " " + unit : ""}` : value.join(", ");
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) value = Number(value);
  if (typeof value === "number") {
    const decimals = Number.isInteger(value) ? 0 : Math.min(2, String(value).split(".")[1]?.length || 0);
    return `${fmtNum(value, decimals)}${unit ? " " + unit : ""}`;
  }
  return String(value);
}

/* Etiqueta corta (sin la unidad entre paréntesis) para tiles y tarjetas. */
function specShortLabel(key) {
  // claves sin etiqueta conocida: "carga_max_kg" → "Carga max kg"
  const label = SPEC_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "));
  return label.replace(/\s*\([^)]*\)\s*$/, "");
}

function keySpecLine(product) {
  const keys = (KEY_SPECS_BY_CATEGORY[product.category] || []).filter((k) => product.specs?.[k] != null).slice(0, 3);
  if (!keys.length) return "";
  return keys.map((k) => specValueText(k, product.specs[k])).join("  /  ");
}
