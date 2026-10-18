/* AURYX: banner de consentimiento de cookies de analítica. Depende de: lib/analytics.js (Analytics).
   app.js lo inserta en #cookie-root (fuera de #app-root) y resuelve los clics de
   data-action="consent-all" / "consent-essential". Sin IDs de analítica, o con la decisión ya
   tomada, devuelve "" y no se muestra nada. */

function cookieBannerHTML() {
  if (typeof Analytics === "undefined" || !Analytics.enabled() || Analytics.consent()) return "";
  return `
  <section class="cookie-banner" role="region" aria-label="Cookies">
    <p class="cookie-text">
      <strong>¿Nos dejás medir cómo se usa el sitio?</strong>
      Usamos cookies de analítica (Google Analytics y Microsoft Clarity) solo si las aceptás. Las necesarias para que el sitio funcione no se pueden desactivar. Más detalle en la <a href="#privacy">Política de privacidad</a>.
    </p>
    <div class="cookie-actions">
      <button type="button" class="btn btn-secondary btn-sm" data-action="consent-essential">Solo necesarias</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="consent-all">Aceptar</button>
    </div>
  </section>`;
}
