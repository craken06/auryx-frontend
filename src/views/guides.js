/* AURYX: guías (/guias/ y /guias/<slug>/). Texto para buscadores con las tablas calculadas por las mismas
   funciones del sitio: la fórmula y el catálogo del dimensionador (views/sizer.js) y las tarifas de la
   calculadora de costo (data/tariffs.js, views/calculators/cost.js). Si cambian precios o tarifas, los
   números de las guías cambian solos; el texto no afirma nada que dependa de un número sin calcularlo.
   Las guías con needsCatalog esperan el catálogo (app.js); mientras tanto se ve la página generada.
   Lo usa también scripts/build-seo-pages.mjs. Depende de: views/sizer.js, views/calculators/*.js, utils/format.js. */

const GUIDE_PANEL_W = 550; // potencia de panel de referencia para la tabla de la guía 1 (la más común hoy)
const GUIDE_CONSUMPTIONS = [150, 250, 350, 450, 600, 800, 1000];

const guideNum = (n, d = 0) => fmtNum(n, d);
const guideTable = (head, rows, caption) => `<div class="table-scroll"><table class="guide-table">
  ${caption ? `<caption>${caption}</caption>` : ""}
  <thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join("")}</tr>`).join("")}</tbody>
</table></div>`;
// los precios del catálogo están en pesos y el dimensionador los pasa a dólares: se redondea a miles (orientativo)
const guideArs = (usd) => fmtARS(Math.round((usd * USD_ARS_RATE) / 1000) * 1000);
/* Fecha de los precios: la última actualización del catálogo (hora de Argentina). Con la fecha del día, el
   build diario cambiaría las guías todos los días aunque no cambie ningún precio. */
function guidePricesTime() {
  const list = (typeof SIZER_PRODUCTS !== "undefined" ? SIZER_PRODUCTS : []).map((p) => p.updatedAt).filter(Boolean).sort();
  const d = list.length ? new Date(list[list.length - 1]) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
const GUIDE_TZ = "America/Argentina/Buenos_Aires";
const guideToday = () => guidePricesTime().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: GUIDE_TZ });
/* La misma fecha como AAAA-MM-DD (lastmod del sitemap). */
const guidePricesIso = () => guidePricesTime().toLocaleDateString("sv-SE", { timeZone: GUIDE_TZ });

/* ---------------------------------------------------------------- cálculos */

/* Paneles para generar el consumo del mes: kWp = consumo / (30 días × horas de sol pico × rendimiento). */
function guidePanelsFor(cons, hsp, w = GUIDE_PANEL_W) {
  return Math.ceil((cons * 1000) / (30 * hsp * SIZER_PR) / w);
}

/* Sistema on-grid del dimensionador rápido para un consumo y una zona (ahorro buscado: 70 % de la factura). */
function guideOnGrid(cons, hsp) {
  return sizerQuickResult({ cons: String(cons), hsp: String(hsp), goal: "red", save: "70", hours: "4", days: "2" });
}

/* Precio de las baterías del catálogo por kWh, en USD: la mediana (un precio mal cargado no la mueve). */
function guideBatteryUsdPerKwh() {
  const list = sizerCatalog().batteries.map((b) => b.usd / b.kwh).filter((v) => v > 0).sort((a, b) => a - b);
  if (!list.length) return 0;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

/* El inversor más barato del catálogo para un objetivo, monofásico. */
const guideCheapestInverter = (goal) => sizerInvertersFor(goal, "mono").reduce((b, i) => (!b || i.usd < b.usd ? i : b), null);

/* Ahorro con las tarifas de una distribuidora: la factura baja por lo que se consume en el momento (con el
   cuadro tarifario o la estimación del IIEP, incluido el cambio de categoría) y el excedente inyectado se
   acredita al valor que usa el dimensionador. Montos en pesos por mes. */
function guideSaving(r, cons, province, dist) {
  const before = costTotals({ kwh: cons, province, dist });
  const self = Math.min(r.gen * SIZER_SELF_USE.red, cons);
  const injected = Math.max(0, r.gen - self);
  const after = costTotals({ kwh: cons - self, province, dist });
  const floor = costTotals({ kwh: 0, province, dist }).bill; // el cargo fijo se paga igual
  const monthly = Math.min(before.bill - after.bill + injected * before.perKwh * SIZER_INJECT_VALUE, before.bill - floor);
  return { bill: before.bill, monthly, official: before.official, ct: before.ct };
}

const GUIDE_ZONES = [
  { place: "CABA", province: "caba", dist: "edenor", hsp: "4.4" },
  { place: "Mar del Plata", province: "ba", dist: "edea", hsp: "4.2" },
  { place: "Córdoba", province: "cordoba", dist: "epec", hsp: "5.0" },
  { place: "Mendoza", province: "mendoza", dist: "edemsa", hsp: "5.8" },
  { place: "Salta", province: "salta", dist: "edesa", hsp: "5.6" },
  { place: "Neuquén", province: "neuquen", dist: "epen", hsp: "4.6" },
];

function guideSavingsRows(cons) {
  return GUIDE_ZONES.map((z) => {
    const r = guideOnGrid(cons, z.hsp);
    const s = guideSaving(r, cons, z.province, z.dist);
    const roi = sizerRoi(r, cons, "red", { monthly: s.monthly / USD_ARS_RATE, bill: s.bill / USD_ARS_RATE });
    return { ...z, r, s, roi, distName: TARIFF_DISTRIBUTORS[z.dist].name.split(" (")[0] };
  });
}

/* ---------------------------------------------------------------- guías */

const GUIDES = [
  {
    slug: "cuantos-paneles-solares-necesito",
    title: "Cuántos paneles solares necesito para mi casa",
    h1: "Cuántos paneles solares necesito para mi casa",
    description: "Cómo calcular cuántos paneles solares necesitás según tu consumo y tu zona, con una tabla de 150 a 1.000 kWh por mes para AMBA, Córdoba y Mendoza.",
    lead: "La cantidad depende de tres cosas: cuánta energía usás, cuánto sol tiene tu zona y la potencia de cada panel. Acá está la cuenta y una tabla para encontrar tu caso.",
    date: "2026-10-21",
    needsCatalog: false,
    body() {
      const zones = [SIZER_LOCATIONS[0], SIZER_LOCATIONS[1], SIZER_LOCATIONS[2]];
      const zoneName = (z) => z.label.split(" (")[0];
      const ex = { cons: 350, hsp: Number(zones[0].value) };
      const exKwp = ex.cons / (30 * ex.hsp * SIZER_PR);
      const exN = guidePanelsFor(ex.cons, ex.hsp);
      const rows = GUIDE_CONSUMPTIONS.map((c) => [`${guideNum(c)} kWh`, ...zones.map((z) => {
        const n = guidePanelsFor(c, Number(z.value));
        return `${n} paneles <small>${guideNum((n * GUIDE_PANEL_W) / 1000, 1)} kWp</small>`;
      })]);
      const eo = SIZER_ORIENTATIONS.find((o) => o.label.startsWith("Este"));
      return `
      <p>La pregunta más común antes de instalar energía solar tiene una respuesta corta: <strong>depende de tu consumo, de tu zona y de la potencia del panel</strong>. Lo bueno es que la cuenta es simple y la podés hacer con tu factura de luz en la mano.</p>

      <h2>La cuenta en tres pasos</h2>
      <ol class="calc-steps">
        <li><strong>Tu consumo mensual en kWh.</strong> Está en la factura. Si es bimestral, dividilo por 2. Si no la tenés, sumá tus equipos con la <a href="#calculators/consumo">calculadora de consumo</a>.</li>
        <li><strong>Las horas de sol pico de tu zona.</strong> Son las horas equivalentes de sol pleno por día, en promedio anual: unas ${guideNum(Number(zones[0].value), 1)} en el AMBA, ${guideNum(Number(zones[1].value), 1)} en Córdoba y ${guideNum(Number(zones[2].value), 1)} en Mendoza y San Juan.</li>
        <li><strong>La potencia que hace falta.</strong> kWp = consumo mensual ÷ (30 días × horas de sol pico × ${guideNum(SIZER_PR, 1)}). El ${guideNum(SIZER_PR, 1)} descuenta las pérdidas por temperatura, cableado e inversor. Después dividís por la potencia del panel.</li>
      </ol>
      <p>Un ejemplo: una casa del AMBA que consume ${guideNum(ex.cons)} kWh por mes necesita ${guideNum(ex.cons)} ÷ (30 × ${guideNum(ex.hsp, 1)} × ${guideNum(SIZER_PR, 1)}) = <strong>${guideNum(exKwp, 2)} kWp</strong>. Con paneles de ${GUIDE_PANEL_W} W son ${guideNum(exKwp * 1000 / GUIDE_PANEL_W, 2)}, o sea <strong>${exN} paneles</strong> redondeando para arriba.</p>

      <h2>Tabla: paneles de ${GUIDE_PANEL_W} W según consumo y zona</h2>
      <p>Para generar en el año lo mismo que consumís. Calculada con la misma fórmula que usa <a href="#configurator">Diseñá tu sistema</a>.</p>
      ${guideTable(["Consumo mensual", ...zones.map(zoneName)], rows, `Paneles de ${GUIDE_PANEL_W} W orientados al norte, sin sombras, rendimiento del ${guideNum(SIZER_PR * 100)} %.`)}
      <p>Fijate que el mismo consumo necesita bastante menos potencia en Mendoza que en Buenos Aires: hay más horas de sol. Por eso conviene siempre hacer la cuenta con los datos de tu zona y no con una regla general.</p>

      <h2>¿Tengo que cubrir el 100 % de mi consumo?</h2>
      <p>No necesariamente. En un sistema conectado a la red (on-grid), lo que generás de día y no usás en el momento se inyecta a la red, y esa energía se paga mucho menos que la que comprás. Por eso muchas veces conviene un sistema algo más chico que cubra lo que consumís de día, en vez de uno que genere todo el consumo del mes. El dimensionador te deja elegir qué parte de la factura querés ahorrar y arma el sistema para eso.</p>
      <p>En un sistema aislado (off-grid) es al revés: no hay red que compense, así que se dimensiona con margen para los días nublados, y las baterías tienen que guardar la energía para la noche.</p>

      <h2>Qué puede cambiar el resultado</h2>
      <ul class="legal-list">
        <li><strong>La orientación.</strong> En Argentina los paneles van mirando al norte. Mirando al este o al oeste generan alrededor de un ${guideNum((1 - Number(eo.value)) * 100)} % menos y hacen falta más paneles. La inclinación ideal la calculás con la <a href="#calculators/orientacion">calculadora de orientación</a>.</li>
        <li><strong>Las sombras.</strong> Un árbol, un tanque de agua o el edificio de al lado pueden bajar mucho la generación, sobre todo en invierno, cuando el sol está más bajo.</li>
        <li><strong>La potencia del panel.</strong> Con paneles de 450 W hacen falta más unidades que con paneles de 600 W para la misma potencia. Lo que importa es el total en kWp.</li>
        <li><strong>La superficie disponible.</strong> Un panel de ${GUIDE_PANEL_W} W ocupa unos 2,5 m². Si el techo no alcanza, se elige un panel más potente o se acepta cubrir una parte del consumo.</li>
        <li><strong>El consumo que viene.</strong> Si pensás sumar un aire acondicionado, un auto eléctrico o una bomba de calor, sumalo a la cuenta desde el principio.</li>
      </ul>

      <h2>Y después de los paneles, el inversor</h2>
      <p>La potencia del arreglo define qué inversor hace falta: tiene que aceptar esa potencia y la tensión de los paneles conectados en serie, también en los días más fríos, cuando la tensión sube. Si además querés respaldo ante cortes, el inversor tiene que ser híbrido. Lo explicamos en la guía <a href="#guides/inversor-on-grid-off-grid-o-hibrido">Inversor on-grid, off-grid o híbrido</a>.</p>
      <p>Si querés saber cuánto sale el sistema para tu consumo, está en <a href="#guides/cuanto-cuesta-instalar-paneles-solares">Cuánto cuesta instalar paneles solares</a>, y cuánto ahorrarías con la tarifa de tu provincia, en <a href="#guides/cuanto-se-ahorra-con-paneles-solares">Cuánto se ahorra con paneles solares</a>.</p>

      <h2>La forma rápida</h2>
      <p>Todo esto lo hace <a href="#configurator">Diseñá tu sistema</a>: cargás tu consumo y tu zona, y te devuelve la cantidad de paneles, el inversor, cómo se conectan los strings y si los equipos son compatibles entre sí. Gratis y sin registrarte.</p>`;
    },
  },

  {
    slug: "cuanto-cuesta-instalar-paneles-solares",
    title: "Cuánto cuesta instalar paneles solares en Argentina",
    h1: "Cuánto cuesta instalar paneles solares en Argentina",
    description: "Precios orientativos de sistemas solares on-grid según tu consumo, cuánto suman las baterías y qué cambia el costo de la instalación. Precios en pesos.",
    lead: "El precio de un sistema solar depende sobre todo de su tamaño, del tipo de inversor y de si lleva baterías. Estos son los números con los equipos y precios del catálogo de AURYX.",
    date: "2026-10-21",
    needsCatalog: true,
    body() {
      const hsp = SIZER_LOCATIONS[0].value;
      const sizes = [150, 250, 350, 450, 600, 800];
      const systems = sizes.map((c) => ({ c, r: guideOnGrid(c, hsp) })).filter((x) => !x.r.empty);
      const rows = systems.map(({ c, r }) => {
        const panels = r.lines.find((l) => l.item === r.config.pan || (l.item.w && l.item.voc));
        return [`${guideNum(c)} kWh`, `${guideNum(r.kwp, 2)} kWp`, `${panels ? panels.qty : "-"}`, guideArs(r.total), guideArs(r.total * SIZER_INSTALL), `<strong>${guideArs(r.total * (1 + SIZER_INSTALL))}</strong>`];
      });
      const mid = systems.find((x) => x.c === 450) || systems[Math.floor(systems.length / 2)];
      const share = (pred) => mid.r.lines.filter(pred).reduce((s, l) => s + l.qty * l.item.usd, 0);
      const midTotal = mid.r.total * (1 + SIZER_INSTALL);
      const pct = (v) => `${guideNum((v / midTotal) * 100)} %`;
      const panelUsd = share((l) => l.item.w && l.item.voc);
      const invUsd = share((l) => l.item === mid.r.config.inv || l.item.id === mid.r.config.inv.id);
      const structUsd = share((l) => SIZER_STRUCTURES.some((e) => e.id === l.item.id));
      const batKwh = guideBatteryUsdPerKwh();
      const onInv = guideCheapestInverter("red");
      const hibInv = guideCheapestInverter("resp");
      const first = systems[0], last = systems[systems.length - 1];
      const perKwp = (x) => (x.r.total * (1 + SIZER_INSTALL)) / x.r.kwp;
      return `
      <p>Antes de pedir presupuestos conviene tener un orden de magnitud. Lo calculamos con <a href="#configurator">Diseñá tu sistema</a>, que arma el sistema con equipos reales del catálogo de AURYX y sus precios en pesos con IVA (precios al ${guideToday()}, dólar de referencia ${fmtARS(USD_ARS_RATE)}).</p>

      <h2>Precio de un sistema on-grid según tu consumo</h2>
      <p>Sistemas conectados a la red, sin baterías, para ahorrar alrededor del 70 % de la factura en el AMBA. Incluyen paneles, inversor y estructura para techo de chapa. La instalación se estima en un ${guideNum(SIZER_INSTALL * 100)} % del valor de los equipos e incluye mano de obra, cableado y protecciones.</p>
      ${guideTable(["Consumo mensual", "Potencia", "Paneles", "Equipos", "Instalación", "Total"], rows, "Precios orientativos en pesos, con IVA. Calculados con el dimensionador.")}
      <p>El costo por kWp baja a medida que el sistema crece: el inversor y la instalación se reparten entre más paneles. En esta tabla va de ${fmtARS(perKwp(first) * USD_ARS_RATE)} por kWp en el sistema más chico a ${fmtARS(perKwp(last) * USD_ARS_RATE)} por kWp en el más grande.</p>

      <h2>En qué se va la plata</h2>
      <p>Para el sistema de ${guideNum(mid.c)} kWh por mes (${guideNum(mid.r.kwp, 2)} kWp), el total se reparte así:</p>
      <ul class="legal-list">
        <li><strong>Paneles:</strong> ${pct(panelUsd)}.</li>
        <li><strong>Inversor:</strong> ${pct(invUsd)}.</li>
        <li><strong>Estructura:</strong> ${pct(structUsd)}.</li>
        <li><strong>Instalación, cableado y protecciones:</strong> ${pct(mid.r.total * SIZER_INSTALL)}.</li>
      </ul>
      <p>El inversor pesa mucho en los sistemas chicos: un inversor de 5 kW cuesta parecido aunque le conectes 3 paneles o 10. Por eso, si pensás ampliar el sistema más adelante, conviene elegir desde el principio un inversor que acepte la potencia final.</p>

      <h2>Cuánto suman las baterías</h2>
      <p>Si querés respaldo ante cortes de luz o un sistema aislado de la red, se suman dos costos:</p>
      <ul class="legal-list">
        <li><strong>Las baterías.</strong> En el catálogo, las baterías de litio (LiFePO4) cuestan alrededor de <strong>${guideArs(batKwh)} por kWh</strong> (la mediana de los modelos que usa el dimensionador). Un banco de 5 kWh suma unos ${guideArs(batKwh * 5)} y uno de 10 kWh, unos ${guideArs(batKwh * 10)}, antes de instalación.</li>
        <li><strong>Un inversor híbrido.</strong> El on-grid más económico del catálogo cuesta ${onInv ? guideArs(onInv.usd) : "-"} y el híbrido monofásico más económico, ${hibInv ? guideArs(hibInv.usd) : "-"}.</li>
      </ul>
      <p>Cuántos kWh de batería hacen falta depende de qué querés mantener andando durante un corte y por cuántas horas. El dimensionador lo calcula si elegís el objetivo <a href="#configurator">Respaldo ante cortes</a>.</p>

      <h2>Qué hace subir o bajar el precio</h2>
      <ul class="legal-list">
        <li><strong>El tipo de techo.</strong> La estructura para techo de chapa es la más simple; en losa hacen falta soportes inclinados y en suelo, una estructura completa. En el dimensionador, la estructura por panel cuesta ${SIZER_STRUCTURES.map((e) => `${guideArs(e.usd)} en ${e.name.split(" (")[0].replace(/^Techo de /, "").toLowerCase()}`).join(", ")}.</li>
        <li><strong>La marca de los equipos.</strong> Entre inversores de la misma potencia hay diferencias de más del doble de precio. Todos los del catálogo tienen la compatibilidad verificada; la diferencia está en garantía, monitoreo y funciones.</li>
        <li><strong>La conexión.</strong> Una instalación trifásica necesita un inversor trifásico, que suele costar más.</li>
        <li><strong>La distancia y el acceso.</strong> Techos altos, tramos largos de cable entre los paneles y el tablero o zonas alejadas suman horas de trabajo.</li>
        <li><strong>Los trámites.</strong> Para inyectar a la red con generación distribuida, la distribuidora tiene que aprobar la conexión y cambiar el medidor. Cada provincia tiene sus requisitos y costos.</li>
      </ul>

      <h2>¿Se recupera la inversión?</h2>
      <p>Depende sobre todo de cuánto pagás el kWh, y eso cambia mucho entre provincias. Lo calculamos con las tarifas vigentes en <a href="#guides/cuanto-se-ahorra-con-paneles-solares">Cuánto se ahorra con paneles solares</a>. Si todavía no sabés cuántos paneles necesitás, empezá por <a href="#guides/cuantos-paneles-solares-necesito">esta guía</a>.</p>

      <h2>Tu número exacto</h2>
      <p>Los precios cambian con el dólar y con cada lista de los fabricantes: tomalos como referencia, no como presupuesto. La tabla usa valores de referencia. Para tu caso, cargá tu consumo, tu zona y tu techo en <a href="#configurator">Diseñá tu sistema</a>: te arma el sistema con equipos compatibles, el precio y el retorno estimado, y lo podés mandar por WhatsApp para que lo revisemos con vos antes de comprar.</p>`;
    },
  },

  {
    slug: "inversor-on-grid-off-grid-o-hibrido",
    title: "Inversor on-grid, off-grid o híbrido: cuál te conviene",
    h1: "Inversor on-grid, off-grid o híbrido: cuál te conviene",
    description: "Diferencias entre inversores on-grid, off-grid e híbridos: cuál funciona en un corte de luz, cuál necesita baterías y cuál conviene según lo que buscás.",
    lead: "El inversor convierte la corriente continua de los paneles en la alterna que usa tu casa. El tipo que elijas define si el sistema sigue andando en un corte, si lleva baterías y cuánto cuesta.",
    date: "2026-10-21",
    needsCatalog: false,
    body() {
      const rows = [
        ["Conectado a la red", "Sí", "Sí", "No"],
        ["Funciona durante un corte", "No", "Sí, con la batería", "Sí"],
        ["Baterías", "No lleva", "Sí", "Sí, más capacidad"],
        ["Inyecta a la red", "Sí", "Sí", "No"],
        ["Costo", "El más bajo", "Medio a alto", "Alto"],
        ["Ideal para", "Bajar la factura", "Bajar la factura y tener respaldo", "Lugares sin red"],
      ];
      return `
      <p>Cuando se arma un sistema solar, el panel es lo más visible, pero la decisión que más cambia el resultado es el inversor. Hay tres tipos y cada uno resuelve un problema distinto.</p>

      <h2>Inversor on-grid: para bajar la factura</h2>
      <p>Se conecta a la red de la distribuidora y la energía de los paneles se consume primero en tu casa. Si generás más de lo que usás, el excedente va a la red; si generás menos, el resto lo tomás de la red como siempre. No lleva baterías, por eso es el sistema más económico y el que se recupera más rápido.</p>
      <p>Lo que mucha gente no sabe: <strong>un inversor on-grid se apaga cuando se corta la luz</strong>, aunque haya sol. Es una protección obligatoria (se llama anti-isla) para que los técnicos que trabajan en la línea no reciban tensión de tu instalación. Si lo que te preocupa son los cortes, un on-grid solo no lo resuelve.</p>
      <p>Para inyectar a la red con generación distribuida hay que hacer el trámite con la distribuidora, que aprueba la conexión y coloca un medidor bidireccional.</p>

      <h2>Inversor híbrido: ahorro más respaldo</h2>
      <p>Hace lo mismo que el on-grid y además maneja baterías. De día carga las baterías con el sol que sobra; de noche o durante un corte, alimenta la casa desde las baterías. Cuando se corta la luz, se desconecta de la red y sigue alimentando los circuitos que elegiste como críticos: la heladera, la iluminación, el router, una bomba de agua.</p>
      <p>Cuesta más que un on-grid por el inversor y, sobre todo, por las baterías. Pero si en tu zona los cortes son frecuentes, o trabajás desde tu casa, el respaldo vale tanto como el ahorro. Un dato importante: las baterías y el inversor tienen que ser compatibles en tensión y comunicación, no cualquier batería sirve con cualquier híbrido.</p>

      <h2>Inversor off-grid: cuando no hay red</h2>
      <p>Funciona aislado, sin conexión a la distribuidora. Toda la energía que usás sale de los paneles y de las baterías, así que el sistema se dimensiona con margen: más paneles para cargar las baterías en días nublados y más baterías para los días sin sol. Es la opción para un campo, una cabaña o cualquier lugar donde traer la red cuesta más que el sistema.</p>
      <p>Para usos chicos (iluminación, una bomba, equipos de 12 o 24 V) existe una versión más simple: un regulador de carga con baterías, sin inversor, todo en corriente continua.</p>

      <h2>Comparación rápida</h2>
      ${guideTable(["", "On-grid", "Híbrido", "Off-grid"], rows)}

      <h2>Cómo elegir</h2>
      <ul class="legal-list">
        <li><strong>Si tenés red y querés pagar menos de luz:</strong> on-grid. Es el que se recupera más rápido.</li>
        <li><strong>Si tenés red pero sufrís cortes:</strong> híbrido. Podés empezar con una batería chica y sumar más después, si el inversor y la batería lo permiten.</li>
        <li><strong>Si no tenés red o traerla es muy caro:</strong> off-grid.</li>
      </ul>

      <h2>Monofásico o trifásico</h2>
      <p>El inversor tiene que coincidir con tu conexión. La mayoría de las casas tienen conexión monofásica (220 V) y usan un inversor monofásico. Si tu casa o tu negocio tiene conexión trifásica (380 V), conviene un inversor trifásico, que reparte la energía entre las tres fases. Lo ves en la factura o en el tablero.</p>

      <h2>Qué mirar en la hoja de datos</h2>
      <ul class="legal-list">
        <li><strong>Potencia nominal (kW):</strong> la potencia de corriente alterna que entrega. Se suele instalar algo más de potencia en paneles que en el inversor (relación DC/AC de 1,1 a 1,3) porque los paneles rara vez entregan el 100 %.</li>
        <li><strong>Tensión máxima de entrada:</strong> la tensión de los paneles en serie no la puede superar nunca, ni en la mañana más fría del año.</li>
        <li><strong>Rango de MPPT:</strong> la ventana de tensión en la que el inversor aprovecha al máximo los paneles.</li>
        <li><strong>Corriente por MPPT:</strong> tiene que aceptar la corriente de los paneles, que en los modelos grandes supera los 13 A.</li>
        <li><strong>En híbridos, la tensión de batería:</strong> baja tensión (48 V) o alta tensión. Define qué baterías podés usar.</li>
      </ul>
      <p>Estos cruces son los que verifica el configurador de AURYX: con el <a href="#configurator/paso-a-paso">paso a paso</a> elegís panel, inversor y batería y te dice si son compatibles antes de comprar.</p>

      <h2>Probalo con tu consumo</h2>
      <p>En <a href="#configurator">Diseñá tu sistema</a> elegís qué buscás (bajar la factura, respaldo ante cortes o autonomía total) y el dimensionador elige el tipo de inversor, la cantidad de paneles y, si hacen falta, las baterías. Si todavía no sabés tu consumo, calculalo con la <a href="#calculators/consumo">calculadora de consumo</a>.</p>`;
    },
  },

  {
    slug: "cuanto-se-ahorra-con-paneles-solares",
    title: "Cuánto se ahorra con paneles solares (tarifas 2026)",
    h1: "Cuánto se ahorra con paneles solares con las tarifas vigentes",
    description: "Ahorro mensual, porcentaje de la factura y recupero de un sistema solar en CABA, Córdoba, Mendoza y más provincias, con las tarifas de luz vigentes.",
    lead: "Con el mismo sistema solar se ahorra muy distinto según la provincia, porque el precio de la luz cambia mucho entre distribuidoras. Calculamos el ahorro y el recupero con las tarifas vigentes.",
    date: "2026-10-21",
    needsCatalog: true,
    body() {
      const cons = 400;
      const list = guideSavingsRows(cons);
      const years = (roi) => (roi.payback === null ? `más de ${SIZER_YEARS} años` : `${guideNum(roi.payback, 1)} años`);
      const rows = list.map((x) => [
        `${x.place}<small>${esc(x.distName)}</small>`, fmtARS(x.s.bill),
        `<strong>${fmtARS(x.s.monthly)}</strong>`, `${guideNum(x.roi.billPct)} %`, `${guideArs(x.roi.invest)}<small>${guideNum(x.r.kwp, 2)} kWp</small>`, years(x.roi),
        `${x.roi.roi > 0 ? "+" : ""}${guideNum(x.roi.roi)} %`,
      ]);
      const byPayback = [...list].filter((x) => x.roi.payback !== null).sort((a, b) => a.roi.payback - b.roi.payback);
      const best = byPayback[0], worst = byPayback[byPayback.length - 1];
      const official = list.filter((x) => x.s.official);
      const cuadros = [...new Set(official.map((x) => `${x.distName} (${x.s.ct.source.replace(/\s*\([^)]*\)\s*$/, "")})`))];
      return `
      <p>"Con paneles solares ahorrás un 70 %" es una frase que se repite mucho, pero el ahorro en plata depende de cuánto pagás cada kWh, y eso varía muchísimo de una provincia a otra. Para que los números sean reales, los calculamos con las tarifas vigentes de cada distribuidora y con sistemas armados con el dimensionador.</p>

      <h2>De dónde salen las tarifas</h2>
      <p>Usuario residencial <strong>sin subsidio</strong>, con impuestos. Para ${cuadros.length ? cuadros.map(esc).join("; ") : "las distribuidoras con cuadro oficial cargado"}, usamos el cuadro tarifario oficial. Para el resto, las facturas que publica el <strong>Observatorio de Tarifas y Subsidios del IIEP-UBA</strong> (informe de ${TARIFF_DATE}). Son los mismos datos de la <a href="#calculators/costo">calculadora de costo de la luz</a>.</p>

      <h2>El ahorro, provincia por provincia</h2>
      <p>Una casa que consume ${guideNum(cons)} kWh por mes, con un sistema on-grid (sin baterías) armado por el dimensionador para cada zona, con equipos y precios del catálogo de AURYX al ${guideToday()}.</p>
      ${guideTable(["Zona", "Factura sin paneles", "Ahorro por mes", "De la factura", "Inversión y sistema", "Recupero", `Retorno a ${SIZER_YEARS} años`], rows,
        `Factura mensual con impuestos. Inversión: equipos más ${guideNum(SIZER_INSTALL * 100)} % de instalación. Retorno en dólares constantes.`)}
      ${best && worst && best !== worst ? `<p>La diferencia es grande: en ${best.place} el sistema se recupera en ${years(best.roi)} y en ${worst.place}, en ${years(worst.roi)}. Donde la luz es más cara, cada kWh que generás vale más.</p>` : ""}

      <h2>Cómo lo calculamos</h2>
      <ul class="legal-list">
        <li><strong>Generación:</strong> potencia del sistema × horas de sol pico de la zona × 30 días × ${guideNum(SIZER_PR, 1)} de rendimiento.</li>
        <li><strong>Lo que consumís en el momento</strong> (suponemos el ${guideNum(SIZER_SELF_USE.red * 100)} % de lo generado) deja de comprarse: la factura se recalcula con el consumo más bajo, con su categoría y su precio.</li>
        <li><strong>Lo que inyectás a la red</strong> se acredita a un valor mucho menor: lo estimamos en un ${guideNum(SIZER_INJECT_VALUE * 100)} % del precio que pagás.</li>
        <li><strong>El cargo fijo</strong> se sigue pagando: el ahorro nunca llega al 100 % de la factura.</li>
        <li><strong>El recupero</strong> descuenta una pérdida de generación del ${guideNum(SIZER_DEGRADATION * 100, 1)} % por año y la reposición del inversor en el año ${SIZER_REPLACE_YEAR}. Está en dólares constantes: si las tarifas suben más que el dólar, el recupero es más corto.</li>
      </ul>

      <h2>Ahorro mensual o porcentaje: qué mirar</h2>
      <p>El porcentaje de la factura sirve para comparar sistemas en una misma casa, pero lo que paga la inversión son los pesos ahorrados por mes. Un 70 % de una factura barata es menos plata que un 50 % de una cara. Por eso dos vecinos con el mismo sistema, uno con subsidio y otro sin, tienen recuperos muy distintos: <strong>con subsidio el kWh es más barato y el sistema tarda más en pagarse</strong>.</p>

      <h2>Lo que la tabla no incluye</h2>
      <ul class="legal-list">
        <li><strong>Subsidios.</strong> Si tu hogar tiene tarifa subsidiada, tu ahorro es menor.</li>
        <li><strong>Baterías.</strong> Un sistema híbrido cuesta más y se recupera más lento; lo que compra es respaldo ante cortes. Los precios están en <a href="#guides/cuanto-cuesta-instalar-paneles-solares">Cuánto cuesta instalar paneles solares</a>.</li>
        <li><strong>Tasas municipales.</strong> Cambian según la localidad y pueden mover la factura unos puntos.</li>
        <li><strong>Sombras y orientación.</strong> La tabla supone paneles mirando al norte y sin sombras.</li>
        <li><strong>La regulación de cada provincia</strong> para inyectar a la red: no todas las distribuidoras pagan igual el excedente.</li>
      </ul>

      <h2>Hacé la cuenta con tu factura</h2>
      <p>La forma más precisa es partir de tu consumo real: <a href="#calculators/costo">calculá tu factura</a> con tu distribuidora, mirá cuánto bajaría con la <a href="#calculators/ahorro">calculadora de ahorro</a> y armá el sistema con su recupero en <a href="#configurator">Diseñá tu sistema</a>. Si después querés que lo revisemos, lo mandás por WhatsApp desde ahí mismo.</p>`;
    },
  },
];

const guideBySlug = (slug) => GUIDES.find((g) => g.slug === slug) || null;
const guideNeedsCatalog = (slug) => !!(guideBySlug(slug) || {}).needsCatalog;

/* Fecha "21 de octubre de 2026" desde "2026-10-21" (sin zona horaria: es una fecha de calendario). */
function guideDateText(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* Datos estructurados de la guía (Article). */
function guideArticleLd(slug) {
  const g = guideBySlug(slug);
  return {
    "@type": "Article",
    headline: g.h1,
    description: g.description,
    datePublished: g.date,
    dateModified: g.date,
    inLanguage: "es-AR",
    author: { "@id": "https://auryx.com.ar/#organizacion" },
    publisher: { "@id": "https://auryx.com.ar/#organizacion" },
    image: "https://auryx.com.ar/og-image.png",
  };
}

function guidesIndexHTML() {
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">Guías de energía solar</h1>
      <p class="page-lead">Cuántos paneles necesitás, cuánto cuesta un sistema, qué inversor elegir y cuánto se ahorra, con números calculados y fuentes.</p>
    </div>
    <ol class="guide-list">
      ${GUIDES.map((g) => `
      <li><a href="#guides/${g.slug}" class="guide-card">
        <strong>${g.h1}</strong>
        <span>${g.description}</span>
        <span class="link-arrow">Leer la guía ${icon("arrow-right")}</span>
      </a></li>`).join("")}
    </ol>
  </div>`;
}

function renderGuides(state) {
  const g = guideBySlug(state.guideSlug);
  if (!g) return guidesIndexHTML();
  const body = g.body();
  const minutes = Math.max(1, Math.round(body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200));
  const others = GUIDES.filter((x) => x !== g);
  return `
  <article class="wrap page guide">
    <nav class="crumbs" aria-label="Estás en"><a href="#guides">Guías</a>${icon("caret-right")}<span aria-current="page">${g.h1}</span></nav>
    <header class="page-head guide-head">
      <h1 class="page-title">${g.h1}</h1>
      <p class="page-lead">${g.lead}</p>
      <p class="guide-meta xsmall dim"><time datetime="${g.date}">${guideDateText(g.date)}</time><span>${minutes} min de lectura</span></p>
    </header>
    <div class="prose guide-body">${body}</div>
    <aside class="guide-more" aria-labelledby="guide-more-title">
      <h2 id="guide-more-title">Más guías</h2>
      <ul>${others.map((x) => `<li><a href="#guides/${x.slug}" class="link-arrow">${x.h1} ${icon("arrow-right")}</a></li>`).join("")}</ul>
    </aside>
    ${techNoteHTML("tech-note-spaced")}
  </article>`;
}
