/* AURYX: tienda (listado, filtros y orden). Depende de: data/products.js, utils/format.js. */

const AVAILABILITY_SORT_RANK = { disponible: 0, "a pedido": 1, "sin stock": 2 };
const SYSTEM_TYPE_LABELS = { ongrid: "On-grid", offgrid: "Off-grid", hybrid: "Híbrido" };
const SORT_OPTIONS = [
  { value: "none", label: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "stock", label: "Disponibilidad" },
];

/* En desktop los filtros son una columna fija (siempre abiertos); en móvil
   son un desplegable que respeta lo que eligió el usuario. */
function filtersStartOpen(state, activeCount) {
  const desktop = window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
  return desktop || state.filtersOpen || activeCount > 0;
}

function productTech(p) {
  return p.specs?.tech || p.specs?.tecnologia || p.specs?.technology;
}

/* Filtra y ordena según el estado de la tienda (que a su vez sale de la URL). */
function storeResults(state) {
  const cat = state.storeCategory || "all";
  const byCategory = cat === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat);
  const filters = state.storeFilters || {};
  let list = byCategory;
  if (filters.brand) list = list.filter((p) => p.brand === filters.brand);
  if (filters.tech) list = list.filter((p) => productTech(p) === filters.tech);
  if (filters.systemType) list = list.filter((p) => (p.systemTypes || []).includes(filters.systemType));

  const sort = state.storeSort || "none";
  list = [...list].sort((a, b) => {
    if (sort === "price-asc") return a.priceARS - b.priceARS;
    if (sort === "price-desc") return b.priceARS - a.priceARS;
    if (sort === "stock") return (AVAILABILITY_SORT_RANK[a.availability] ?? 9) - (AVAILABILITY_SORT_RANK[b.availability] ?? 9);
    return 0;
  });
  return { byCategory, list };
}

function productCardHTML(p, currency) {
  const spec = keySpecLine(p);
  return `
  <article class="product-card">
    ${productThumbHTML(p, "", true)}
    <div class="card-body">
      <p class="brand">${esc(p.brand)}</p>
      <h3><a href="#product/${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
      ${spec ? `<p class="key-spec mono">${esc(spec)}</p>` : ""}
      <div class="card-foot">
        ${priceTagHTML(p, currency)}
        <button type="button" class="btn btn-secondary btn-sm" data-action="cart-add" data-id="${esc(p.id)}" data-fid="add-${esc(p.id)}"
          aria-label="Agregar ${esc(p.name)} al carrito" ${p.availability === "sin stock" ? "disabled" : ""}>
          ${icon("plus")} Agregar
        </button>
      </div>
    </div>
  </article>`;
}

function renderStore(state) {
  const cat = state.storeCategory || "all";
  const { byCategory, list } = storeResults(state);
  const filters = state.storeFilters || {};

  // Las opciones salen de lo que realmente hay en la categoría (nunca un filtro vacío)
  const groups = [
    { key: "brand", label: "Marca", options: [...new Set(byCategory.map((p) => p.brand))].sort() },
    { key: "tech", label: "Tecnología", options: [...new Set(byCategory.map(productTech).filter(Boolean))].sort() },
    { key: "systemType", label: "Tipo de sistema", options: [...new Set(byCategory.flatMap((p) => p.systemTypes || []))], fmt: (v) => SYSTEM_TYPE_LABELS[v] || v },
  ].filter((g) => g.options.length > 0);

  const activeCount = Object.values(filters).filter(Boolean).length;

  const tabs = [`<a href="#store" class="cat-tab"${cat === "all" ? ' aria-current="page"' : ""}>Todos</a>`]
    .concat(Object.entries(CATEGORY_META).map(([key, meta]) =>
      `<a href="#store/${key}" class="cat-tab"${cat === key ? ' aria-current="page"' : ""}>${icon(meta.icon)}${meta.label}</a>`))
    .join("");

  const filterGroups = groups.map((g) => `
    <fieldset class="filter-group">
      <legend>${g.label}</legend>
      <div class="chip-list">
        ${g.options.map((opt) => `
          <button type="button" class="chip" data-action="filter" data-key="${g.key}" data-value="${esc(opt)}"
            data-fid="f-${g.key}-${esc(opt)}" aria-pressed="${filters[g.key] === opt}">${esc(g.fmt ? g.fmt(opt) : opt)}</button>`).join("")}
      </div>
    </fieldset>`).join("");

  const filtersAside = groups.length ? `
    <aside class="store-filters" aria-label="Filtros">
      <details class="filters-disclosure" ${filtersStartOpen(state, activeCount) ? "open" : ""} data-bind="filters-open">
        <summary>${icon("faders")} Filtros${activeCount ? ` (${activeCount})` : ""} ${icon("caret-down")}</summary>
        ${filterGroups}
        ${activeCount ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-top:20px" data-action="filters-clear">${icon("arrow-counter-clockwise")} Limpiar filtros</button>` : ""}
      </details>
    </aside>` : "<div></div>";

  const sort = state.storeSort || "none";
  const results = list.length
    ? `<div class="product-grid">${list.map((p) => productCardHTML(p, state.currency)).join("")}</div>`
    : `<div class="empty">
        ${icon("magnifying-glass")}
        <h2>No hay productos con esos filtros</h2>
        <p>Probá quitar alguno de los filtros o mirá otra categoría.</p>
        ${activeCount ? `<button type="button" class="btn btn-secondary" data-action="filters-clear">Limpiar filtros</button>` : `<a href="#store" class="btn btn-secondary">Ver todos los productos</a>`}
      </div>`;

  const title = cat === "all" ? "Productos" : (CATEGORY_META[cat]?.label || "Productos");

  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">${title}</h1>
      <p class="page-lead">Componentes con especificaciones de fabricante. Entrá a cada uno para ver la ficha técnica completa. Todos los precios incluyen IVA.</p>
    </div>
    <nav class="cat-tabs" aria-label="Categorías">${tabs}</nav>
    <div class="store-layout">
      ${filtersAside}
      <div>
        <div class="results-bar">
          <p class="small muted" aria-live="polite"><span class="num">${list.length}</span> ${list.length === 1 ? "producto" : "productos"}</p>
          <label class="field" style="grid-auto-flow:column;align-items:center;gap:10px">
            <span class="small muted">Ordenar por</span>
            <select class="select" data-bind="store-sort" name="sort">
              ${SORT_OPTIONS.map((o) => `<option value="${o.value}" ${sort === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
            </select>
          </label>
        </div>
        ${results}
      </div>
    </div>
  </div>`;
}
