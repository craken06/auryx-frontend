/* AURYX: pie de página. Depende de: data/products.js, utils/format.js. */

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
      </nav>
    </div>
    <p class="footer-base">Precios de referencia sujetos a confirmación en la cotización.</p>
  </div>`;
}
