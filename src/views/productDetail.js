/* AURYX: detalle de producto. Depende de: data/products.js, utils/format.js. */

const CONFIGURABLE_CATEGORIES = ["panel", "inversor", "regulador", "bateria"];

/* Tope de unidades por producto desde la ficha (app.js puede usarlo para validar). */
const DETAIL_QTY_MAX = 999;

/* Claves de la API que repiten un dato que ya tiene su clave normalizada: si están las dos, se oculta la de la API. */
const DETAIL_SPEC_ALIASES = {
  potencia_wp: "pmax", potencia_nominal_w: "ratedPowerAC", vmpp_max: "mpptRangeMax", vmpp_min: "mpptRangeMin",
  capacidad_kwh: "capacityWh", vida_util_ciclos: "cycles", corriente_max_entrada: "maxInputCurrentPerMppt",
};
/* Claves que no se muestran en la tabla (systemTypes ya se ve en el filtro de la tienda y en el configurador). */
const DETAIL_SPEC_HIDDEN = ["systemTypes", "system_types"];
/* Valores de texto que llegan sin tilde o en minúscula. */
const DETAIL_SPEC_VALUE_TEXT = { monofasico: "Monofásico", trifasico: "Trifásico", monofásico: "Monofásico", trifásico: "Trifásico", bifasico: "Bifásico" };

function detailSpecVisible(specs) {
  return ([k]) => !DETAIL_SPEC_HIDDEN.includes(k) && !(DETAIL_SPEC_ALIASES[k] && specs[DETAIL_SPEC_ALIASES[k]] != null);
}

/* Texto del valor de una especificación en la ficha (ya escapado). */
function detailSpecValueHTML(k, v) {
  if (typeof v === "string" && DETAIL_SPEC_VALUE_TEXT[v.trim().toLowerCase()]) return DETAIL_SPEC_VALUE_TEXT[v.trim().toLowerCase()];
  // listas de texto: se traduce cada valor; rangos numéricos [min, max]: specValueText ("-40 a 85 °C")
  if (Array.isArray(v) && !v.every((x) => typeof x === "number")) return esc(v.map((x) => (typeof x === "string" && DETAIL_SPEC_VALUE_TEXT[x.toLowerCase()]) || x).join(", "));
  return esc(specValueText(k, v));
}

function renderProductDetail(state) {
  const p = findProduct(state.selectedProductId); // id o slug de la dirección
  if (!p) {
    return `
    <div class="wrap page">
      <div class="empty">
        ${icon("package")}
        <h1 class="page-title page-title-sm">No encontramos ese producto</h1>
        <p>Puede que ya no esté en el catálogo. Buscalo entre los productos disponibles.</p>
        <a href="#store" class="btn btn-primary">Ver productos</a>
      </div>
    </div>`;
  }

  const catMeta = CATEGORY_META[p.category];
  const qty = Math.min(DETAIL_QTY_MAX, Math.max(1, Math.round(Number(state.productDetailQty)) || 1));
  const simpleSpecs = Object.entries(p.specs || {})
    .filter(([, v]) => v !== null && v !== "" && (typeof v !== "object" || Array.isArray(v)))
    .filter(detailSpecVisible(p.specs || {}));
  const keyKeys = keySpecKeys(p).filter((k) => simpleSpecs.some(([sk]) => sk === k));
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
        <div class="detail-price">${priceTagHTML(p, state.currency, "lg")}</div>
        <div class="detail-buy">
          <div class="stepper" role="group" aria-label="Cantidad">
            <button type="button" class="icon-btn" data-action="detail-step" data-delta="-1" data-fid="detail-minus" aria-label="Restar uno" ${qty <= 1 ? "disabled" : ""}>${icon("minus")}</button>
            <input id="detail-qty-input" class="input num-input" type="number" inputmode="numeric" min="1" max="${DETAIL_QTY_MAX}" step="1" value="${qty}"
              name="quantity" autocomplete="off" aria-label="Cantidad" data-bind="detail-qty" />
            <button type="button" class="icon-btn" data-action="detail-step" data-delta="1" data-fid="detail-plus" aria-label="Sumar uno" ${qty >= DETAIL_QTY_MAX ? "disabled" : ""}>${icon("plus")}</button>
          </div>
          <button type="button" class="btn btn-primary btn-lg" data-action="cart-add" data-id="${esc(p.id)}" data-qty-from="detail-qty-input" data-fid="detail-add" ${soldOut ? "disabled" : ""}>
            ${icon("shopping-cart-simple")} ${soldOut ? "Sin stock" : "Agregar al carrito"}
          </button>
        </div>
        ${CONFIGURABLE_CATEGORIES.includes(p.category) ? `<p class="small muted">¿No sabés si es compatible con tu equipo? <a href="#configurator/paso-a-paso" class="link-arrow">Diseñá tu sistema ${icon("arrow-right")}</a></p>` : ""}
      </div>
    </div>

    ${simpleSpecs.length ? `
    <section class="spec-section" aria-labelledby="specs-title">
      <h2 id="specs-title">Especificaciones técnicas</h2>
      <dl class="key-specs">
        ${featured.map((k) => `<div class="key-spec-tile"><dt>${esc(specShortLabel(k))}</dt><dd>${detailSpecValueHTML(k, p.specs[k])}</dd></div>`).join("")}
      </dl>
      ${rest.length ? `<dl class="spec-list">
        ${rest.map(([k, v]) => `<div><dt>${esc(specShortLabel(k))}</dt><dd>${detailSpecValueHTML(k, v)}</dd></div>`).join("")}
      </dl>` : ""}
    </section>` : ""}
  </div>`;
}
