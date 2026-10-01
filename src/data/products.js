/* AURYX: Catálogo de demo (fallback) + metadatos de categorías/tipos de sistema. Sin dependencias. */

/* =========================================================================
   AURYX: Datos de catálogo
   Especificaciones técnicas tomadas de hojas de datos de fabricante.
   Precios son estimaciones de mercado (ARS/USD) a ajustar antes de producción.
   ========================================================================= */

/* Datos de demo: se usan como fallback si la API no responde
   (o mientras se está desarrollando sin el backend levantado).
   Una vez que la API responde, App reemplaza PRODUCTS con los datos reales.
   DEMO_PRODUCTS se conserva aparte: la demo interactiva del inicio lo usa
   como ejemplo fijo aunque el catálogo real venga de la API. */
const DEMO_PRODUCTS = [
  {
    id: "panel-jk-575", category: "panel",
    brand: "Jinko Solar", name: "Tiger Neo N-Type 575W (144 celdas)",
    priceUSD: 132, priceARS: 178000, availability: "disponible",
    description: "Panel monocristalino tipo N (TOPCon) de alta eficiencia, celda partida, apto para techos residenciales y comerciales.",
    specs: { pmax: 575, voc: 52.30, isc: 13.89, vmp: 43.73, imp: 13.15, efficiency: 22.26, tech: "Mono N-Type TOPCon", dims: "2278 × 1134 × 30 mm", weight: "27.5 kg" },
  },
  {
    id: "panel-jk-510-bif", category: "panel",
    brand: "Jinko Solar", name: "Tiger Neo Bifacial 510W (108 celdas)",
    priceUSD: 121, priceARS: 163000, availability: "disponible",
    description: "Panel bifacial de doble vidrio, aprovecha la radiación reflejada en la cara posterior. Buena opción para estructuras elevadas.",
    specs: { pmax: 510, voc: 40.72, isc: 15.73, vmp: 34.39, imp: 14.83, efficiency: 22.93, tech: "Mono N-Type Bifacial", dims: "1961 × 1134 × 30 mm", weight: "27 kg" },
  },
  {
    id: "inv-growatt-5k", category: "inversor",
    brand: "Growatt", name: "MIN 5000TL-XH Híbrido Monofásico",
    priceUSD: 780, priceARS: 1050000, availability: "disponible",
    description: "Inversor híbrido on-grid con entrada para batería de litio. 2 MPPT independientes. Compatible con la mayoría de baterías de 48V del mercado.",
    systemTypes: ["ongrid", "hybrid"],
    specs: { type: "Híbrido", ratedPowerAC: 5000, maxPvPower: 7000, maxPvVoltage: 550, mpptRangeMin: 80, mpptRangeMax: 550, mpptCount: 2, maxInputCurrentPerMppt: 13.5, batteryVoltageMin: 40, batteryVoltageMax: 60, efficiency: 98.4 },
  },
  {
    id: "reg-epever-40a", category: "regulador",
    brand: "EPEVER", name: "Tracer 4210AN MPPT 40A",
    priceUSD: 145, priceARS: 195000, availability: "disponible",
    description: "Controlador de carga MPPT para sistemas autónomos de 12/24V (detección automática). Ideal para bombeo, cabañas e iluminación aislada.",
    systemTypes: ["offgrid"],
    specs: { type: "Regulador MPPT", ratedChargeCurrent: 40, maxPvVoltage: 100, maxPvPowerBySystemVoltage: { 12: 520, 24: 1040 }, systemVoltageOptions: [12, 24], trackingEfficiency: 99.5 },
  },
  {
    id: "bat-pylontech-48", category: "bateria",
    brand: "Pylontech", name: "US3000C 48V 3.55kWh LiFePO4",
    priceUSD: 890, priceARS: 1200000, availability: "disponible",
    description: "Batería de litio modular en formato rack 19\", pensada para inversores híbridos de 48V. Hasta 16 unidades en paralelo.",
    specs: { nominalVoltage: 48, capacityWh: 3552, usableWh: 3374, maxContinuousCurrent: 74, recommendedCurrent: 37, chargeVoltageRange: [52.5, 53.5], dischargeVoltageRange: [44.5, 53.5], maxParallel: 16, cycles: 6000 },
  },
  {
    id: "bat-renogy-12", category: "bateria",
    brand: "Renogy", name: "Core Series 12V 100Ah LiFePO4",
    priceUSD: 310, priceARS: 420000, availability: "a pedido",
    description: "Batería de litio de 12V para sistemas autónomos con regulador de carga. Formato compacto, BMS integrado.",
    specs: { nominalVoltage: 12.8, capacityAh: 100, capacityWh: 1280, voltageRange: [10, 14.8], maxChargeCurrent: 100, maxDischargeCurrent: 100, peakDischargeCurrent: 245, maxParallel: 8, cycles: 5000 },
  },
  {
    id: "prot-breaker-dc", category: "proteccion",
    brand: "Genérico", name: "Interruptor termomagnético DC 2P 32A / 500V",
    priceUSD: 22, priceARS: 30000, availability: "disponible",
    description: "Protección de string fotovoltaico contra sobrecorriente. Apto para tableros DC de hasta 500V.",
    specs: { poles: 2, current: "32A", voltage: "500V DC" },
  },
  {
    id: "prot-spd", category: "proteccion",
    brand: "Genérico", name: "Protector contra sobretensión (SPD) Tipo 2 DC",
    priceUSD: 35, priceARS: 47000, availability: "disponible",
    description: "Protección contra sobretensiones transitorias (descargas atmosféricas) en el lado DC de la instalación.",
    specs: { tipo: "Tipo 2", voltage: "1000V DC", corrienteDescarga: "20kA" },
  },
  {
    id: "cable-pv1f-6", category: "cable",
    brand: "Genérico", name: "Cable solar PV1-F 6mm² (rollo x 100m)",
    priceUSD: 145, priceARS: 195000, availability: "disponible",
    description: "Cable unipolar para intemperie, doble aislación, resistente a UV. Estándar para cableado de strings fotovoltaicos.",
    specs: { seccion: "6 mm²", tension: "1.8kV DC", resistenciaUV: "Sí" },
  },
  {
    id: "cable-mc4", category: "cable",
    brand: "Genérico", name: "Conectores MC4 (par macho/hembra)",
    priceUSD: 4, priceARS: 5500, availability: "disponible",
    description: "Conectores estándar de la industria para unión de paneles y strings, IP68.",
    specs: { corriente: "30A", ip: "IP68" },
  },
  {
    id: "acc-estructura-techo", category: "accesorio",
    brand: "Genérico", name: "Kit de estructura para techo inclinado (4 paneles)",
    priceUSD: 210, priceARS: 285000, availability: "disponible",
    description: "Rieles de aluminio anodizado y ganchos de fijación para techos de chapa o teja, set para 4 módulos.",
    specs: { material: "Aluminio anodizado", paneles: 4, cargaViento: "hasta 150 km/h" },
  },
];
let PRODUCTS = DEMO_PRODUCTS.slice();

const CATEGORY_META = {
  panel: { label: "Paneles solares", icon: "solar-panel" },
  inversor: { label: "Inversores", icon: "lightning" },
  regulador: { label: "Reguladores MPPT", icon: "cpu" },
  bateria: { label: "Baterías", icon: "battery-high" },
  proteccion: { label: "Protecciones", icon: "shield-check" },
  cable: { label: "Cables y conectores", icon: "plugs-connected" },
  accesorio: { label: "Accesorios", icon: "wrench" },
  soporte: { label: "Soportes y fijación", icon: "squares-four" },
};

const SYSTEM_TYPES = [
  {
    id: "ongrid", name: "On-grid", icon: "lightning",
    desc: "Conectado a la red eléctrica. Reduce la factura de luz inyectando o compensando tu propio consumo. Sin batería.",
    needsBattery: false, sourceCategory: "inversor",
  },
  {
    id: "hybrid", name: "Híbrido (con batería)", icon: "battery-high",
    desc: "Conectado a la red y con respaldo de batería para usar de noche o durante un corte de suministro.",
    needsBattery: true, sourceCategory: "inversor",
  },
  {
    id: "offgrid", name: "Off-grid DC (autónomo)", icon: "cpu",
    desc: "Sistema aislado en corriente continua: bombeo, cabañas, iluminación. No requiere inversor, solo regulador y batería.",
    needsBattery: true, sourceCategory: "regulador",
  },
];

const AVAILABILITY_META = {
  "disponible": { label: "Disponible", tone: "ok" },
  "a pedido": { label: "A pedido", tone: "warn" },
  "sin stock": { label: "Sin stock", tone: "bad" },
};

const SPEC_LABELS = {
  pmax: "Potencia máxima (W)", voc: "Voc, tensión de circuito abierto (V)", isc: "Isc, corriente de cortocircuito (A)",
  vmp: "Vmp, tensión a potencia máxima (V)", imp: "Imp, corriente a potencia máxima (A)", efficiency: "Eficiencia (%)",
  tech: "Tecnología de celda", dims: "Dimensiones", weight: "Peso",
  type: "Tipo", ratedPowerAC: "Potencia nominal CA (W)", maxPvPower: "Potencia FV máx. (W)",
  maxPvVoltage: "Tensión FV máx. (V)", mpptRangeMin: "MPPT mín. (V)", mpptRangeMax: "MPPT máx. (V)",
  mpptCount: "Cantidad de MPPT", maxInputCurrentPerMppt: "Corriente máx. por MPPT (A)",
  batteryVoltageMin: "Tensión batería mín. (V)", batteryVoltageMax: "Tensión batería máx. (V)",
  ratedChargeCurrent: "Corriente de carga nominal (A)", trackingEfficiency: "Eficiencia de seguimiento MPPT (%)",
  nominalVoltage: "Tensión nominal (V)", capacityWh: "Capacidad nominal (Wh)", usableWh: "Capacidad útil (Wh)",
  maxContinuousCurrent: "Corriente máx. continua (A)", recommendedCurrent: "Corriente recomendada (A)",
  maxParallel: "Máx. unidades en paralelo", cycles: "Ciclos de vida", capacityAh: "Capacidad (Ah)",
  maxChargeCurrent: "Corriente máx. de carga (A)", maxDischargeCurrent: "Corriente máx. de descarga (A)",
  peakDischargeCurrent: "Corriente pico de descarga (A)", poles: "Polos", current: "Corriente", voltage: "Tensión",
  tipo: "Tipo", corrienteDescarga: "Corriente de descarga", seccion: "Sección", resistenciaUV: "Resistencia UV",
  corriente: "Corriente admitida", ip: "Grado IP", material: "Material", paneles: "Paneles compatibles", cargaViento: "Carga de viento",
  // claves en español que devuelve la API (compragamer-api)
  potencia_wp: "Potencia pico (W)", coef_temp_voc: "Coef. de temperatura de Voc (%/°C)", normas: "Normas",
  ip_modulo: "Grado IP del módulo", clase_fuego: "Clase de fuego", rango_temp_c: "Rango de temperatura (°C)",
  tiene_cables: "Incluye cables", niebla_salina: "Resistencia a niebla salina", carga_nieve_pa: "Carga de nieve (Pa)",
  carga_viento_pa: "Carga de viento (Pa)", grosor_vidrio_mm: "Espesor del vidrio (mm)", bastidor_material: "Material del marco",
  grado_ip_caja_conexiones: "Grado IP de la caja de conexiones",
  potencia_nominal_w: "Potencia nominal (W)", vmpp_max: "Tensión MPPT máx. (V)", vmpp_min: "Tensión MPPT mín. (V)",
  corriente_max_entrada: "Corriente máx. de entrada (A)", es_microinversor: "Microinversor", altitud_max_m: "Altitud máx. (m)",
  humedad_max_pct: "Humedad máx. (%)", material_carcasa: "Material de la carcasa", rele_programable: "Relé programable",
  grado_contaminacion: "Grado de contaminación", nivel_fallo_aislamiento: "Detección de falla de aislamiento",
  proteccion_arco_electrico: "Protección contra arco eléctrico", proteccion_sobretemperatura: "Protección por sobretemperatura",
  proteccion_polaridad_inversa: "Protección de polaridad inversa", nivel_activacion_fuga_tierra_ma: "Activación por fuga a tierra (mA)",
  proteccion_sobretension_transitoria: "Protección contra sobretensiones",
  capacidad_kwh: "Capacidad (kWh)", vida_util_ciclos: "Vida útil (ciclos)", tension_absorcion_v: "Tensión de absorción (V)",
  tension_flotacion_v: "Tensión de flotación (V)", temp_almacenamiento_c: "Temperatura de almacenamiento (°C)",
  carga_max_kg: "Carga máx. (kg)", compatible_con: "Compatible con",
};
