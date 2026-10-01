/* AURYX: helpers de UI de las calculadoras (campos, secciones, resultados, geometría del dibujo de ángulo). Depende de: utils/format.js. */

function explainerHTML(text) {
  return `<div class="explainer">${icon("graduation-cap")}<p>${text}</p></div>`;
}

/* Campo con label arriba, unidad en la etiqueta y hint opcional debajo.
   bind = nombre lógico para el delegador de eventos; field = clave del estado. */
function fieldHTML({ id, label, unit, type = "number", value, bind, field, hint, placeholder = "", inputmode, name, autocomplete = "off" }) {
  const im = inputmode || (type === "number" ? "decimal" : "");
  return `<div class="field">
    <label class="field-label" for="${id}">${label}${unit ? ` <span class="unit">(${unit})</span>` : ""}</label>
    <input id="${id}" class="input${type === "number" ? " num-input" : ""}" type="${type}" value="${esc(value)}"
      name="${name || id}" autocomplete="${autocomplete}" ${im ? `inputmode="${im}"` : ""}
      ${placeholder ? `placeholder="${esc(placeholder)}"` : ""}
      ${bind ? `data-bind="${bind}"` : ""} ${field ? `data-field="${field}"` : ""}
      ${hint ? `aria-describedby="${id}-hint"` : ""} />
    ${hint ? `<p id="${id}-hint" class="field-hint">${hint}</p>` : ""}
  </div>`;
}

/* Tarjeta de resultado: un valor principal grande + filas secundarias. */
function resultCardHTML({ id, title = "Resultado", main, rest = [] }) {
  return `<div class="result-card" id="${id}" aria-live="polite">
    <h3>${title}</h3>
    <dl>
      <div class="result-main"><dt>${main.label}</dt><dd id="${main.id}">${main.value}</dd></div>
      ${rest.length ? `<div class="result-rest">${rest.map((r) => `<div><dt>${r.label}</dt><dd id="${r.id}">${r.value}</dd></div>`).join("")}</div>` : ""}
    </dl>
  </div>`;
}

function calcSectionHTML(id, title, subtitle, inputs, result, footnote = "") {
  return `<section id="calc-${id}" class="calc" aria-labelledby="calc-${id}-title">
    <div class="calc-head">
      <h2 id="calc-${id}-title">${title}</h2>
      <p class="muted">${subtitle}</p>
    </div>
    <div class="calc-grid">
      <div class="calc-inputs">${inputs}</div>
      <div class="calc-result">${result}${footnote ? `<p class="xsmall dim" style="margin-top:12px">${footnote}</p>` : ""}</div>
    </div>
  </section>`;
}

/* Geometría del dibujo lateral (perfil). Trigonometría real para que el
   ángulo dibujado sea exacto; se reutiliza en el render inicial y en la
   actualización en vivo del slider. */
function lateralPanelGeometry(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const hinge = { x: 165, y: 140 };
  const Lp = 105; // largo visual del panel
  const far = { x: hinge.x - Lp * Math.cos(rad), y: hinge.y - Lp * Math.sin(rad) };
  const perp = { x: Math.sin(rad), y: -Math.cos(rad) };
  const ticks = [0.28, 0.55, 0.82].map((t) => {
    const base = { x: hinge.x + t * (far.x - hinge.x), y: hinge.y + t * (far.y - hinge.y) };
    return {
      x1: base.x + perp.x * 8, y1: base.y + perp.y * 8,
      x2: base.x - perp.x * 8, y2: base.y - perp.y * 8,
    };
  });
  const strutGround = { x: hinge.x + 32, y: hinge.y };
  const strutAttach = { x: hinge.x + 0.55 * (far.x - hinge.x), y: hinge.y + 0.55 * (far.y - hinge.y) };
  const r = 34;
  const arcStart = { x: hinge.x - r, y: hinge.y };
  const arcEnd = { x: hinge.x - r * Math.cos(rad), y: hinge.y - r * Math.sin(rad) };
  const bisector = rad / 2;
  const label = { x: hinge.x - (r + 20) * Math.cos(bisector), y: hinge.y - (r + 20) * Math.sin(bisector) };
  return { hinge, far, ticks, strutGround, strutAttach, arcStart, arcEnd, label };
}

function lateralTicksHTML(ticks) {
  return ticks.map((t) => `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="var(--bg-raised)" stroke-width="2.5" />`).join("");
}

function lateralSvgHTML(angleDeg) {
  const g = lateralPanelGeometry(angleDeg);
  return `
  <svg id="lateral-svg" viewBox="0 0 240 170" width="100%" height="100%" role="img" aria-label="Vista lateral del panel inclinado ${angleDeg} grados">
    <line x1="15" y1="${g.hinge.y}" x2="225" y2="${g.hinge.y}" stroke="var(--line-strong)" stroke-width="2" />
    <line id="lateral-strut" x1="${g.strutGround.x}" y1="${g.strutGround.y}" x2="${g.strutAttach.x}" y2="${g.strutAttach.y}" stroke="var(--text-dim)" stroke-width="3" stroke-linecap="round" />
    <line id="lateral-panel" x1="${g.hinge.x}" y1="${g.hinge.y}" x2="${g.far.x}" y2="${g.far.y}" stroke="var(--accent)" stroke-width="13" stroke-linecap="round" />
    <g id="lateral-ticks">${lateralTicksHTML(g.ticks)}</g>
    <circle cx="${g.hinge.x}" cy="${g.hinge.y}" r="4" fill="var(--accent-ink)" />
    <path id="lateral-arc" d="M ${g.arcStart.x} ${g.arcStart.y} A 34 34 0 0 1 ${g.arcEnd.x} ${g.arcEnd.y}" fill="none" stroke="var(--text-mid)" stroke-width="1.5" stroke-dasharray="3 3" />
    <text id="lateral-label" x="${g.label.x}" y="${g.label.y}" fill="var(--text)" font-size="12" font-family="'JetBrains Mono Variable', monospace" text-anchor="middle">${angleDeg}°</text>
  </svg>`;
}
