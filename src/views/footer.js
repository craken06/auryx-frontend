/* AURYX — Pie de página. Depende de: utils/format.js. */

function renderFooter() {
  return `
  <footer class="mt-16 py-10 border-t" style="border-color:var(--line)">
    <div class="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row justify-between gap-4 text-sm">
      <div class="flex items-center gap-2 sf-display font-bold">${iconTag("sun", 18, "--yellow")} AURYX</div>
      <div class="flex gap-6" style="color:var(--text-dim)">
        <a href="#info" class="sf-nav-link">Información</a>
        <a href="#contact" class="sf-nav-link">Contacto</a>
      </div>
    </div>
  </footer>`;
}
