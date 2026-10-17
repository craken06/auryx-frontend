/* =========================================================================
   AURYX admin: capa que habla con compragamer-api desde el navegador.
   Antes esto lo hacía un servidor Express local (SQLadder/server.js); ahora el
   panel se publica en GitHub Pages y llama a la API directo (CORS habilitado
   para este dominio). El panel sigue pidiendo rutas "/api/...": acá se
   traducen a la API y se adaptan los campos (la API usa camelCase; el
   formulario del panel, snake_case).
   La seguridad no depende de esta página: la API exige el token de admin en
   cada escritura y lectura privada.
   API_BASE_URL sale de ../src/config.js (el mismo que usa el sitio).
   ========================================================================= */

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function apiFetch(token, path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError('No se pudo conectar con la API. Si recién se despierta (plan gratuito), esperá unos segundos y probá de nuevo.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `La API respondió ${res.status}`;
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }
  return data;
}

function productToAdminRow(p) {
  const specs = p.specs || {};
  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    sku: p.sku,
    price: p.price,
    currency: p.currency,
    stock_status: p.stockStatus,
    active: p.active,
    category_name: p.category ? p.category.name : '',
    images: (p.images || []).length,
    in_configurator: Array.isArray(specs.systemTypes) && specs.systemTypes.length > 0,
    created_at: p.createdAt,
  };
}

function productToAdminDetail(p) {
  return {
    id: p.id,
    category_id: p.categoryId,
    brand: p.brand,
    name: p.name,
    sku: p.sku,
    price: p.price,
    currency: p.currency,
    stock_status: p.stockStatus,
    active: p.active,
    description: p.description,
    specs: p.specs,
    datasheet_url: p.datasheetUrl,
    images: (p.images || []).map((i) => ({ id: i.id, url: i.url, alt_text: i.altText, order: i.order })),
  };
}

function adminBodyToApiPayload(body) {
  let specs;
  try {
    specs = typeof body.specs === 'string' ? JSON.parse(body.specs || '{}') : (body.specs || {});
  } catch (e) {
    throw new ApiError('El campo "specs" no es un JSON válido: ' + e.message, 400);
  }
  return {
    categoryId: Number(body.category_id),
    brand: body.brand,
    name: body.name,
    sku: body.sku || undefined,
    price: Number(body.price),
    currency: body.currency || 'ARS',
    stockStatus: body.stock_status || 'disponible',
    description: body.description || undefined,
    specs,
    datasheetUrl: body.datasheet_url || undefined,
    ...(body.active === undefined ? {} : { active: body.active === true || body.active === 'true' }),
  };
}

const enc = encodeURIComponent;
const json = (method, body) => ({ method, body: JSON.stringify(body) });
const pick = (query, keys) => {
  const qs = keys.filter((k) => query.get(k)).map((k) => `${k}=${enc(query.get(k))}`).join('&');
  return qs ? `?${qs}` : '';
};

// [método, patrón de la ruta del panel, handler(ctx)] — ctx: { t (token), p (parámetros), q (query), b (body) }
const ROUTES = [
  ['POST', '/api/login', (c) => apiFetch(null, '/auth/login', json('POST', c.b))],
  ['GET', '/api/me', (c) => apiFetch(c.t, '/auth/me')],

  ['GET', '/api/categories', async (c) => (await apiFetch(c.t, '/categories'))
    .map((x) => ({ id: x.id, slug: x.slug, name: x.name, spec_schema: x.specSchema }))],

  ['GET', '/api/products', async (c) => (await apiFetch(c.t, '/admin/products')).map(productToAdminRow)],
  ['GET', '/api/products/incomplete', (c) => apiFetch(c.t, '/admin/products/incomplete')],
  ['GET', '/api/products/:id', async (c) => {
    const all = await apiFetch(c.t, '/admin/products'); // incluye inactivos (GET /products/:id sólo devuelve activos)
    const p = all.find((x) => String(x.id) === String(c.p.id));
    if (!p) throw new ApiError('Producto no encontrado', 404);
    return productToAdminDetail(p);
  }],
  ['POST', '/api/products', async (c) => {
    const { category_id, brand, name, price } = c.b || {};
    if (!category_id || !brand || !name || !price) throw new ApiError('Faltan campos obligatorios: categoría, marca, nombre y precio', 400);
    const product = await apiFetch(c.t, '/products', json('POST', adminBodyToApiPayload(c.b)));
    return { success: true, id: product.id };
  }],
  ['PUT', '/api/products/:id', async (c) => {
    const product = await apiFetch(c.t, `/products/${enc(c.p.id)}`, json('PUT', adminBodyToApiPayload(c.b || {})));
    return { success: true, id: product.id };
  }],
  ['DELETE', '/api/products/:id', async (c) => {
    const product = await apiFetch(c.t, `/products/${enc(c.p.id)}`, { method: 'DELETE' });
    return { success: true, id: product.id };
  }],
  // Borrar TODO: la API exige ?confirm=yes; acá además hay que escribir la frase exacta.
  ['DELETE', '/api/products', async (c) => {
    if (c.b?.confirm !== 'BORRAR TODO') throw new ApiError('Para borrar todo hay que escribir BORRAR TODO', 400);
    await apiFetch(c.t, '/products/all?confirm=yes', { method: 'DELETE' });
    return { success: true };
  }],

  ['POST', '/api/products/:id/images', (c) => apiFetch(c.t, `/products/${enc(c.p.id)}/images`,
    json('POST', { url: c.b.url, altText: c.b.alt_text, order: Number(c.b.order) || 0 }))],
  ['DELETE', '/api/products/:id/images/:imageId', (c) => apiFetch(c.t, `/products/${enc(c.p.id)}/images/${enc(c.p.imageId)}`, { method: 'DELETE' })],

  ['GET', '/api/orders', (c) => apiFetch(c.t, `/admin/orders${pick(c.q, ['filter', 'q'])}`)],
  ['PATCH', '/api/orders/:id/fulfillment', (c) => apiFetch(c.t, `/admin/orders/${enc(c.p.id)}/fulfillment`, json('PATCH', c.b))],

  ['GET', '/api/customers', (c) => apiFetch(c.t, `/admin/customers${pick(c.q, ['q'])}`)],
  ['GET', '/api/customers/:id', (c) => apiFetch(c.t, `/admin/customers/${enc(c.p.id)}`)],
  ['PATCH', '/api/customers/:id', (c) => apiFetch(c.t, `/admin/customers/${enc(c.p.id)}`, json('PATCH', c.b))],

  ['GET', '/api/contact', (c) => apiFetch(c.t, '/admin/contact')],
  ['PUT', '/api/contact/:id/read', (c) => apiFetch(c.t, `/admin/contact/${enc(c.p.id)}/read`, { method: 'PUT' })],
  ['GET', '/api/rules', (c) => apiFetch(c.t, '/admin/compatibility-rules')],
  ['PUT', '/api/rules/:id', (c) => apiFetch(c.t, `/admin/compatibility-rules/${enc(c.p.id)}`, json('PUT', c.b))],
].map(([method, pattern, handler]) => {
  const names = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
  return { method, re, names, handler };
});

/** Resuelve una ruta del panel ("/api/...") contra la API. Devuelve los datos o lanza ApiError (con .status). */
async function backend(path, options = {}, token = null) {
  const url = new URL(path, location.origin);
  const method = (options.method || 'GET').toUpperCase();
  for (const r of ROUTES) {
    const m = r.method === method && url.pathname.match(r.re);
    if (!m) continue;
    const p = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const b = options.body ? JSON.parse(options.body) : undefined;
    return r.handler({ t: token, p, q: url.searchParams, b });
  }
  throw new ApiError(`Ruta desconocida: ${method} ${url.pathname}`, 404);
}
