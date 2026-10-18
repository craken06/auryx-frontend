/* =========================================================================
   AURYX: direcciones del sitio.
   Por dentro cada página es una "ruta" (store/panel?marca=X, product/db-44,
   calculators/ahorro…: la misma forma que tenía antes detrás del "#"). En la
   barra del navegador se ve la dirección limpia (/categorias/paneles-solares/?marca=X,
   /productos/byd-battery-box-premium-lvs-4-0/, /calculadoras/ahorro/).
   Este archivo traduce en los dos sentidos. Las vistas pueden seguir escribiendo
   href="#store": app.js reescribe esos links a la dirección limpia.
   También lo usa scripts/build-seo-pages.mjs, así las páginas estáticas y la app
   arman las mismas direcciones.
   Depende de: data/products.js (PRODUCTS, CATEGORY_META).
   ========================================================================= */

/* Vista → primer tramo de la dirección (producto y categoría tienen su propia regla). */
const ROUTE_PATHS = {
  store: "productos", configurator: "disena-tu-sistema", calculators: "calculadoras", cart: "carrito",
  info: "informacion", contact: "contacto", terms: "terminos", privacy: "privacidad",
  pedido: "pedido", arrepentimiento: "arrepentimiento", ingresar: "ingresar",
  "mis-pedidos": "mis-pedidos", "mi-cuenta": "mi-cuenta",
};
const PATH_ROUTES = Object.fromEntries(Object.entries(ROUTE_PATHS).map(([route, path]) => [path, route]));
const ROUTE_VIEWS = ["home", "product", ...Object.keys(ROUTE_PATHS)];

/* "Battery-Box Premium LVS 4.0" → "battery-box-premium-lvs-4-0" */
function slugify(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

/* Slug de cada producto: marca + nombre; si dos coinciden, el más nuevo lleva el número al final. */
let productSlugCache = { list: null, byId: new Map(), bySlug: new Map() };
function productSlugMaps() {
  if (productSlugCache.list === PRODUCTS) return productSlugCache;
  const byId = new Map();
  const bySlug = new Map();
  const num = (p) => Number(String(p.id).replace(/\D/g, "")) || 0;
  [...PRODUCTS].sort((a, b) => num(a) - num(b)).forEach((p) => {
    let slug = slugify(`${p.brand || ""} ${p.name}`) || String(p.id);
    if (bySlug.has(slug)) slug = `${slug}-${num(p)}`;
    byId.set(p.id, slug);
    bySlug.set(slug, p.id);
  });
  productSlugCache = { list: PRODUCTS, byId, bySlug };
  return productSlugCache;
}
const productSlug = (p) => productSlugMaps().byId.get(p.id) || String(p.id);

/* Producto por id ("db-44") o por slug (el que viene en la dirección). */
function findProduct(key) {
  if (!key) return null;
  return PRODUCTS.find((p) => p.id === key) || PRODUCTS.find((p) => p.id === productSlugMaps().bySlug.get(key)) || null;
}

const categorySlug = (key) => slugify(CATEGORY_META[key] ? CATEGORY_META[key].label : key);
const categoryFromSlug = (slug) => Object.keys(CATEGORY_META).find((k) => categorySlug(k) === slug) || null;

/* ¿Es una ruta de la app (y no un ancla dentro de la página, como "#main")? */
function isRoute(route) {
  return route === "" || ROUTE_VIEWS.includes(String(route).split(/[/?]/)[0]);
}

/* Ruta interna → dirección limpia. "store/panel?marca=X" → "/categorias/paneles-solares/?marca=X" */
function routeToPath(route) {
  const [path, query] = String(route || "").replace(/^#/, "").split("?");
  const [view, param] = path.split("/");
  const q = query ? `?${query}` : "";
  if (!view || view === "home") return `/${q}`;
  if (view === "product") {
    const p = findProduct(param);
    return `/productos/${p ? productSlug(p) : param}/${q}`;
  }
  if (view === "store" && param) return `/categorias/${categorySlug(param)}/${q}`;
  const base = ROUTE_PATHS[view] || view; // desconocida: la app muestra "no encontrada"
  return `/${base}/${param ? `${param}/` : ""}${q}`;
}

/* Dirección limpia → ruta interna. "/calculadoras/ahorro/" → "calculators/ahorro" */
function pathToRoute(pathname, search) {
  const parts = String(pathname || "/").replace(/(^|\/)index\.html$/, "").split("/").filter(Boolean);
  const q = search && search !== "?" ? search : "";
  const [first, second] = parts;
  let route;
  if (!first) route = "";
  else if (parts.length > 2) route = "no-encontrada";
  else if (first === "productos") route = second ? `product/${second}` : "store";
  else if (first === "categorias") route = second ? `store/${categoryFromSlug(second) || second}` : "store";
  else if (PATH_ROUTES[first]) route = PATH_ROUTES[first] + (second ? `/${second}` : "");
  else route = "no-encontrada";
  return route + q;
}

/* Ruta de la página que se está viendo. */
function currentRoute() {
  return pathToRoute(location.pathname, location.search);
}

/* ¿La dirección es una página de la app? (no el admin ni un archivo como sitemap.xml) */
function isAppPath(pathname) {
  return !/^\/admin(\/|$)/.test(pathname) && !/\.[a-z0-9]+$/i.test(pathname.replace(/\/index\.html$/, "/"));
}
