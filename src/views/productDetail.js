/* AURYX: detalle de producto. Depende de: data/products.js, utils/format.js. */

const CONFIGURABLE_CATEGORIES = ["panel", "inversor", "regulador", "bateria"];

function renderProductDetail(state) {
  const p = PRODUCTS.find((pr) => pr.id === state.selectedProductId);
  if (!p) {
    return `
    <div class="wrap page">
      <div class="empty">
        ${icon("package")}
        <h1 class="page-title" style="font-size:1.75rem">No encontramos ese producto</h1>
        <p>Puede que ya no esté en el catálogo. Buscalo entre los productos disponibles.</p>
        <a href="#store" class="btn btn-primary">Ver productos</a>
      </div>
    </div>`;
  }

  const catMeta = CATEGORY_META[p.category];
  const qty = state.productDetailQty || 1;
  const simpleSpecs = Object.entries(p.specs || {}).filter(([, v]) => v !== null && (typeof v !== "object" || Array.isArray(v)));
  const keyKeys = (KEY_SPECS_BY_CATEGORY[p.category] || []).filter((k) => p.specs?.[k] != null);
  const featured = (keyKeys.length ? keyKeys : simpleSpecs.slice(0, 4).map(([k]) => k)).slice(0, 4);
  const rest = simpleSpecs.filter(([k]) => !featured.includes(k));
  const soldOut = p.availability === "sin stock";

  return `
  <div class="wrap page">
    <nav class="breadcrumb" aria-label="Ruta">
      <a href="#store">Productos</a> ${icon("caret-right")}
      ${catMeta ? `<a href="#store/${p.category}">${catMeta.label}</a> ${icon("caret-right")}` : ""}
      <span aria-current="page" class="muted">${esc(p.name)}</span>
    </nav>

    <div class="detail-grid">
      ${productThumbHTML(p, "thumb-lg")}
      <div class="detail-info">
        <p class="small dim">${esc(p.brand)}${catMeta ? ` / ${catMeta.label}` : ""}</p>
        <h1>${esc(p.name)}</h1>
        <div>${availabilityBadgeHTML(p.availability)}</div>
        ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ""}
        <div>${priceTagHTML(p, state.currency, "lg")}</div>
        <div class="detail-buy">
          <div class="stepper" role="group" aria-label="Cantidad">
            <button type="button" class="icon-btn" data-action="detail-step" data-delta="-1" data-fid="detail-minus" aria-label="Restar uno" ${qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
            <input id="detail-qty-input" class="input num-input" type="number" inputmode="numeric" min="1" value="${qty}"
              name="quantity" autocomplete="off" aria-label="Cantidad" data-bind="detail-qty" />
            <button type="button" class="icon-btn" data-action="detail-step" data-delta="1" data-fid="detail-plus" aria-label="Sumar uno">${icon("plus")}</button>
          </div>
          <button type="button" class="btn btn-primary btn-lg" data-action="cart-add" data-id="${esc(p.id)}" data-qty-from="detail-qty-input" data-fid="detail-add" ${soldOut ? "disabled" : ""}>
            ${icon("shopping-cart-simple")} ${soldOut ? "Sin stock" : "Agregar al carrito"}
          </button>
        </div>
        ${CONFIGURABLE_CATEGORIES.includes(p.category) ? `<p class="small muted">¿No sabés si es compatible con tu equipo? <a href="#configurator" class="link-arrow">Diseñá tu sistema ${icon("arrow-right")}</a></p>` : ""}
      </div>
    </div>

    ${simpleSpecs.length ? `
    <section class="spec-section" aria-labelledby="specs-title">
      <h2 id="specs-title">Especificaciones técnicas</h2>
      <dl class="key-specs">
        ${featured.map((k) => `<div class="key-spec-tile"><dt>${esc(specShortLabel(k))}</dt><dd>${esc(specValueText(k, p.specs[k]))}</dd></div>`).join("")}
      </dl>
      ${rest.length ? `<dl class="spec-list">
        ${rest.map(([k, v]) => `<div><dt>${esc(specShortLabel(k))}</dt><dd>${esc(specValueText(k, v))}</dd></div>`).join("")}
      </dl>` : ""}
    </section>` : ""}
  </div>`;
}
