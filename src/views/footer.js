/* AURYX: pie de página. Depende de: utils/format.js, config.js (SELLER_*, CONTACT_EMAIL, DATA_FISCAL_*,
   INSTAGRAM_URL), lib/analytics.js (botón "Configurar cookies"). */

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

/* Instagram (config.js) con los colores de su marca; sin URL no se dibuja. LinkedIn queda solo en los
   datos para buscadores (sameAs), no en el pie. */
function instagramLinkHTML() {
  if (!INSTAGRAM_URL) return "";
  return `<a href="${esc(INSTAGRAM_URL)}" class="footer-ig" target="_blank" rel="noopener me" aria-label="AURYX en Instagram (se abre en una pestaña nueva)" data-context="footer-instagram">${icon("instagram-logo")}</a>`;
}

function renderFooter() {
  const seller = sellerLineHTML();
  const cookies = typeof Analytics !== "undefined" && Analytics.enabled()
    ? `<button type="button" class="link-btn" data-action="cookie-settings">Configurar cookies</button>` : "";

  return `
  <div class="wrap">
    <div class="footer-consumer">
      <a href="#arrepentimiento" class="footer-revocation">${icon("arrow-u-up-left")}Botón de arrepentimiento</a>
      <a href="${CONSUMER_COMPLAINTS_URL}" class="footer-complaints" target="_blank" rel="noopener">Defensa de las y los Consumidores. Para reclamos ingrese aquí</a>
      ${dataFiscalHTML()}
      ${instagramLinkHTML()}
    </div>
    <div class="footer-bottom">
      <div class="footer-legal-row">
        <p class="footer-legal"><a href="#guides">Guías</a><a href="#installers">Para instaladores</a><a href="#terms">Términos y condiciones</a><a href="#privacy">Política de privacidad</a>${cookies}</p>
        <p class="footer-copy" translate="no"><a href="#" class="wordmark" aria-label="AURYX, ir al inicio">AURYX</a><span>© ${new Date().getFullYear()}</span></p>
      </div>
      ${seller ? `<p class="footer-seller">${seller}</p>` : ""}
      <div class="footer-notes">
        <p>Precios finales en ARS y USD, con IVA incluido. Los pagos online se procesan con Mercado Pago.${exchangeNoteText()}</p>
        <p>Las verificaciones y calculadoras son orientativas y no reemplazan el proyecto de un profesional matriculado.</p>
      </div>
    </div>
  </div>`;
}
