/* AURYX — Páginas de Información y Contacto. Depende de: utils/format.js, utils/calculatorHelpers.js. */

/* ---------------------------------------------------------------------- */
/* INFO / CONTACTO                                                          */
/* ---------------------------------------------------------------------- */
function renderInfo() {
  return `
  <div class="max-w-3xl mx-auto px-5 py-16">
    <h1 class="sf-display text-3xl font-semibold mb-6">Información</h1>
    <div class="space-y-5 text-sm" style="color:var(--text-mid)">
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
      <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
      <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.</p>
    </div>
  </div>`;
}

function renderContact() {
  return `
  <div class="max-w-2xl mx-auto px-5 py-16">
    <h1 class="sf-display text-3xl font-semibold mb-6">Contacto</h1>
    <div class="sf-card p-6 space-y-1">
      ${fieldHTML({ id: "contact-name", label: "Nombre", value: "", oninput: "", placeholder: "Tu nombre" })}
      ${fieldHTML({ id: "contact-email", label: "Email", value: "", oninput: "", placeholder: "tu@email.com" })}
      <label class="block mb-4">
        <span class="text-sm font-medium block mb-1.5">Mensaje</span>
        <textarea class="sf-input w-full" rows="4" placeholder="Contanos qué necesitás"></textarea>
      </label>
      <button class="sf-btn-primary px-5 py-2.5 w-full">Enviar</button>
    </div>
    <div class="mt-6 flex items-center gap-2 text-sm" style="color:var(--text-mid)">${iconTag("map-pin", 15)} Buenos Aires, Argentina</div>
  </div>`;
}
