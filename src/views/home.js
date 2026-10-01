/* AURYX — Página de inicio. Depende de: data/products.js, utils/format.js. */

/* ---------------------------------------------------------------------- */
/* HOME                                                                    */
/* ---------------------------------------------------------------------- */
function renderHome() {
  const features = [
    { icon: "sparkles", title: "Sin necesitar conocimientos técnicos", text: "La plataforma explica cada resultado en lenguaje simple, sin dejar de mostrar los datos técnicos reales." },
    { icon: "shield-check", title: "Compatibilidad verificada", text: "Cada combinación se evalúa contra potencia, tensión y corriente reales de fabricante, no filtros genéricos." },
    { icon: "calculator", title: "Calculadoras de acceso libre", text: "Consumo, costo, ahorro y orientación óptima, con explicación técnica pensada para estudiantes." },
  ].map((f) => `
    <div>
      ${iconTag(f.icon, 22, "--yellow")}
      <h3 class="sf-display font-semibold mb-2 mt-3">${f.title}</h3>
      <p class="text-sm" style="color:var(--text-mid)">${f.text}</p>
    </div>`).join("");

  const systemCards = SYSTEM_TYPES.map((s) => `
    <div class="sf-card p-5">
      ${iconTag(s.icon, 20, "--yellow")}
      <h3 class="font-semibold mb-1 mt-3 sf-display">${s.name}</h3>
      <p class="text-sm" style="color:var(--text-mid)">${s.desc}</p>
    </div>`).join("");

  return `
  <div>
    <section class="sf-cellgrid">
      <div class="max-w-6xl mx-auto px-5 py-24 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p class="sf-mono text-xs mb-4" style="color:var(--yellow)">ENERGÍA SOLAR · ARGENTINA</p>
          <h1 class="sf-display text-4xl md:text-5xl leading-tight font-semibold mb-5">
            Armá tu propio sistema fotovoltaico, componente por componente.
          </h1>
          <p class="text-base mb-8" style="color:var(--text-mid)">
            Elegí panel, inversor y batería como armarías una PC: la plataforma verifica automáticamente
            qué combinaciones son eléctricamente compatibles y te muestra el sistema completo, con precio y características, antes de comprar.
          </p>
          <div class="flex flex-wrap gap-3">
            <a href="#configurator" class="sf-btn-primary px-6 py-3 inline-flex items-center gap-2">Diseñar mi sistema ${iconTag("arrow-right", 16)}</a>
            <a href="#store" class="sf-btn-outline px-6 py-3 inline-block">Ver productos</a>
          </div>
        </div>
        <div class="sf-card p-6">
          <p class="sf-mono text-xs mb-3" style="color:var(--text-dim)">EJEMPLO DE VERIFICACIÓN</p>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between items-center border-b pb-2" style="border-color:var(--line)">
              <span>2× Jinko Tiger Neo 575W</span><span class="sf-mono" style="color:var(--text-mid)">104.6V / 13.9A</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2" style="border-color:var(--line)">
              <span>Growatt MIN 5000TL-XH</span>${statusBadgeHTML("ok")}
            </div>
            <div class="flex justify-between items-center"><span>Pylontech US3000C 48V</span>${statusBadgeHTML("ok")}</div>
          </div>
        </div>
      </div>
    </section>
    <section class="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-3 gap-8">${features}</section>
    <section class="max-w-6xl mx-auto px-5 pb-20">
      <h2 class="sf-display text-2xl font-semibold mb-6">Cómo funciona el configurador</h2>
      <div class="grid md:grid-cols-3 gap-4">${systemCards}</div>
    </section>
  </div>`;
}
