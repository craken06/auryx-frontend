/* =========================================================================
   AURYX: páginas estáticas para buscadores.
   El sitio navega con "#" (#product/db-44) y Google trata todo lo que va
   después del "#" como la misma página. Este script genera una página real
   por producto (/productos/<slug>/) y por categoría (/categorias/<slug>/),
   más /productos/ con el catálogo completo, cada una con su título,
   descripción, Open Graph, datos estructurados y el contenido ya dibujado
   (con las mismas vistas del sitio). Al cargar, app.js lee la ruta de
   <meta name="auryx-route"> y sigue funcionando como siempre.

   Uso:  node scripts/build-seo-pages.mjs
   Lo corre GitHub Actions todos los días y en cada push (.github/workflows/seo-pages.yml).
   Solo hace GET a la API. Si la API no responde, termina con error sin tocar nada.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://auryx.com.ar";
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------------------------------------------------------- vistas del sitio en Node */
const ctx = vm.createContext({
  window: { matchMedia: () => ({ matches: false }) }, // tienda: filtros cerrados (Google indexa la versión móvil)
  console, Intl, URLSearchParams,
});
for (const f of ["src/config.js", "src/data/products.js", "src/utils/format.js", "src/lib/api.js", "src/views/store.js", "src/views/productDetail.js"]) {
  vm.runInContext(read(f), ctx, { filename: f });
}
const run = (code) => vm.runInContext(code, ctx);
const API = run("API_BASE_URL");

/* ---------------------------------------------------------------- datos (solo GET) */
async function getJSON(p) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(API + p, { signal: AbortSignal.timeout(90000) }); // Render free tarda en despertar
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= 3) throw new Error(`GET ${p}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
const [apiProducts, rate] = await Promise.all([getJSON("/products"), getJSON("/exchange-rate")]);
if (!Array.isArray(apiProducts) || apiProducts.length === 0) throw new Error("La API devolvió un catálogo vacío: no se toca nada.");
if (!(Number(rate.usdArs) > 0)) throw new Error("Cotización inválida: no se toca nada.");
ctx.__api = apiProducts;
run(`USD_ARS_RATE = ${Number(rate.usdArs)}; PRODUCTS = __api.map(adaptApiProduct);`);
const PRODUCTS = run("PRODUCTS");
const CATEGORY_META = run("CATEGORY_META");
const apiById = new Map(apiProducts.map((p) => [`db-${p.id}`, p]));

/* ---------------------------------------------------------------- slugs */
const slugify = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
const productSlug = new Map();
const used = new Set();
for (const p of [...PRODUCTS].sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)))) {
  let slug = slugify(`${p.brand} ${p.name}`) || p.id;
  if (used.has(slug)) slug = `${slug}-${p.id.slice(3)}`;
  used.add(slug);
  productSlug.set(p.id, slug);
}
const categorySlug = Object.fromEntries(Object.entries(CATEGORY_META).map(([k, m]) => [k, slugify(m.label)]));
const categories = Object.keys(CATEGORY_META).filter((k) => PRODUCTS.some((p) => p.category === k));

/* Nombre en singular de cada categoría, para la descripción de la ficha */
const CATEGORY_SINGULAR = {
  panel: "Panel solar", inversor: "Inversor", regulador: "Regulador MPPT", bateria: "Batería",
  proteccion: "Protección eléctrica", cable: "Cable", accesorio: "Accesorio", soporte: "Soporte",
};

const productUrl = (p) => `/productos/${productSlug.get(p.id)}/`;
const categoryUrl = (k) => `/categorias/${categorySlug[k]}/`;

/* ---------------------------------------------------------------- HTML */
const TEMPLATE = read("index.html");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, "\\u003c");

/* Links de la vista: a las páginas reales cuando existen, al resto del sitio con "/#". */
function rewriteLinks(html) {
  return html.replace(/href="#([^"]*)"/g, (m, h) => {
    const [route] = h.split("?");
    const [view, param] = route.split("/");
    if (view === "product" && productSlug.has(param)) return `href="/productos/${productSlug.get(param)}/"`;
    if (view === "store" && !param && !h.includes("?")) return 'href="/productos/"';
    if (view === "store" && categories.includes(param) && !h.includes("?")) return `href="${categoryUrl(param)}"`;
    return `href="/#${h}"`;
  });
}
/* Mientras no cargó la app, los controles no hacen nada: se muestran deshabilitados. */
const disableControls = (html) => html.replace(/<(button|select|input)\b(?![^>]*\sdisabled\b)/g, "<$1 disabled");

function page({ urlPath, route, title, description, image, ogType = "website", graph, body }) {
  const url = SITE + urlPath;
  let html = TEMPLATE;
  const set = (re, value) => {
    if (!re.test(html)) throw new Error(`index.html cambió: no se encontró ${re}`);
    html = html.replace(re, value);
  };
  set(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>\n<meta name="auryx-route" content="${escAttr(route)}" />`);
  set(/(<meta name="description" content=")[^"]*/, `$1${escAttr(description)}`);
  set(/(<link rel="canonical" href=")[^"]*/, `$1${url}`);
  set(/(<meta property="og:type" content=")[^"]*/, `$1${ogType}`);
  set(/(<meta property="og:url" content=")[^"]*/, `$1${url}`);
  set(/(<meta property="og:title" content=")[^"]*/, `$1${escAttr(title)}`);
  set(/(<meta name="twitter:title" content=")[^"]*/, `$1${escAttr(title)}`);
  set(/(<meta property="og:description" content=")[^"]*/, `$1${escAttr(description)}`);
  set(/(<meta name="twitter:description" content=")[^"]*/, `$1${escAttr(description)}`);
  if (image) {
    set(/(<meta property="og:image" content=")[^"]*/, `$1${escAttr(image)}`);
    set(/(<meta name="twitter:image" content=")[^"]*/, `$1${escAttr(image)}`);
    html = html.replace(/\n<meta property="og:image:(width|height)"[^\n]*/g, "");
    set(/(<meta property="og:image:alt" content=")[^"]*/, `$1${escAttr(title)}`);
  }
  set(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, `$1\n${jsonLd({ "@context": "https://schema.org", "@graph": graph })}\n$2`);
  // rutas relativas → absolutas (la página vive en una subcarpeta)
  html = html.replace(/\b(href|src)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g, '$1="/$2"');
  set(/<div class="wrap boot"[\s\S]*?<\/div>\s*(?=<noscript>)/, `<div data-prerender>${disableControls(rewriteLinks(body))}</div>\n      `);
  const file = path.join(ROOT, urlPath, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const ORG = { "@type": "Organization", "@id": `${SITE}/#organizacion`, name: "AURYX", url: `${SITE}/`, logo: `${SITE}/icon-512.png` };
const crumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, u], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + u })),
});
const SCHEMA_AVAILABILITY = { disponible: "https://schema.org/InStock", "a pedido": "https://schema.org/BackOrder", "sin stock": "https://schema.org/OutOfStock" };
const storeState = (cat) => ({ storeCategory: cat, storeFilters: { brand: null, tech: null, systemType: null }, storeSort: "none", currency: "ARS", filtersOpen: false });
const renderStore = (cat) => { ctx.__s = storeState(cat); return run("renderStore(__s)"); };

/* ---------------------------------------------------------------- limpiar lo generado antes */
for (const dir of ["productos", "categorias"]) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });

/* ---------------------------------------------------------------- productos */
for (const p of PRODUCTS) {
  const api = apiById.get(p.id);
  const cat = CATEGORY_META[p.category];
  ctx.__s = { selectedProductId: p.id, productDetailQty: 1, currency: "ARS" };
  const body = run("renderProductDetail(__s)");
  ctx.__p = p;
  const specs = run("keySpecLine(__p)").replace(/\s+\/\s+/g, ", ");
  const description = clip(p.description
    ? p.description.replace(/\s+/g, " ").trim()
    : `${p.name} de ${p.brand}${specs ? ` (${specs})` : ""}. ${CATEGORY_SINGULAR[p.category] || "Equipo"} con precio en pesos y compatibilidad verificada. Comprá online en AURYX.`, 160);
  const urlPath = productUrl(p);
  const crumbItems = [["Productos", "/productos/"], ...(cat ? [[cat.label, categoryUrl(p.category)]] : []), [p.name, urlPath]];
  page({
    urlPath, route: `product/${p.id}`, ogType: "product",
    title: `${p.name}${p.brand ? ` · ${p.brand}` : ""} | AURYX`,
    description, image: p.image || null,
    graph: [ORG, crumbs(crumbItems), {
      "@type": "Product",
      "@id": `${SITE}${urlPath}#producto`,
      name: p.name,
      ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
      ...(api?.sku ? { sku: api.sku, mpn: api.sku } : {}),
      ...(cat ? { category: cat.label } : {}),
      description,
      image: p.image || `${SITE}/og-image.png`,
      url: SITE + urlPath,
      offers: {
        "@type": "Offer",
        url: SITE + urlPath,
        priceCurrency: "ARS",
        price: String(p.priceARS),
        availability: SCHEMA_AVAILABILITY[p.availability] || "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@id": `${SITE}/#organizacion` },
      },
    }],
    body,
  });
}

/* ---------------------------------------------------------------- categorías y catálogo completo */
const listGraph = (name, urlPath, list) => ({
  "@type": "CollectionPage", name, url: SITE + urlPath,
  mainEntity: { "@type": "ItemList", itemListElement: list.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + productUrl(p), name: p.name })) },
});
for (const k of categories) {
  const meta = CATEGORY_META[k];
  const list = PRODUCTS.filter((p) => p.category === k);
  const brands = [...new Set(list.map((p) => p.brand))].sort();
  const urlPath = categoryUrl(k);
  page({
    urlPath, route: `store/${k}`,
    title: `${meta.label} | AURYX`,
    description: clip(`${meta.label} ${brands.slice(0, 4).join(", ")}${brands.length > 4 ? " y más" : ""}: ${list.length} modelos con precio en pesos y compatibilidad verificada. Comprá online.`, 160),
    graph: [ORG, crumbs([["Productos", "/productos/"], [meta.label, urlPath]]), listGraph(meta.label, urlPath, list)],
    body: renderStore(k),
  });
}
page({
  urlPath: "/productos/", route: "store",
  title: "Productos | AURYX",
  description: clip(`Paneles solares, inversores y baterías de ${[...new Set(PRODUCTS.map((p) => p.brand))].slice(0, 4).join(", ")} y más. Precios en pesos y compatibilidad verificada antes de comprar.`, 160),
  graph: [ORG, crumbs([["Productos", "/productos/"]]), listGraph("Productos", "/productos/", PRODUCTS)],
  body: renderStore("all"),
});

/* ---------------------------------------------------------------- sitemap */
const lastmod = (list) => list.map((p) => (apiById.get(p.id)?.updatedAt || "").slice(0, 10)).filter(Boolean).sort().pop();
const urls = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/productos/", priority: "0.9", changefreq: "daily", lastmod: lastmod(PRODUCTS) },
  ...categories.map((k) => ({ loc: categoryUrl(k), priority: "0.8", changefreq: "daily", lastmod: lastmod(PRODUCTS.filter((p) => p.category === k)) })),
  ...[...PRODUCTS].sort((a, b) => productUrl(a).localeCompare(productUrl(b))).map((p) => ({ loc: productUrl(p), priority: "0.7", changefreq: "weekly", lastmod: lastmod([p]) })),
];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lo genera scripts/build-seo-pages.mjs: no editar a mano. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`);

console.log(`Listo: ${PRODUCTS.length} productos, ${categories.length} categorías, ${urls.length} URLs en sitemap.xml.`);
