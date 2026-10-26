/* AURYX: calculadora de orientación y ángulo (vistas lateral + isométrica). Depende de: utils/format.js, utils/calculatorHelpers.js. */

/* El hemisferio sale del signo de la latitud (negativa = sur). */
function orientationTotals({ lat }) {
  return {
    angle: Math.max(10, Math.round(Math.abs(lat))), // cerca del ecuador, mínimo 10° para que la lluvia limpie
    azimuth: lat < 0 ? "Norte (0°)" : "Sur (180°)",
  };
}

/* Pérdida de energía anual (%) por alejarse de la inclinación óptima, para más o para menos. Muy aproximada:
   interpola entre valores típicos de PVGIS/PVWatts (10° ≈ 1,5 %, 20° ≈ 5 %, 30° ≈ 10 %) y sigue la curva
   hasta el panel vertical. Ignora que en el sitio real perder 20° para arriba no es igual que para abajo. */
const TILT_LOSS_POINTS = [[0, 0], [10, 1.5], [20, 5], [30, 10], [45, 20], [60, 33], [90, 60]];
function tiltLossPct(angle, recommended) {
  const d = Math.min(90, Math.abs(angle - recommended));
  const i = TILT_LOSS_POINTS.findIndex(([x]) => d <= x);
  if (i <= 0) return 0;
  const [x0, y0] = TILT_LOSS_POINTS[i - 1], [x1, y1] = TILT_LOSS_POINTS[i];
  return y0 + ((d - x0) * (y1 - y0)) / (x1 - x0);
}

/* Filas del modo manual: la óptima de referencia, el desvío y la pérdida. */
function orientationDeviation(angle, recommended) {
  const diff = angle - recommended;
  const loss = Math.round(tiltLossPct(angle, recommended)); // redondeada antes, así pérdida + energía suman 100
  return {
    diff: diff === 0 ? "0° (la óptima)" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)}° ${diff > 0 ? "más parado" : "más acostado"}`,
    loss: diff === 0 ? "Ninguna" : loss < 1 ? "Menos de 1 %" : `≈ ${loss} %`,
    yield: `≈ ${100 - loss} %`,
  };
}

function renderOrientationCalculator(state) {
  const o = state.calc.orientation;
  const optimal = o.mode === "optimal";
  const { angle: recommended, azimuth } = orientationTotals(o);
  const angle = optimal ? recommended : o.previewAngle;
  const dev = orientationDeviation(angle, recommended);
  const cells = "<span></span>".repeat(12);

  const latField = fieldHTML({ id: "orient-lat", label: "Tu ubicación: latitud", unit: "grados", value: String(o.lat).replace(".", ","), type: "text", inputmode: "decimal", bind: "orient", field: "lat", hint: "Negativa en el hemisferio sur, entre -90 y 90. Buenos Aires es aproximadamente -34,6." });

  const modeToggle = `
    <div class="chip-list" role="group" aria-label="Modo de cálculo">
      <button type="button" class="chip" data-action="orient-mode" data-mode="optimal" aria-pressed="${optimal}">Inclinación óptima</button>
      <button type="button" class="chip" data-action="orient-mode" data-mode="manual" aria-pressed="${!optimal}">Manual</button>
    </div>`;

  const optimalControls = `
    ${explainerHTML(`Como regla simplificada, el <strong class="mono">ángulo de inclinación óptimo ≈ latitud del lugar</strong> (en valor absoluto) maximiza la energía anual. En el hemisferio sur los paneles miran al <strong>Norte</strong>; en el norte, al <strong>Sur</strong>, porque de ese lado recorre el sol.`)}
    ${latField}
    <div><button type="button" class="btn btn-secondary btn-sm" data-action="orient-geolocate" id="orient-geo-btn">${icon("compass")} Usar mi ubicación</button>
      <span id="orient-geo-status" class="xsmall dim" role="status"></span></div>`;

  const manualControls = `
    ${explainerHTML(`Movés el panel con el control deslizante para ver cómo cambia la inclinación. El ángulo se mide desde la horizontal: 0° es el panel acostado y 90° es vertical. Cuanto más te alejás de la inclinación óptima, para arriba o para abajo, más energía perdés en el año: <strong>unos 10° cambian poco (≈ 1,5 %), 30° ya son ≈ 10 %</strong>.`)}
    ${latField}
    <div class="field">
      <div class="field-inline">
        <label class="field-label" for="orient-angle-slider">Ángulo del panel</label>
        <input id="orient-angle-number" class="input num-input angle-input" type="number" inputmode="numeric"
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
    rest: optimal ? [{ id: "orient-azimuth", label: "Orientación (azimut)", value: azimuth }] : [
      { id: "orient-optimal", label: "Inclinación óptima para tu latitud", value: `≈ ${recommended}°` },
      { id: "orient-diff", label: "Desvío", value: dev.diff },
      { id: "orient-loss", label: "Pérdida estimada por inclinación", value: dev.loss },
      { id: "orient-yield", label: "Energía anual respecto de la óptima", value: dev.yield },
    ],
  });
  return calcSectionHTML("orientacion", inputs, result,
    optimal ? "Es un punto de partida para autoconsumo anual. No reemplaza un análisis con datos de irradiancia del sitio."
      : "La pérdida es una aproximación con valores típicos (PVGIS y PVWatts), igual para arriba que para abajo. Sirve para darte una idea; el valor real depende del sitio y de cuánto sol directo y difuso recibe.");
}
