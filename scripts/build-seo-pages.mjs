/* =========================================================================
   AURYX: páginas estáticas para buscadores.
   El sitio es una sola app (index.html) que navega sin recargar con direcciones
   limpias (/productos/…, /calculadoras/…, ver src/lib/routes.js). GitHub Pages
   solo sirve archivos que existen, así que este script genera una copia de
   index.html por cada dirección, con su título, descripción, Open Graph y datos
   estructurados:
   - una página por producto (/productos/<slug>/) y por categoría (/categorias/<slug>/),
     más /productos/, con el contenido ya dibujado con las mismas vistas del sitio;
   - las páginas fijas (/disena-tu-sistema/, /calculadoras/, /contacto/…);
   - 404.html: la app entera, para direcciones que no existen como archivo
     (/pedido/AX-123/, un producto cargado después del último build). La app
     lee la dirección y muestra la página o "No encontramos esa página".
   Además arma sitemap.xml.

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
for (const f of ["src/config.js", "src/data/products.js", "src/lib/routes.js", "src/utils/format.js", "src/lib/api.js",
  "src/views/store.js", "src/views/productDetail.js", "src/views/footer.js", "src/views/home.js", "src/views/infoContact.js", "src/views/legal.js"]) {
  vm.runInContext(read(f), ctx, { filename: f });
}
const run = (code) => vm.runInContext(code, ctx);
const API = run("API_BASE_URL");
const routeToPath = run("routeToPath");
const isRoute = run("isRoute");

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
const CALCULATOR_LINKS = run("CALCULATOR_LINKS");
const apiById = new Map(apiProducts.map((p) => [`db-${p.id}`, p]));
const categories = Object.keys(CATEGORY_META).filter((k) => PRODUCTS.some((p) => p.category === k));

const productUrl = (p) => routeToPath(`product/${p.id}`);
const categoryUrl = (k) => routeToPath(`store/${k}`);

/* Nombre en singular de cada categoría, para la descripción de la ficha */
const CATEGORY_SINGULAR = {
  panel: "Panel solar", inversor: "Inversor", regulador: "Regulador MPPT", bateria: "Batería",
  proteccion: "Protección eléctrica", cable: "Cable", accesorio: "Accesorio", soporte: "Soporte",
};

/* ---------------------------------------------------------------- HTML */
const TEMPLATE = read("index.html");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, "\\u003c");

/* Links de las vistas (href="#store/panel") → direcciones limpias, igual que hace app.js. */
const rewriteLinks = (html) => html.replace(/href="#([^"]*)"/g, (m, route) => (isRoute(route) ? `href="${routeToPath(route)}"` : m));
/* Mientras no cargó la app, los controles no hacen nada: se muestran deshabilitados. */
const disableControls = (html) => html.replace(/<(button|select|input)\b(?![^>]*\sdisabled\b)/g, "<$1 disabled");

function buildHTML({ urlPath, title, description, image, ogType = "website", graph, body, noindex = false }) {
  const url = SITE + urlPath;
  let html = TEMPLATE;
  const set = (re, value) => {
    if (!re.test(html)) throw new Error(`index.html cambió: no se encontró ${re}`);
    html = html.replace(re, value);
  };
  set(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>${noindex ? '\n<meta name="robots" content="noindex" />' : ""}`);
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
  if (graph) set(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, `$1\n${jsonLd({ "@context": "https://schema.org", "@graph": graph })}\n$2`);
  if (body) set(/<div class="wrap boot"[\s\S]*?<\/div>\s*(?=<noscript>)/, `<div data-prerender>${disableControls(rewriteLinks(body))}</div>\n      `);
  return html;
}
function writePage(urlPath, html) {
  const file = path.join(ROOT, urlPath, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
const page = (opts) => writePage(opts.urlPath, buildHTML(opts));

const ORG = { "@type": "Organization", "@id": `${SITE}/#organizacion`, name: "AURYX", url: `${SITE}/`, logo: `${SITE}/icon-512.png` };
const crumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, u], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + u })),
});
const SCHEMA_AVAILABILITY = { disponible: "https://schema.org/InStock", "a pedido": "https://schema.org/BackOrder", "sin stock": "https://schema.org/OutOfStock" };
const storeState = (cat) => ({ storeCategory: cat, storeFilters: { brand: null, tech: null, systemType: null }, storeSort: "none", currency: "ARS", filtersOpen: false });
const renderStore = (cat) => { ctx.__s = storeState(cat); return run("renderStore(__s)"); };

/* ---------------------------------------------------------------- limpiar lo generado antes */
const STATIC_PAGES = [
  // [ruta, título, descripción, en el sitemap, contenido ya dibujado]
  ["configurator", "Diseñá tu sistema solar", "Calculá en minutos qué sistema solar necesitás: paneles, inversor y baterías según tu consumo y tu zona, con productos reales y precios en pesos.", true],
  ["configurator/paso-a-paso", "Configurador paso a paso", "Armá tu sistema fotovoltaico paso a paso: elegí paneles, inversor y baterías y verificá la compatibilidad eléctrica antes de comprar.", true],
  ["calculators", "Calculadoras solares", "Calculadoras gratis de consumo eléctrico, costo de la energía, ahorro con paneles solares y orientación e inclinación de los paneles.", true],
  ...CALCULATOR_LINKS.map((c) => [`calculators/${c.id}`, `Calculadora de ${c.name.toLowerCase()}`, `${c.text} Calculadora solar gratis de AURYX.`, false]),
  ["info", "Información", "Cómo comprar en AURYX: envíos, retiro, garantía, medios de pago y qué pasa después de armar tu sistema solar.", true, () => run("renderInfo()")],
  ["contact", "Contacto", "Escribinos por WhatsApp o con el formulario: te ayudamos a elegir los equipos y a dimensionar tu sistema solar.", true],
  ["terms", "Términos y condiciones", "Términos y condiciones de compra en AURYX: precios, envíos, garantía y derecho de arrepentimiento.", true, () => run("renderTerms()")],
  ["privacy", "Política de privacidad", "Qué datos personales usa AURYX, para qué y cómo ejercer tus derechos de acceso, rectificación y supresión.", true, () => run("renderPrivacy()")],
  ["arrepentimiento", "Botón de arrepentimiento", "Pedí la cancelación de tu compra dentro de los 10 días corridos de recibida, sin dar motivos (Ley 24.240).", true],
  ["cart", "Carrito", "Tu carrito de compras en AURYX.", false],
  ["ingresar", "Ingresar", "Ingresá a tu cuenta de AURYX.", false],
  ["mis-pedidos", "Mis pedidos", "Tus pedidos en AURYX.", false],
  ["mi-cuenta", "Mis datos", "Tus datos en AURYX.", false],
];
const GENERATED_DIRS = ["productos", "categorias", ...new Set(STATIC_PAGES.map(([route]) => routeToPath(route).split("/")[1]))];
for (const dir of GENERATED_DIRS) {
  if (["admin", "src", "css", "scripts", ".github", ""].includes(dir)) throw new Error(`Carpeta protegida: ${dir}`);
  fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
}

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
    urlPath, ogType: "product",
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
    urlPath,
    title: `${meta.label} | AURYX`,
    description: clip(`${meta.label} ${brands.slice(0, 4).join(", ")}${brands.length > 4 ? " y más" : ""}: ${list.length} modelos con precio en pesos y compatibilidad verificada. Comprá online.`, 160),
    graph: [ORG, crumbs([["Productos", "/productos/"], [meta.label, urlPath]]), listGraph(meta.label, urlPath, list)],
    body: renderStore(k),
  });
}
page({
  urlPath: "/productos/",
  title: "Productos | AURYX",
  description: clip(`Paneles solares, inversores y baterías de ${[...new Set(PRODUCTS.map((p) => p.brand))].slice(0, 4).join(", ")} y más. Precios en pesos y compatibilidad verificada antes de comprar.`, 160),
  graph: [ORG, crumbs([["Productos", "/productos/"]]), listGraph("Productos", "/productos/", PRODUCTS)],
  body: renderStore("all"),
});

/* ---------------------------------------------------------------- páginas fijas */
for (const [route, name, description, indexable, prerender] of STATIC_PAGES) {
  const urlPath = routeToPath(route);
  // cada calculadora es una sección de /calculadoras/: esa es la página que se indexa
  const canonicalPath = route.startsWith("calculators/") ? routeToPath("calculators") : urlPath;
  let html = buildHTML({
    urlPath: canonicalPath, title: `${name} | AURYX`, description, noindex: !indexable && canonicalPath === urlPath,
    graph: [ORG, crumbs([[name, canonicalPath]])],
    body: prerender ? prerender() : null,
  });
  writePage(urlPath, html);
}

/* ---------------------------------------------------------------- 404.html: la app para cualquier otra dirección */
fs.writeFileSync(path.join(ROOT, "404.html"), buildHTML({
  urlPath: "/", title: "Página no encontrada | AURYX", noindex: true,
  description: "La página que buscás no existe o cambió de dirección.",
}).replace(/\n<link rel="canonical"[^\n]*/, "").replace(/\n<meta property="og:url"[^\n]*/, ""));

/* ---------------------------------------------------------------- sitemap */
const lastmod = (list) => list.map((p) => (apiById.get(p.id)?.updatedAt || "").slice(0, 10)).filter(Boolean).sort().pop();
const urls = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/productos/", priority: "0.9", changefreq: "daily", lastmod: lastmod(PRODUCTS) },
  ...categories.map((k) => ({ loc: categoryUrl(k), priority: "0.8", changefreq: "daily", lastmod: lastmod(PRODUCTS.filter((p) => p.category === k)) })),
  ...[...PRODUCTS].sort((a, b) => productUrl(a).localeCompare(productUrl(b))).map((p) => ({ loc: productUrl(p), priority: "0.7", changefreq: "weekly", lastmod: lastmod([p]) })),
  ...STATIC_PAGES.filter(([, , , indexable]) => indexable).map(([route]) => ({ loc: routeToPath(route), priority: route.startsWith("configurator") || route === "calculators" ? "0.8" : "0.4", changefreq: "monthly" })),
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

console.log(`Listo: ${PRODUCTS.length} productos, ${categories.length} categorías, ${STATIC_PAGES.length} páginas fijas, ${urls.length} URLs en sitemap.xml.`);
