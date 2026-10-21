/* AURYX: "Compartir mi resultado" y "Mandame este sistema por WhatsApp" en las calculadoras y el dimensionador.
   Cada herramienta pasa sus datos a la dirección (?consumo=300&provincia=cordoba…) y los lee de vuelta al abrir
   el link. Lo que llega en la dirección lo escribió cualquiera: solo se aceptan los parámetros de la lista, los
   números se recortan a un rango razonable, los ids tienen que existir y los textos pierden < > y comillas
   (además, todo se escapa al dibujar). Un valor inválido se descarta y queda el que había.
   Depende de: data/tariffs.js, views/calculators/*.js, views/sizer.js, lib/routes.js, utils/format.js. */

/* "350,5" → 350.5; vacío, texto, NaN o Infinity → null. */
function shareNum(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const shareClamp = (n, min, max) => Math.min(max, Math.max(min, n));
const shareRound = (n) => Math.round(n * 100) / 100;
/* Número del parámetro dentro del rango, o null si no vino o no es un número. */
function shareRange(params, key, min, max, { int = false } = {}) {
  const n = shareNum(params.get(key));
  if (n === null) return null;
  const v = shareClamp(n, min, max);
  return int ? Math.round(v) : shareRound(v);
}
/* Texto libre (nombre de un equipo): sin caracteres de control, < > comillas ni los separadores del link. */
const shareText = (v, max = 40) => String(v ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f<>"'`|~]/g, " ")
  .replace(/\s+/g, " ").trim().slice(0, max);
/* Valor de una lista cerrada (comparación exacta: "__proto__" o "constructor" no son opciones). */
const sharePick = (v, options) => (v !== null && options.includes(v) ? v : null);
const shareQuery = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "")).toString();
const shareHas = (params, keys) => keys.some((k) => params.has(k));

const SHARE_MAX_ITEMS = 20;
const SHARE_ID = /^[a-z0-9-]{1,40}$/i; // ids de equipos del catálogo ("db-11") o "auto"

/* Campos del dimensionador: parámetro del link → [campo, rango o lista, solo en el personalizado]. */
const SHARE_SIZER_FIELDS = [
  ["consumo", "cons", [1, 100000]],
  ["ubicacion", "hsp", () => SIZER_LOCATIONS.map((l) => l.value)],
  ["objetivo", "goal", () => SIZER_GOALS.map((g) => g.id)],
  ["ahorro", "save", [10, 100]],
  ["horas", "hours", [1, 72]],
  ["dias", "days", [1, 10]],
  ["fase", "phase", () => ["mono", "tri"], true],
  ["criticas", "crit", [0.1, 100], true],
  ["superficie", "area", [0, 100000], true],
  ["techo", "est", () => SIZER_STRUCTURES.map((e) => e.id), true],
  ["orientacion", "ori", () => SIZER_ORIENTATIONS.map((o) => o.value), true],
  ["tmin", "tmin", [-30, 20], true],
  ["tmax", "tmax", [20, 55], true],
  ["panel", "pan", "id", true],
  ["inversor", "inv", "id", true],
  ["bateria", "bat", "id", true],
];

const SHARE_ASK = "¿Me mandan un sistema solar para esto?";

const SHARE_TOOLS = {
  consumo: {
    label: "calculadora de consumo",
    parse(params, st) {
      if (!params.has("e")) return false;
      st.calc.consumption = String(params.get("e")).split("|").slice(0, SHARE_MAX_ITEMS).map((row) => {
        const [name, power, qty, hours] = row.split("~");
        const n = (v, min, max, def) => { const x = shareNum(v); return x === null ? def : shareClamp(x, min, max); };
        return {
          name: shareText(name),
          power: shareRound(n(power, 0, 100000, 0)),
          qty: Math.round(n(qty, 0, 100, 1)),
          hours: shareRound(n(hours, 0, 24, 0)),
        };
      });
      return true;
    },
    build: (s) => shareQuery({ e: s.calc.consumption.slice(0, SHARE_MAX_ITEMS).map((it) => [shareText(it.name), it.power, it.qty, it.hours].join("~")).join("|") }),
    summary(s) {
      const items = s.calc.consumption.slice(0, SHARE_MAX_ITEMS);
      const t = consumptionTotals(items);
      const list = items.map((it, i) => `- ${shareText(it.name) || `Equipo ${i + 1}`}: ${fmtNum(it.power)} W × ${fmtNum(it.qty)}, ${fmtNum(it.hours, it.hours % 1 ? 1 : 0)} h por día`).join("\n");
      return `Hola, usé la calculadora de consumo de Auryx.\n\nMis equipos:\n${list || "- (sin equipos)"}\n\nConsumo: ${t.monthly} por mes (${t.daily} por día).\n\n${SHARE_ASK}`;
    },
  },

  costo: {
    label: "calculadora de costo de la luz",
    parse(params, st) {
      if (!shareHas(params, ["consumo", "provincia", "distribuidora"])) return false;
      const c = st.calc.cost;
      const kwh = shareRange(params, "consumo", 0, 10000);
      if (kwh !== null) c.kwh = kwh;
      const prov = sharePick(params.get("provincia"), TARIFF_PROVINCES.map((p) => p.id));
      if (prov) c.province = prov;
      const dists = costProvince(c.province).dists;
      c.dist = sharePick(params.get("distribuidora"), dists) || (dists.includes(c.dist) && !params.has("distribuidora") ? c.dist : dists[0]);
      return true;
    },
    build: (s) => shareQuery({ consumo: s.calc.cost.kwh, provincia: costProvince(s.calc.cost.province).id, distribuidora: costDistId(s.calc.cost) }),
    summary(s) {
      const c = s.calc.cost;
      const t = costTotals(c);
      return `Hola, usé la calculadora de costo de la luz de Auryx.\n\n- Consumo: ${fmtNum(c.kwh)} kWh por mes\n- ${costProvince(c.province).name}, ${t.dist.name}\n- Factura estimada: ${fmtARS(t.bill)} por mes, con impuestos (${fmtARS(t.perKwh)} por kWh)\n\n${SHARE_ASK}`;
    },
  },

  ahorro: {
    label: "calculadora de ahorro",
    parse(params, st) {
      if (!shareHas(params, ["consumo", "solar", "precio"])) return false;
      const sv = st.calc.savings;
      [["consumo", "currentKwh"], ["solar", "solarKwh"], ["precio", "energyPrice"]].forEach(([key, field]) => {
        const v = shareRange(params, key, 0, 10000);
        if (v !== null) sv[field] = v;
      });
      return true;
    },
    build: (s) => shareQuery({ consumo: s.calc.savings.currentKwh, solar: s.calc.savings.solarKwh, precio: s.calc.savings.energyPrice }),
    summary(s) {
      const sv = s.calc.savings;
      const t = savingsTotals(sv);
      return `Hola, usé la calculadora de ahorro de Auryx.\n\n- Consumo: ${fmtNum(sv.currentKwh)} kWh por mes\n- Producción solar: ${fmtNum(sv.solarKwh)} kWh por mes\n- Precio del kWh: ${fmtARS(sv.energyPrice)}\n- Ahorro: ${t.monthly} por mes (${t.yearly} por año), ${t.pct} del consumo cubierto\n\n${SHARE_ASK}`;
    },
  },

  orientacion: {
    label: "calculadora de orientación",
    parse(params, st) {
      if (!shareHas(params, ["lat", "modo", "angulo"])) return false;
      const o = st.calc.orientation;
      const lat = shareRange(params, "lat", -90, 90);
      if (lat !== null) o.lat = lat;
      const mode = sharePick(params.get("modo"), ["optima", "manual"]);
      if (mode) o.mode = mode === "manual" ? "manual" : "optimal";
      const angle = shareRange(params, "angulo", 0, 90, { int: true });
      if (angle !== null) o.previewAngle = angle;
      return true;
    },
    build: (s) => {
      const o = s.calc.orientation;
      return shareQuery({ lat: o.lat, ...(o.mode === "manual" ? { modo: "manual", angulo: o.previewAngle } : {}) });
    },
    summary(s) {
      const o = s.calc.orientation;
      const t = orientationTotals(o);
      const angle = o.mode === "manual" ? `${o.previewAngle}° (elegida a mano; la recomendada es ${t.angle}°)` : `${t.angle}°`;
      return `Hola, usé la calculadora de orientación de Auryx.\n\n- Latitud: ${fmtNum(o.lat, 2)}\n- Inclinación: ${angle}\n- Orientación: ${t.azimuth}\n\n${SHARE_ASK}`;
    },
  },

  dimensionador: {
    label: "dimensionador",
    parse(params, st) {
      if (!shareHas(params, SHARE_SIZER_FIELDS.map(([key]) => key))) return false;
      const sz = st.sizer;
      if (params.has("modo")) sz.mode = params.get("modo") === "personalizado" ? "custom" : "quick";
      const target = sz[sz.mode];
      SHARE_SIZER_FIELDS.forEach(([key, field, rule, customOnly]) => {
        if (!params.has(key) || (customOnly && sz.mode !== "custom")) return;
        const raw = params.get(key);
        let v = null;
        if (rule === "id") v = raw === "auto" || SHARE_ID.test(raw) ? raw : "auto";
        else if (typeof rule === "function") v = sharePick(raw, rule());
        else { const n = shareRange(params, key, rule[0], rule[1]); v = n === null ? null : String(n); }
        if (v !== null) target[field] = v;
      });
      return true;
    },
    build(s) {
      const sz = s.sizer;
      const st = sz[sz.mode];
      const goalField = { red: "ahorro", resp: "horas", aut: "dias" }[st.goal];
      const q = sz.mode === "custom" ? { modo: "personalizado" } : {};
      SHARE_SIZER_FIELDS.forEach(([key, field, , customOnly]) => {
        if (customOnly && sz.mode !== "custom") return;
        if (["ahorro", "horas", "dias"].includes(key) && key !== goalField) return;
        if (key === "criticas" && st.goal === "red") return;
        q[key] = st[field];
      });
      return shareQuery(q);
    },
    summary(s) {
      const kind = s.sizer.mode;
      const st = s.sizer[kind];
      const r = sizerResult(kind, st);
      if (r.empty) return `Hola, estoy armando un sistema con el dimensionador de Auryx.\n\nMis datos:\n${sizerInputsSummary(kind, st)}\n\n¿Me ayudan a armarlo?`;
      return sizerQuoteMessage(kind, st, r, s.currency || "ARS");
    },
  },
};

/* Link completo al resultado. */
function shareUrl(tool, state) {
  const base = routeToPath(tool === "dimensionador" ? "configurator" : `calculators/${tool}`);
  const q = SHARE_TOOLS[tool].build(state);
  return `${location.origin}${base}${q ? `?${q}` : ""}`;
}

/* Mensaje de WhatsApp: el resumen y el link para volver a ver el resultado (whatsappLink suma el Ref). */
function shareWhatsappLink(tool, state) {
  return whatsappLink(`${SHARE_TOOLS[tool].summary(state)}\n\nMi resultado: ${shareUrl(tool, state)}`);
}

/* Botones debajo del resultado. El link de WhatsApp se completa con los datos al tocarlo (ver app.js). */
function shareActionsHTML(tool) {
  const context = tool === "dimensionador" ? "dimensionador" : `calc-${tool}`;
  return `<div class="share-actions">
    <a class="btn btn-primary" href="${whatsappLink("Hola, quiero que me manden un sistema solar.")}" target="_blank" rel="noopener"
      data-action="share-wa" data-tool="${tool}" data-context="${context}">${icon("whatsapp-logo", "", "fill")} Mandame este sistema por WhatsApp</a>
    <button type="button" class="btn btn-secondary" data-action="share-result" data-tool="${tool}">${icon("share-network")} Compartir mi resultado</button>
  </div>`;
}
