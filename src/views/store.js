/* AURYX — Tienda: listado, filtros y orden. Depende de: data/products.js, utils/format.js. */

/* ---------------------------------------------------------------------- */
/* TIENDA                                                                   */
/* ---------------------------------------------------------------------- */
function productSpecsHTML(p) {
  const entries = Object.entries(p.specs).filter(([, v]) => typeof v !== "object").slice(0, 5);
  return `<div class="sf-mono text-xs space-y-1" style="color:var(--text-dim)">
    ${entries.map(([k, v]) => `<div class="flex justify-between gap-3"><span>${SPEC_LABELS[k] || k}</span><span>${v}</span></div>`).join("")}
  </div>`;
}

const AVAILABILITY_SORT_RANK = { disponible: 0, "a pedido": 1, "sin stock": 2 };

function renderStore(state) {
  const cat = state.storeCategory || "all";
  const byCategory = cat === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat);

  // Opciones de filtro: se calculan dinámicamente a partir de lo que hay
  // realmente disponible en la categoría actual (así nunca se muestra un
  // filtro vacío o que no aplica).
  const brandOptions = [...new Set(byCategory.map((p) => p.brand))].sort();
  const techOptions = [...new Set(byCategory.map((p) => p.specs?.tech || p.specs?.tecnologia || p.specs?.technology).filter(Boolean))].sort();
  const systemTypeOptions = [...new Set(byCategory.flatMap((p) => p.systemTypes || []))];

  const filters = state.storeFilters || {};
  let filtered = byCategory;
  if (filters.brand) filtered = filtered.filter((p) => p.brand === filters.brand);
  if (filters.tech) filtered = filtered.filter((p) => (p.specs?.tech || p.specs?.tecnologia || p.specs?.technology) === filters.tech);
  if (filters.systemType) filtered = filtered.filter((p) => (p.systemTypes || []).includes(filters.systemType));

  const sort = state.storeSort || "none";
  filtered = [...filtered].sort((a, b) => {
    if (sort === "price-asc") return a.priceARS - b.priceARS;
    if (sort === "price-desc") return b.priceARS - a.priceARS;
    if (sort === "stock") return (AVAILABILITY_SORT_RANK[a.availability] ?? 9) - (AVAILABILITY_SORT_RANK[b.availability] ?? 9);
    return 0;
  });

  const filterButtons = [`<a href="#store" class="px-3 py-1.5 text-sm border inline-block ${cat === "all" ? "sf-btn-primary border-transparent" : "sf-btn-outline"}">Todos</a>`]
    .concat(Object.entries(CATEGORY_META).map(([key, meta]) => `
      <a href="#store/${key}" class="px-3 py-1.5 text-sm border inline-flex items-center gap-1.5 ${cat === key ? "sf-btn-primary border-transparent" : "sf-btn-outline"}">
        ${iconTag(meta.icon, 14)} ${meta.label}
      </a>`)).join("");

  const chipsHTML = (label, key, options, formatLabel) => {
    if (options.length === 0) return "";
    return `
      <div class="mb-2">
        <span class="text-xs uppercase tracking-wide mr-2" style="color:var(--text-dim)">${label}:</span>
        ${options.map((opt) => `
          <button onclick="App.setStoreFilter('${key}', '${opt}')" class="sf-filter-chip ${filters[key] === opt ? "active" : ""}">${formatLabel ? formatLabel(opt) : opt}</button>
        `).join("")}
      </div>`;
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const filterBar = `
    <div class="sf-filter-bar mb-6">
      ${chipsHTML("Marca", "brand", brandOptions)}
      ${chipsHTML("Tecnología", "tech", techOptions)}
      ${chipsHTML("Tipo de sistema", "systemType", systemTypeOptions, (v) => (v === "ongrid" ? "On-grid" : v === "offgrid" ? "Off-grid" : v === "hybrid" ? "Híbrido" : v))}
      ${hasActiveFilters ? `<button onclick="App.clearStoreFilters()" class="text-xs underline" style="color:var(--text-dim)">Limpiar filtros</button>` : ""}
    </div>`;

  const sortBar = `
    <div class="flex items-center gap-2 mb-6">
      <span class="text-sm" style="color:var(--text-dim)">Ordenar por:</span>
      <select onchange="App.setStoreSort(this.value)" class="sf-input" style="width:auto">
        <option value="none" ${sort === "none" ? "selected" : ""}>Relevancia</option>
        <option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Precio: menor a mayor</option>
        <option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Precio: mayor a menor</option>
        <option value="stock" ${sort === "stock" ? "selected" : ""}>Disponibilidad de stock</option>
      </select>
      <span class="text-xs ml-auto" style="color:var(--text-dim)">${filtered.length} producto${filtered.length === 1 ? "" : "s"}</span>
    </div>`;

  const cards = filtered.map((p) => {
    const avail = AVAILABILITY_META[p.availability];
    return `
    <a href="#product/${p.id}" class="sf-card p-5 flex flex-col cursor-pointer">
      ${imagePlaceholderHTML("h-36")}
      <div class="flex items-start justify-between mb-2">
        <p class="text-xs uppercase tracking-wide" style="color:var(--text-dim)">${p.brand}</p>
        <span class="text-xs px-2 py-1 rounded-sm ${avail.cls}">${avail.label}</span>
      </div>
      <h3 class="font-semibold mb-2 sf-display leading-snug">${p.name}</h3>
      <p class="text-sm mb-4" style="color:var(--text-mid)">${p.description}</p>
      <div class="mt-auto pt-4 border-t flex items-center justify-between" style="border-color:var(--line)">
        ${priceTagHTML(p, state.currency)}
        <button onclick="event.stopPropagation(); App.addToCart('${p.id}', 1)" class="sf-btn-outline px-3 py-1.5 text-sm flex items-center gap-1.5">
          ${iconTag("plus", 14)} Añadir
        </button>
      </div>
    </a>`;
  }).join("");

  const emptyState = `<p class="text-sm py-12 text-center" style="color:var(--text-dim)">No hay productos que coincidan con los filtros elegidos.</p>`;

  return `
  <div class="max-w-6xl mx-auto px-5 py-12">
    <h1 class="sf-display text-3xl font-semibold mb-2">Productos</h1>
    <p class="text-sm mb-8" style="color:var(--text-mid)">Componentes individuales con especificaciones técnicas de fabricante. Hacé clic en un producto para ver el detalle completo.</p>
    <div class="flex gap-2 flex-wrap mb-6">${filterButtons}</div>
    ${filterBar}
    ${sortBar}
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">${filtered.length ? cards : emptyState}</div>
  </div>`;
}
