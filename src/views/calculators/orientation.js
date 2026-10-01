/* AURYX — Calculadora de orientación/ángulo (incluye vistas lateral+isométrica). Depende de: utils/format.js, utils/calculatorHelpers.js. */

function renderOrientationCalculator(state) {
  const { lat, hemisphere, previewAngle } = state.calc.orientation;
  const recommendedAngle = Math.round(Math.abs(lat));
  const azimuth = hemisphere === "sur" ? "Norte (0°)" : "Sur (180°)";
  const panelCells = Array(12).fill('<div class="sf-3d-cell"></div>').join("");
  const angle = previewAngle;

  const angleControl = `
    <div class="mb-4">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-sm font-medium">Ángulo a visualizar</span>
        <input id="orient-angle-number" type="number" min="0" max="90" value="${angle}"
          oninput="App.calcOrientationAngleEdit(this.value)" class="sf-input w-20 text-center" />
      </div>
      <input id="orient-angle-slider" type="range" min="0" max="90" value="${angle}"
        oninput="App.calcOrientationAngleEdit(this.value)" class="sf-slider" />
      <button onclick="App.calcOrientationUseRecommended()" class="sf-btn-outline px-3 py-1.5 text-xs mt-2">
        Usar ángulo recomendado (${recommendedAngle}°)
      </button>
    </div>`;

  const scenes = `
    <div class="grid sm:grid-cols-2 gap-4 mb-2">
      <div>
        <p class="text-xs mb-1.5 text-center" style="color:var(--text-dim)">Vista lateral</p>
        <div class="sf-3d-scene">${lateralSvgHTML(angle)}</div>
      </div>
      <div>
        <p class="text-xs mb-1.5 text-center" style="color:var(--text-dim)">Vista isométrica</p>
        <div class="sf-3d-scene">
          <div class="sf-3d-iso-stage">
            <div class="sf-3d-iso-world">
              <div class="sf-3d-iso-ground"></div>
              <div id="panel-3d-iso" class="sf-3d-iso-panel" style="transform: rotateX(${-angle}deg);">
                <div class="sf-3d-panel-face">${panelCells}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const body = `
    ${explainerHTML(`Como regla general y simplificada, el <strong class="sf-mono">ángulo de inclinación óptimo ≈ latitud del lugar</strong> (en valor absoluto), para maximizar la captación de energía a lo largo de todo el año. En el hemisferio sur los paneles se orientan hacia el <strong class="sf-mono">Norte</strong>; en el hemisferio norte, hacia el <strong class="sf-mono">Sur</strong>, porque de ese lado el sol recorre el cielo durante más horas.`)}
    ${angleControl}
    ${scenes}
    <p class="text-xs text-center mb-5" style="color:var(--text-dim)">Vista simplificada del ángulo de inclinación (no a escala).</p>
    ${fieldHTML({ id: "orient-lat", label: "Latitud del lugar", unit: "grados, negativa si es hemisferio sur", type: "number", value: lat, oninput: "App.calcOrientationEdit('lat', this.value)" })}
    <label class="block mb-4">
      <span class="text-sm font-medium block mb-1.5">Hemisferio</span>
      <select onchange="App.calcOrientationEdit('hemisphere', this.value)" class="sf-input w-full">
        <option value="sur" ${hemisphere === "sur" ? "selected" : ""}>Sur (Argentina, Chile, etc.)</option>
        <option value="norte" ${hemisphere === "norte" ? "selected" : ""}>Norte</option>
      </select>
    </label>
    <div id="orientation-result" class="mt-4 p-4 sf-card text-sm space-y-2" style="border-color:var(--line-yellow)">
      ${resultRowHTML("orient-azimuth", "Orientación (azimut) recomendada", azimuth)}
      ${resultRowHTML("orient-angle", "Ángulo de inclinación recomendado", `≈ ${recommendedAngle}°`)}
    </div>
    <p class="text-xs mt-3" style="color:var(--text-dim)">Es una estimación simplificada: un buen punto de partida para autoconsumo anual, pero no reemplaza un análisis con datos de irradiancia real del sitio.</p>`;
  return calcSectionHTML("orientacion", "4. Orientación y ángulo óptimo", "Hacia dónde y con qué inclinación conviene instalar los paneles", body);
}
