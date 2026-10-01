/* AURYX — Helpers de UI reutilizados por las calculadoras (campos, secciones, geometría del dibujo de ángulo). Depende de: utils/format.js (iconTag). */

function explainerHTML(text) {
  return `<div class="sf-explainer p-4 text-sm mb-6">${iconTag("graduation-cap", 18, "--yellow")}<p>${text}</p></div>`;
}
function fieldHTML({ id, label, unit, type = "text", value, oninput, placeholder = "" }) {
  return `<label class="block mb-4">
    <span class="text-sm font-medium block mb-1.5">${label} ${unit ? `<span class="sf-mono" style="color:var(--text-dim)">(${unit})</span>` : ""}</span>
    <input id="${id}" type="${type}" value="${value}" placeholder="${placeholder}" oninput="${oninput}" class="sf-input w-full" />
  </label>`;
}
function resultRowHTML(id, label, value) {
  return `<div class="flex justify-between"><span style="color:var(--text-mid)">${label}</span><strong id="${id}" class="sf-mono" style="color:var(--yellow)">${value}</strong></div>`;
}
function calcSectionHTML(id, title, subtitle, body) {
  return `<section id="${id}" class="py-16 border-b" style="border-color:var(--line)">
    <h2 class="sf-display text-2xl font-semibold mb-1">${title}</h2>
    <p class="text-sm mb-6" style="color:var(--text-dim)">${subtitle}</p>
    ${body}
  </section>`;
}


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
  return ticks.map((t) => `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="var(--bg)" stroke-width="2.5" />`).join("");
}

function lateralSvgHTML(angleDeg) {
  const g = lateralPanelGeometry(angleDeg);
  return `
  <svg id="lateral-svg" viewBox="0 0 240 170" width="100%" height="100%">
    <line x1="15" y1="${g.hinge.y}" x2="225" y2="${g.hinge.y}" stroke="var(--line)" stroke-width="2" />
    <line id="lateral-strut" x1="${g.strutGround.x}" y1="${g.strutGround.y}" x2="${g.strutAttach.x}" y2="${g.strutAttach.y}" stroke="var(--text-dim)" stroke-width="3" stroke-linecap="round" />
    <line id="lateral-panel" x1="${g.hinge.x}" y1="${g.hinge.y}" x2="${g.far.x}" y2="${g.far.y}" stroke="var(--yellow)" stroke-width="13" stroke-linecap="round" />
    <g id="lateral-ticks">${lateralTicksHTML(g.ticks)}</g>
    <circle cx="${g.hinge.x}" cy="${g.hinge.y}" r="4" fill="var(--yellow-deep)" />
    <path id="lateral-arc" d="M ${g.arcStart.x} ${g.arcStart.y} A 34 34 0 0 1 ${g.arcEnd.x} ${g.arcEnd.y}" fill="none" stroke="var(--text-mid)" stroke-width="1.5" stroke-dasharray="3 3" />
    <text id="lateral-label" x="${g.label.x}" y="${g.label.y}" fill="var(--white)" font-size="12" font-family="'IBM Plex Mono', monospace" text-anchor="middle">${angleDeg}°</text>
  </svg>`;
}

