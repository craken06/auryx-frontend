/* AURYX: pie de página. Depende de: data/products.js, utils/format.js, config.js (SELLER_*, CONTACT_EMAIL,
   DATA_FISCAL_*), lib/analytics.js (botón "Configurar cookies"). */

const cfgStr = (v) => (typeof v === "string" ? v.trim() : "");

/* Datos del vendedor (Ley 24.240). Lo vacío se omite: nunca se muestran placeholders al público. */
function sellerInfo() {
  return {
    name: cfgStr(typeof SELLER_NAME !== "undefined" && SELLER_NAME),
    cuit: cfgStr(typeof SELLER_CUIT !== "undefined" && SELLER_CUIT),
    address: cfgStr(typeof SELLER_ADDRESS !== "undefined" && SELLER_ADDRESS),
    email: cfgStr(typeof CONTACT_EMAIL !== "undefined" && CONTACT_EMAIL),
  };
}

/* Link al email de contacto (o "" si no hay), ya escapado. */
function contactEmailLinkHTML() {
  const { email } = sellerInfo();
  return email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "";
}

/* Datos del vendedor (solo los cargados), cada uno en su propio <span>, ya escapados. */
function sellerLineHTML() {
  const s = sellerInfo();
  const parts = [];
  if (s.name) parts.push(esc(s.name));
  if (s.cuit) parts.push(`CUIT <span class="mono">${esc(s.cuit)}</span>`);
  if (s.address) parts.push(esc(s.address));
  if (s.email) parts.push(contactEmailLinkHTML());
  return parts.map((part) => `<span>${part}</span>`).join("");
}

/* Cotización usada para convertir USD↔ARS (solo si vino de la API). */
function exchangeNoteText() {
  if (typeof EXCHANGE_INFO === "undefined" || !EXCHANGE_INFO) return "";
  const date = EXCHANGE_INFO.updatedAt ? new Date(EXCHANGE_INFO.updatedAt).toLocaleDateString("es-AR") : "";
  return ` Cotización de referencia: 1 USD = ${fmtARS(EXCHANGE_INFO.rate)}${date ? ` (${date})` : ""}.`;
}

/* Ventanilla Única Federal de reclamos (Res. 274/2021). */
const CONSUMER_COMPLAINTS_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";

/* QR de Data Fiscal (ARCA, F. 960/D): solo si config.js tiene el link que da ARCA. */
function dataFiscalHTML() {
  const url = cfgStr(typeof DATA_FISCAL_URL !== "undefined" && DATA_FISCAL_URL);
  if (!/^https:\/\//i.test(url)) return "";
  const img = cfgStr(typeof DATA_FISCAL_IMG !== "undefined" && DATA_FISCAL_IMG);
  return `<a class="data-fiscal" href="${esc(url)}" target="_blank" rel="noopener">${/^https:\/\//i.test(img)
    ? `<img src="${esc(img)}" alt="Data Fiscal" width="48" height="66" loading="lazy" decoding="async" />` : ""}<span>Data Fiscal</span></a>`;
}

/* Íconos de las redes (config.js); sin ninguna cargada no se dibuja nada. */
function socialLinksHTML() {
  const links = [[INSTAGRAM_URL, "instagram-logo", "Instagram"], [LINKEDIN_URL, "linkedin-logo", "LinkedIn"]].filter(([url]) => url);
  if (!links.length) return "";
  return `<p class="footer-social">${links.map(([url, ic, name]) =>
    `<a href="${esc(url)}" class="icon-btn" target="_blank" rel="noopener me" aria-label="AURYX en ${name} (se abre en una pestaña nueva)" data-context="footer-${name.toLowerCase()}">${icon(ic)}</a>`).join("")}</p>`;
}

function renderFooter() {
  // Solo categorías con productos (si el catálogo todavía no cargó, las cuatro principales)
  const loaded = typeof PRODUCTS !== "undefined" && PRODUCTS.length > 0;
  const cats = ["panel", "inversor", "bateria", "regulador"]
    .filter((k) => CATEGORY_META[k] && (!loaded || PRODUCTS.some((p) => p.category === k)))
    .map((k) => `<a href="#store/${k}">${CATEGORY_META[k].label}</a>`).join("");
  const seller = sellerLineHTML();
  const cookies = typeof Analytics !== "undefined" && Analytics.enabled()
    ? `<button type="button" class="link-btn" data-action="cookie-settings">Configurar cookies</button>` : "";

  return `
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="#" class="wordmark" aria-label="AURYX, ir al inicio" translate="no">AURYX</a>
        <p>Equipos solares para casas y PyMEs en Argentina, con la compatibilidad eléctrica verificada antes de comprar.</p>
        ${socialLinksHTML()}
      </div>
      <div class="footer-nav">
        <nav class="footer-col" aria-labelledby="ft-tienda"><h2 id="ft-tienda">Tienda</h2>${cats}<a href="#store">Ver todo</a></nav>
        <nav class="footer-col" aria-labelledby="ft-herr"><h2 id="ft-herr">Herramientas</h2>
          <a href="#configurator">Diseñá tu sistema</a><a href="#calculators">Calculadoras</a>
        </nav>
        <nav class="footer-col" aria-labelledby="ft-auryx"><h2 id="ft-auryx">Auryx</h2>
          <a href="#info">Información</a><a href="#contact">Contacto</a>
          <a href="${whatsappLink()}" target="_blank" rel="noopener" data-context="footer">WhatsApp<span class="footer-phone">${WHATSAPP_DISPLAY}</span></a>
        </nav>
      </div>
    </div>
    <div class="footer-consumer">
      <a href="#arrepentimiento" class="footer-revocation">${icon("arrow-u-up-left")}Botón de arrepentimiento</a>
      <a href="${CONSUMER_COMPLAINTS_URL}" class="footer-complaints" target="_blank" rel="noopener">Defensa de las y los Consumidores. Para reclamos ingrese aquí</a>
      ${dataFiscalHTML()}
    </div>
    <div class="footer-bottom">
      <div class="footer-legal-row">
        <p class="footer-legal"><a href="#terms">Términos y condiciones</a><a href="#privacy">Política de privacidad</a>${cookies}</p>
        <p class="footer-copy" translate="no">© ${new Date().getFullYear()} AURYX</p>
      </div>
      ${seller ? `<p class="footer-seller">${seller}</p>` : ""}
      <div class="footer-notes">
        <p>Precios finales en ARS y USD, con IVA incluido. Los pagos online se procesan con Mercado Pago.${exchangeNoteText()}</p>
        <p>Las verificaciones y calculadoras son orientativas y no reemplazan el proyecto de un profesional matriculado.</p>
      </div>
    </div>
  </div>`;
}
