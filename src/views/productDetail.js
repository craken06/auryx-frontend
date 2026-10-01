/* AURYX — Detalle de producto. Depende de: data/products.js, utils/format.js. */

/* ---------------------------------------------------------------------- */
/* DETALLE DE PRODUCTO                                                      */
/* ---------------------------------------------------------------------- */
function renderProductDetail(state) {
  const p = PRODUCTS.find((pr) => pr.id === state.selectedProductId);
  if (!p) return `<div class="max-w-3xl mx-auto px-5 py-16">Producto no encontrado.</div>`;
  const avail = AVAILABILITY_META[p.availability];
  const catMeta = CATEGORY_META[p.category];
  const qty = state.productDetailQty || 1;

  const specRows = Object.entries(p.specs).filter(([, v]) => typeof v !== "object")
    .map(([k, v]) => `
      <div class="flex justify-between border-b py-2" style="border-color:var(--line)">
        <span style="color:var(--text-dim)">${SPEC_LABELS[k] || k}</span><span>${v}</span>
      </div>`).join("");

  return `
  <div class="max-w-4xl mx-auto px-5 py-12">
    <a href="#store" class="sf-btn-outline px-3 py-1.5 text-sm inline-flex items-center gap-1.5 mb-8">${iconTag("arrow-left", 14)} Volver a productos</a>
    <div class="grid md:grid-cols-2 gap-10">
      <div>${imagePlaceholderHTML("h-80")}</div>
      <div>
        <div class="flex items-center gap-2 mb-2">
          ${iconTag(catMeta ? catMeta.icon : "package", 18, "--yellow")}
          <span class="text-xs uppercase tracking-wide" style="color:var(--text-dim)">${p.brand} · ${catMeta ? catMeta.label : ""}</span>
        </div>
        <h1 class="sf-display text-2xl font-semibold mb-3">${p.name}</h1>
        <span class="text-xs px-2 py-1 rounded-sm ${avail.cls}">${avail.label}</span>
        <p class="text-sm my-5" style="color:var(--text-mid)">${p.description}</p>
        <div class="flex items-center gap-4 mb-6">${priceTagHTML(p, state.currency, "lg")}</div>
        <div class="flex items-center gap-2 mb-6">
          <button onclick="App.detailQtyStep(-1)" class="sf-btn-outline p-2">${iconTag("minus", 14)}</button>
          <input id="detail-qty-input" type="number" min="1" value="${qty}" oninput="App.detailQtySet(this.value)" class="sf-input w-16 text-center" />
          <button onclick="App.detailQtyStep(1)" class="sf-btn-outline p-2">${iconTag("plus", 14)}</button>
          <button onclick="App.addToCart('${p.id}', document.getElementById('detail-qty-input').value)" class="sf-btn-primary px-5 py-2.5 flex items-center gap-2 ml-2">${iconTag("shopping-cart", 16)} Añadir al carrito</button>
        </div>
      </div>
    </div>
    <div class="sf-card p-6 mt-10">
      <h2 class="sf-display font-semibold mb-4">Especificaciones técnicas</h2>
      <div class="grid sm:grid-cols-2 gap-x-8 gap-y-0 sf-mono text-sm">${specRows}</div>
    </div>
  </div>`;
}
