/* AURYX: calculadora de orientación y ángulo (vistas lateral + isométrica). Depende de: utils/format.js, utils/calculatorHelpers.js. */

/* El hemisferio sale del signo de la latitud (negativa = sur). */
function orientationTotals({ lat }) {
  return {
    angle: Math.round(Math.abs(lat)),
    azimuth: lat < 0 ? "Norte (0°)" : "Sur (180°)",
  };
}

function renderOrientationCalculator(state) {
  const o = state.calc.orientation;
  const optimal = o.mode === "optimal";
  const { angle: recommended, azimuth } = orientationTotals(o);
  const angle = optimal ? recommended : o.previewAngle;
  const cells = "<span></span>".repeat(12);

  const modeToggle = `
    <div class="chip-list" role="group" aria-label="Modo de cálculo">
      <button type="button" class="chip" data-action="orient-mode" data-mode="optimal" aria-pressed="${optimal}">Inclinación óptima</button>
      <button type="button" class="chip" data-action="orient-mode" data-mode="manual" aria-pressed="${!optimal}">Manual</button>
    </div>`;

  const optimalControls = `
    ${explainerHTML(`Como regla simplificada, el <strong class="mono">ángulo de inclinación óptimo ≈ latitud del lugar</strong> (en valor absoluto) maximiza la energía anual. En el hemisferio sur los paneles miran al <strong>Norte</strong>; en el norte, al <strong>Sur</strong>, porque de ese lado recorre el sol.`)}
    ${fieldHTML({ id: "orient-lat", label: "Tu ubicación: latitud", unit: "grados", value: o.lat, bind: "orient", field: "lat", hint: "Negativa en el hemisferio sur. Buenos Aires es aproximadamente -34,6.", inputmode: "text" })}
    <div><button type="button" class="btn btn-secondary btn-sm" data-action="orient-geolocate" id="orient-geo-btn">${icon("compass")} Usar mi ubicación</button>
      <span id="orient-geo-status" class="xsmall dim" role="status"></span></div>`;

  const manualControls = `
    ${explainerHTML(`Movés el panel con el control deslizante para ver cómo cambia la inclinación. El ángulo se mide desde la horizontal: 0° es el panel acostado y 90° es vertical.`)}
    <div class="field">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <label class="field-label" for="orient-angle-slider">Ángulo del panel</label>
        <input id="orient-angle-number" class="input num-input" style="width:84px;text-align:center" type="number" inputmode="numeric"
          min="0" max="90" value="${angle}" name="angle-number" autocomplete="off" aria-label="Ángulo del panel, en grados" data-bind="orient-angle" />
      </div>
      <input id="orient-angle-slider" class="slider" type="range" min="0" max="90" value="${angle}" name="angle" data-bind="orient-angle" />
    </div>`;

  const inputs = `
    ${modeToggle}
    ${optimal ? optimalControls : manualControls}
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
    title: optimal ? "Recomendación" : "Tu ángulo",
    main: { id: "orient-angle", label: optimal ? "Inclinación recomendada" : "Inclinación elegida", value: `≈ ${angle}°` },
    rest: optimal ? [{ id: "orient-azimuth", label: "Orientación (azimut)", value: azimuth }] : [],
  });
  return calcSectionHTML("orientacion", "Orientación y ángulo óptimo", "Hacia dónde y con qué inclinación conviene instalar los paneles.", inputs, result,
    "Es un punto de partida para autoconsumo anual. No reemplaza un análisis con datos de irradiancia del sitio.");
}
