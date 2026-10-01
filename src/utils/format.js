/* AURYX — Formato de precios/moneda + helpers de ícono e imagen. Depende de: lib/compatibilityEngine.js (STATUS_META). */

/* =========================================================================
   HELPERS de formato y componentes HTML reutilizables
   ========================================================================= */
const fmtARS = (n) => Math.round(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const fmtUSD = (n) => Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

function priceTagHTML(product, currency, size) {
  const val = currency === "USD" ? `US$ ${fmtUSD(product.priceUSD)}` : `$ ${fmtARS(product.priceARS)}`;
  const cls = size === "lg" ? "sf-display text-2xl font-semibold" : "font-semibold";
  return `<span class="${cls}" style="color:var(--yellow)">${val} <span class="sf-mono text-xs" style="color:var(--text-dim)">${currency}</span></span>`;
}

function statusBadgeHTML(status, size) {
  const m = STATUS_META[status];
  const sz = size === "sm" || !size ? "text-xs" : "text-sm";
  const iconSize = size === "sm" || !size ? 12 : 14;
  return `<span class="inline-flex items-center gap-1 ${m.cls} px-2 py-1 rounded-sm ${sz} font-medium">
    <i data-lucide="${m.icon}" style="width:${iconSize}px;height:${iconSize}px" stroke-width="2.5"></i> ${m.label}
  </span>`;
}

function imagePlaceholderHTML(heightClass) {
  return `<div class="sf-img-placeholder ${heightClass || "h-36"} w-full mb-3">
    <i data-lucide="image" style="width:22px;height:22px"></i>
    <span class="text-xs sf-mono">Imagen del producto</span>
  </div>`;
}

function iconTag(name, size, colorVar) {
  const style = `width:${size || 18}px;height:${size || 18}px${colorVar ? `;color:var(${colorVar})` : ""}`;
  return `<i data-lucide="${name}" style="${style}"></i>`;
}
