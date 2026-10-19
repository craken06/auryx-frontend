/* AURYX: tarifas eléctricas residenciales por distribuidora, para la calculadora de costo.
   Factura mensual total (con impuestos, usuario sin subsidio) en pesos a 150, 265, 600 y 1.000 kWh/mes.
   Fuente: Observatorio de Tarifas y Subsidios IIEP-UBA. 265 kWh: septiembre 2026 (reporte #42, gráfico 17).
   150, 600 y 1.000 kWh: mayo 2026 (reporte #38, gráfico 23), llevados a septiembre con la variación de la
   factura de 265 kWh de cada distribuidora. net / other / tax: parte de la factura que es tarifa neta (energía
   y distribución), otros cargos e impuestos (IVA, provinciales y municipales), medida en el gráfico 17 de
   septiembre. Si cambian las tarifas, se actualizan estos números con el informe nuevo. */
const TARIFF_DATE = "septiembre 2026";
const TARIFF_NATIONAL_265 = 94307; // factura promedio país a 265 kWh, septiembre 2026
const TARIFF_DISTRIBUTORS = {
  edenor: { name: "Edenor (norte de CABA y del conurbano)", pts: [[150, 32201], [265, 57907], [600, 156918], [1000, 321171]], net: 0.831, other: 0.000, tax: 0.169 },
  edesur: { name: "Edesur (sur de CABA y del conurbano)", pts: [[150, 33154], [265, 59502], [600, 161422], [1000, 346433]], net: 0.806, other: 0.005, tax: 0.189 },
  edelap: { name: "EDELAP (La Plata y alrededores)", pts: [[150, 45009], [265, 86280], [600, 221887], [1000, 402050]], net: 0.732, other: 0.025, tax: 0.243 },
  edea: { name: "EDEA (Mar del Plata y la Costa Atlántica)", pts: [[150, 54931], [265, 96084], [600, 227363], [1000, 393082]], net: 0.737, other: 0.019, tax: 0.244 },
  eden: { name: "EDEN (norte y centro de la provincia)", pts: [[150, 60215], [265, 107152], [600, 256285], [1000, 446211]], net: 0.741, other: 0.017, tax: 0.242 },
  edes: { name: "EDES (sur de la provincia, Bahía Blanca)", pts: [[150, 63216], [265, 111236], [600, 266061], [1000, 464698]], net: 0.752, other: 0.017, tax: 0.231 },
  ecsapem: { name: "Energía de Catamarca (EC SAPEM)", pts: [[150, 70449], [265, 93904], [600, 162230], [1000, 243812]], net: 0.773, other: 0.000, tax: 0.227 },
  secheep: { name: "SECHEEP", pts: [[150, 52381], [265, 94384], [600, 223929], [1000, 379608]], net: 0.766, other: 0.020, tax: 0.214 },
  servicoop: { name: "Servicoop (Puerto Madryn)", pts: [[150, 74223], [265, 127680], [600, 264651], [1000, 416464]], net: 0.761, other: 0.000, tax: 0.239 },
  epec: { name: "EPEC", pts: [[150, 58793], [265, 107299], [600, 278409], [1000, 510114]], net: 0.722, other: 0.000, tax: 0.278 },
  dpec: { name: "DPEC", pts: [[150, 56181], [265, 82853], [600, 175018], [1000, 287083]], net: 0.788, other: 0.060, tax: 0.152 },
  enersa: { name: "ENERSA", pts: [[150, 53845], [265, 98760], [600, 247610], [1000, 426717]], net: 0.777, other: 0.000, tax: 0.223 },
  refsa: { name: "REFSA", pts: [[150, 35563], [265, 61602], [600, 142135], [1000, 236673]], net: 0.862, other: 0.000, tax: 0.138 },
  ejesa: { name: "EJESA", pts: [[150, 58539], [265, 98734], [600, 234399], [1000, 386715]], net: 0.750, other: 0.041, tax: 0.209 },
  lapampa: { name: "Distribuidora de referencia de La Pampa", pts: [[150, 52406], [265, 96999], [600, 248711], [1000, 430887]], net: 0.723, other: 0.000, tax: 0.277 },
  edelar: { name: "EDELAR", pts: [[150, 37127], [265, 59151], [600, 129600], [1000, 231851]], net: 0.882, other: 0.000, tax: 0.118 },
  edemsa: { name: "EDEMSA", pts: [[150, 70307], [265, 113099], [600, 246065], [1000, 378914]], net: 0.702, other: 0.000, tax: 0.298 },
  emsa: { name: "Energía de Misiones", pts: [[150, 59287], [265, 98408], [600, 213315], [1000, 351701]], net: 0.786, other: 0.003, tax: 0.211 },
  epen: { name: "EPEN", pts: [[150, 94062], [265, 160311], [600, 325592], [1000, 506850]], net: 0.705, other: 0.002, tax: 0.293 },
  edersa: { name: "EdERSA", pts: [[150, 70541], [265, 133074], [600, 273180], [1000, 440472]], net: 0.698, other: 0.000, tax: 0.302 },
  edesa: { name: "EDESA", pts: [[150, 63392], [265, 114673], [600, 240667], [1000, 391913]], net: 0.810, other: 0.000, tax: 0.190 },
  esj: { name: "Energía San Juan", pts: [[150, 51496], [265, 82734], [600, 177811], [1000, 285793]], net: 0.783, other: 0.004, tax: 0.213 },
  edesal: { name: "EDESAL", pts: [[150, 49523], [265, 90624], [600, 183657], [1000, 280539]], net: 0.812, other: 0.003, tax: 0.185 },
  spse: { name: "SPSE", pts: [[150, 40775], [265, 60402], [600, 122849], [1000, 187551]], net: 0.870, other: 0.005, tax: 0.125 },
  epe: { name: "EPE", pts: [[150, 61247], [265, 123466], [600, 317610], [1000, 546777]], net: 0.695, other: 0.000, tax: 0.305 },
  edese: { name: "EDESE", pts: [[150, 48055], [265, 75338], [600, 190881], [1000, 319537]], net: 0.758, other: 0.017, tax: 0.225 },
  dpe: { name: "DPE", pts: [[150, 36351], [265, 58292], [600, 128530], [1000, 213277]], net: 0.870, other: 0.000, tax: 0.130 },
  edet: { name: "EDET", pts: [[150, 47570], [265, 90640], [600, 250770], [1000, 350569]], net: 0.674, other: 0.036, tax: 0.290 },
};
const TARIFF_PROVINCES = [
  { id: "ba", name: "Buenos Aires", dists: ["edenor", "edesur", "edelap", "edea", "eden", "edes"] },
  { id: "caba", name: "Ciudad de Buenos Aires", dists: ["edenor", "edesur"] },
  { id: "catamarca", name: "Catamarca", dists: ["ecsapem"] },
  { id: "chaco", name: "Chaco", dists: ["secheep"] },
  { id: "chubut", name: "Chubut", dists: ["servicoop"] },
  { id: "cordoba", name: "Córdoba", dists: ["epec"] },
  { id: "corrientes", name: "Corrientes", dists: ["dpec"] },
  { id: "entrerios", name: "Entre Ríos", dists: ["enersa"] },
  { id: "formosa", name: "Formosa", dists: ["refsa"] },
  { id: "jujuy", name: "Jujuy", dists: ["ejesa"] },
  { id: "lapampa", name: "La Pampa", dists: ["lapampa"] },
  { id: "larioja", name: "La Rioja", dists: ["edelar"] },
  { id: "mendoza", name: "Mendoza", dists: ["edemsa"] },
  { id: "misiones", name: "Misiones", dists: ["emsa"] },
  { id: "neuquen", name: "Neuquén", dists: ["epen"] },
  { id: "rionegro", name: "Río Negro", dists: ["edersa"] },
  { id: "salta", name: "Salta", dists: ["edesa"] },
  { id: "sanjuan", name: "San Juan", dists: ["esj"] },
  { id: "sanluis", name: "San Luis", dists: ["edesal"] },
  { id: "santacruz", name: "Santa Cruz", dists: ["spse"] },
  { id: "santafe", name: "Santa Fe", dists: ["epe"] },
  { id: "sgo", name: "Santiago del Estero", dists: ["edese"] },
  { id: "tdf", name: "Tierra del Fuego", dists: ["dpe"] },
  { id: "tucuman", name: "Tucumán", dists: ["edet"] },
];

/* Cuadros tarifarios oficiales (residencial sin subsidio, sin impuestos). cats: [tope en kWh/mes, cargo fijo $/mes,
   cargo variable $/kWh]; el consumo del mes cae en la primera categoría cuyo tope alcanza y todo se cobra al precio
   de esa categoría. bimonthly: la distribuidora categoriza por bimestre (los topes y el cargo fijo ya están pasados
   a mes). other: impuestos y tasas provinciales y municipales sobre el neto, además del IVA; calibrado con la factura
   que publica el IIEP a 265 kWh (por provincia cuando la distribuidora atiende dos). Las distribuidoras que no
   están acá se estiman con los puntos del IIEP (TARIFF_DISTRIBUTORS). */
const TARIFF_IVA = 0.21;
const TARIFF_CUADROS = {
  edenor: { date: "septiembre 2026", source: "ENReGE, cuadro tarifario de Edenor vigente desde el 1/9/2026", other: { caba: 0.064, ba: 0.184 },
    cats: [[150, 1770.2, 156.65], [400, 3775.55, 157.295], [500, 12398.09, 169.229], [600, 19834.16, 173.112], [700, 41804.79, 173.403], [Infinity, 65205.49, 188.976]] },
  edesur: { date: "octubre 2026", source: "Resolución ENReGE 709/26, vigente desde el 1/10/2026", other: { caba: 0.064, ba: 0.184 },
    cats: [[150, 1771.06, 157.116], [400, 3717.51, 157.692], [500, 12168.59, 169.922], [600, 19843.84, 174.056], [700, 42905.86, 186.593], [Infinity, 65106.92, 203.605]] },
  edelap: { date: "septiembre 2026", source: "OCEBA, Resolución MIySP 682/26, anexo 43, vigente desde el 1/9/2026", other: 0.19,
    cats: [[150, 5762.32, 174.2926], [325, 17892.17, 165.1251], [400, 20501.33, 166.5695], [450, 24983.37, 174.9039], [500, 28242.17, 179.3775], [600, 42132.81, 192.6088], [700, 55370, 204.4843], [1400, 75518.56, 209.9216], [Infinity, 89317.04, 211.0473]] },
  edea: { date: "septiembre 2026", source: "OCEBA, Resolución MIySP 682/26, anexo 44, vigente desde el 1/9/2026", other: 0.184,
    cats: [[100, 4184.62, 211.103], [200, 6433.79, 220.034], [400, 8795.2, 226.995], [500, 10931.57, 232.1185], [700, 17565.62, 242.4968], [1400, 28472.23, 253.4679], [Infinity, 34769.05, 271.4165]] },
  eden: { date: "septiembre 2026", source: "OCEBA, Resolución MIySP 682/26, anexo 45, vigente desde el 1/9/2026", other: 0.181,
    cats: [[100, 5240.4, 227.7806], [200, 8049.7, 235.0049], [400, 10997.62, 249.1032], [500, 13665.46, 260.0835], [700, 21951.19, 270.273], [1400, 35571.83, 285.0233], [Infinity, 43435.19, 305.1694]] },
  edes: { date: "septiembre 2026", source: "OCEBA, Resolución MIySP 682/26, anexo 46, vigente desde el 1/9/2026", other: 0.182,
    cats: [[100, 5852.09, 229.2413], [200, 8977.07, 243.0037], [400, 12259.05, 255.2269], [500, 15227.62, 263.2928], [700, 24448.12, 277.6572], [1400, 39606.03, 294.1319], [Infinity, 48356.83, 316.4873]] },
  edemsa: { date: "septiembre 2026", source: "Resolución EPRE 189/2026, anexo I, vigente desde el 1/9/2026 (categorías por consumo bimestral)", bimonthly: true, other: 0.281,
    cats: [[149.5, 3781.4615, 280.5412], [299.5, 4167.0055, 270.4639], [Infinity, 24746.72, 241.6774]] },
};
