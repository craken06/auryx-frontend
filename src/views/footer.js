/* AURYX: pie de página. Depende de: data/products.js, utils/format.js. */

/* Cotización usada para convertir USD↔ARS (solo si vino de la API). */
function exchangeNoteText() {
  if (typeof EXCHANGE_INFO === "undefined" || !EXCHANGE_INFO) return "";
  const date = EXCHANGE_INFO.updatedAt ? new Date(EXCHANGE_INFO.updatedAt).toLocaleDateString("es-AR") : "";
  return ` Cotización de referencia: 1 USD = ${fmtARS(EXCHANGE_INFO.rate)}${date ? ` (${date})` : ""}.`;
}

function renderFooter() {
  const cats = ["panel", "inversor", "bateria", "regulador"]
    .filter((k) => CATEGORY_META[k])
    .map((k) => `<a href="#store/${k}">${CATEGORY_META[k].label}</a>`).join("");

  return `
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a href="#" class="wordmark" aria-label="AURYX, ir al inicio" translate="no">AURYX</a>
        <p>Sistemas fotovoltaicos para casas y PyMEs en Argentina. Componentes con datos de fabricante y compatibilidad verificada.</p>
      </div>
      <nav class="footer-col" aria-labelledby="ft-tienda"><h2 id="ft-tienda">Tienda</h2>${cats}<a href="#store">Ver todo</a></nav>
      <nav class="footer-col" aria-labelledby="ft-herr"><h2 id="ft-herr">Herramientas</h2>
        <a href="#configurator">Diseñá tu sistema</a><a href="#calculators">Calculadoras</a>
      </nav>
      <nav class="footer-col" aria-labelledby="ft-auryx"><h2 id="ft-auryx">Auryx</h2>
        <a href="#info">Información</a><a href="#contact">Contacto</a>
        <a href="${whatsappLink()}" target="_blank" rel="noopener">WhatsApp ${WHATSAPP_DISPLAY}</a>
      </nav>
    </div>
    <div class="footer-base">
      <p>Precios de referencia en ARS y USD, con IVA incluido, sujetos a confirmación de stock y condiciones en la cotización.${exchangeNoteText()}</p>
      <p><strong>Aviso técnico:</strong> las verificaciones y calculadoras son orientativas y no reemplazan el proyecto de un profesional matriculado.</p>
      <p class="footer-legal"><a href="#terms">Términos y condiciones</a><a href="#privacy">Política de privacidad</a></p>
    </div>
  </div>`;
}
