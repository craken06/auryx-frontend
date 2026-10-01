/* AURYX: calculadora de orientación y ángulo (vistas lateral + isométrica). Depende de: utils/format.js, utils/calculatorHelpers.js. */

function orientationTotals({ lat, hemisphere }) {
  return {
    angle: Math.round(Math.abs(lat)),
    azimuth: hemisphere === "sur" ? "Norte (0°)" : "Sur (180°)",
  };
}

function renderOrientationCalculator(state) {
  const o = state.calc.orientation;
  const { angle: recommended, azimuth } = orientationTotals(o);
  const angle = o.previewAngle;
  const cells = "<span></span>".repeat(12);

  const inputs = `
    ${explainerHTML(`Como regla simplificada, el <strong class="mono">ángulo de inclinación óptimo ≈ latitud del lugar</strong> (en valor absoluto) maximiza la energía anual. En el hemisferio sur los paneles miran al <strong>Norte</strong>; en el norte, al <strong>Sur</strong>, porque de ese lado recorre el sol.`)}
    ${fieldHTML({ id: "orient-lat", label: "Latitud del lugar", unit: "grados", value: o.lat, bind: "orient", field: "lat", hint: "Negativa en el hemisferio sur. Buenos Aires es aproximadamente -34,6.", inputmode: "text" })}
    <div class="field">
      <label class="field-label" for="orient-hemisphere">Hemisferio</label>
      <select id="orient-hemisphere" class="select" name="hemisphere" data-bind="orient" data-field="hemisphere">
        <option value="sur" ${o.hemisphere === "sur" ? "selected" : ""}>Sur (Argentina, Chile, Uruguay…)</option>
        <option value="norte" ${o.hemisphere === "norte" ? "selected" : ""}>Norte</option>
      </select>
    </div>
    <div class="field">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <label class="field-label" for="orient-angle-slider">Ángulo a visualizar</label>
        <input id="orient-angle-number" class="input num-input" style="width:84px;text-align:center" type="number" inputmode="numeric"
          min="0" max="90" value="${angle}" name="angle-number" autocomplete="off" aria-label="Ángulo a visualizar, en grados" data-bind="orient-angle" />
      </div>
      <input id="orient-angle-slider" class="slider" type="range" min="0" max="90" value="${angle}" name="angle" data-bind="orient-angle" />
      <div><button type="button" class="btn btn-secondary btn-sm" data-action="orient-use-recommended" id="orient-use-btn">Usar ángulo recomendado (${recommended}°)</button></div>
    </div>
    <div class="angle-scenes">
      <div class="scene"><span class="scene-label">Vista lateral</span>${lateralSvgHTML(angle)}</div>
      <div class="scene" role="img" aria-label="Vista isométrica del panel inclinado">
        <span class="scene-label">Vista isométrica</span>
        <div class="iso-stage"><div class="iso-world">
          <div class="iso-ground"></div>
          <div id="panel-3d-iso" class="iso-panel" style="transform: rotateX(${-angle}deg)"><div class="iso-face">${cells}</div></div>
        </div></div>
      </div>
    </div>
    <p class="xsmall dim">Representación simplificada, no a escala.</p>`;

  const result = resultCardHTML({
    id: "orientation-result",
    title: "Recomendación",
    main: { id: "orient-angle", label: "Inclinación recomendada", value: `≈ ${recommended}°` },
    rest: [{ id: "orient-azimuth", label: "Orientación (azimut)", value: azimuth }],
  });
  return calcSectionHTML("orientacion", "Orientación y ángulo óptimo", "Hacia dónde y con qué inclinación conviene instalar los paneles.", inputs, result,
    "Es un punto de partida para autoconsumo anual. No reemplaza un análisis con datos de irradiancia del sitio.");
}
