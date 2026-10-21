/* AURYX: texto de cada calculadora (para qué sirve, cómo se usa, ejemplos y preguntas frecuentes).
   Se muestra debajo de la calculadora y lo usa scripts/build-seo-pages.mjs para el título, la descripción
   y los datos estructurados (FAQPage) de cada página. Los ejemplos se calculan con las mismas funciones de
   la calculadora: si cambian las tarifas o una fórmula, los números del texto cambian solos.
   Depende de: views/calculators/*.js, data/tariffs.js, views/sizer.js (SIZER_LOCATIONS, SIZER_PR), utils/format.js. */

/* Producción mensual de un sistema en una zona: kWp × horas de sol pico × 30 días × rendimiento (como el dimensionador). */
const calcSolarKwh = (kwp, hsp) => Math.round(kwp * hsp * 30 * SIZER_PR);

const CALC_CONTENT = {
  consumo: {
    title: "Calculadora de consumo eléctrico de tus equipos",
    h1: "Calculadora de consumo eléctrico",
    lead: "Cuánta energía usan tus equipos por día, mes y año, en kWh.",
    description: "Calculá cuántos kWh consumen tus equipos por día, mes y año: heladera, aire acondicionado, termotanque y más. Gratis y sin registro.",
    intro: `Sirve para saber cuánta energía usa tu casa o tu negocio antes de mirar la factura, o para entender de dónde sale lo que pagás. Es el primer dato para dimensionar un sistema solar: los paneles se eligen según los kWh que tenés que cubrir, no según la cantidad de equipos.`,
    steps: [
      "Cargá cada equipo con su potencia en watts. Figura en la etiqueta o en el manual; si dice kW, multiplicá por 1.000.",
      "Indicá cuántos hay de ese tipo y cuántas horas por día funcionan. Para la heladera, que corta y arranca, contá unas 8 horas.",
      "Agregá o quitá equipos hasta tener todo lo que usás. El resultado se actualiza solo.",
      "Compará el consumo mensual con el de tu factura. Si tu factura es bimestral, dividila por 2.",
    ],
    examples() {
      const base = [{ power: 150, qty: 1, hours: 8 }, { power: 500, qty: 1, hours: 1 }];
      const depto = consumptionTotals([...base, { power: 10, qty: 8, hours: 5 }, { power: 100, qty: 1, hours: 4 }, { power: 60, qty: 1, hours: 6 }]);
      const tucuman = consumptionTotals([...base, { power: 10, qty: 10, hours: 5 }, { power: 100, qty: 2, hours: 4 }, { power: 1300, qty: 2, hours: 6 }]);
      const neuquen = consumptionTotals([...base, { power: 10, qty: 10, hours: 5 }, { power: 100, qty: 1, hours: 4 }, { power: 1500, qty: 1, hours: 3 }]);
      return [
        { city: "Departamento en Caballito, CABA", text: `Heladera (150 W, 8 h), lavarropas (500 W, 1 h), 8 lámparas LED de 10 W (5 h), un televisor de 100 W (4 h) y una notebook de 60 W (6 h): <strong>${depto.monthly} por mes</strong>, ${depto.daily} por día.` },
        { city: "Casa en San Miguel de Tucumán, en verano", text: `Lo mismo que una casa chica, más dos aires acondicionados de 1.300 W prendidos 6 horas: <strong>${tucuman.monthly} por mes</strong>. Los aires explican casi todo el consumo.` },
        { city: "Casa en Neuquén con termotanque eléctrico", text: `Una casa de cuatro personas con termotanque eléctrico de 1.500 W que calienta 3 horas por día: <strong>${neuquen.monthly} por mes</strong>, ${neuquen.yearly} por año.` },
      ];
    },
    faqs: [
      { q: "¿Por qué el resultado no coincide con mi factura?", a: "Porque la potencia de la etiqueta es la máxima y muchos equipos no la usan todo el tiempo (heladeras, aires con inverter). Además hay consumos que se olvidan, como el stand-by o la bomba de agua. Usá la factura como referencia y ajustá las horas." },
      { q: "¿Qué diferencia hay entre kW y kWh?", a: "El kW mide potencia: cuánta energía usa un equipo en un instante. El kWh mide energía: potencia por tiempo. Un equipo de 1.000 W funcionando una hora consume 1 kWh. La factura cobra kWh." },
      { q: "¿Cuántas horas cuento para la heladera?", a: "El motor corta y arranca, así que funciona una parte del día. Como punto de partida se usan unas 8 horas a la potencia de la etiqueta. Si tu heladera tiene la etiqueta de eficiencia, ahí figura el consumo anual en kWh." },
      { q: "¿Para qué me sirve saber el consumo si quiero paneles solares?", a: `Con el consumo mensual se calcula cuántos paneles hacen falta. Podés pasarlo directo a <a href="#configurator">Diseñá tu sistema</a>, que elige paneles, inversor y baterías para ese consumo.` },
      { q: "¿Se guardan los equipos que cargo?", a: "No se guardan en ningún servidor. Si querés volver a verlos o mandárselos a alguien, usá el link para compartir el resultado." },
    ],
    next: { href: "#calculators/costo", text: "Ahora calculá cuánto te cuesta ese consumo" },
  },

  costo: {
    title: "Calculadora de costo de la luz por distribuidora",
    h1: "Calculadora de costo de la luz",
    lead: "Cuánto pagás de luz por mes según tu consumo, tu provincia y tu distribuidora, con impuestos.",
    description: "Calculá tu factura de luz con impuestos según tu consumo y tu distribuidora: Edenor, Edesur, EPEC, EDEMSA y más. Tarifas vigentes, sin subsidio.",
    intro: `Sirve para estimar cuánto vas a pagar de luz con un consumo dado y para entender por qué el mismo consumo cuesta tan distinto en cada provincia. Calcula la factura mensual de un usuario residencial sin subsidio, con cargo fijo, energía e impuestos.`,
    steps: [
      "Escribí tu consumo mensual en kWh. Está en tu factura; si es bimestral, dividilo por 2.",
      "Elegí tu provincia y tu distribuidora.",
      "Mirá el total por mes y el desglose: cargo fijo, energía e impuestos, o la estimación si todavía no cargamos el cuadro oficial de esa empresa.",
      "Usá el precio efectivo del kWh en la calculadora de ahorro para saber cuánto bajaría tu factura con paneles.",
    ],
    examples() {
      const caba = costTotals({ kwh: 300, province: "caba", dist: "edenor" });
      const cba = costTotals({ kwh: 300, province: "cordoba", dist: "epec" });
      const mza = costTotals({ kwh: 300, province: "mendoza", dist: "edemsa" });
      const line = (t) => `<strong>${fmtARS(t.bill)} por mes</strong>, un kWh efectivo de ${fmtARS(t.perKwh)}`;
      return [
        { city: "CABA, Edenor, 300 kWh/mes", text: `${line(caba)}. Con el cuadro tarifario oficial queda en la categoría de ${caba.category}.` },
        { city: "Córdoba, EPEC, 300 kWh/mes", text: `${line(cba)}. Es una estimación con los datos del Observatorio de Tarifas IIEP-UBA.` },
        { city: "Mendoza, EDEMSA, 300 kWh/mes", text: `${line(mza)}. EDEMSA categoriza por consumo bimestral: 300 kWh por mes son 600 por bimestre.` },
      ];
    },
    faqs: [
      { q: "¿De dónde salen las tarifas?", a: `De los cuadros tarifarios oficiales de cada distribuidora cuando los tenemos cargados (Edenor, Edesur, las de la provincia de Buenos Aires y EDEMSA) y, para el resto, de las facturas que publica el Observatorio de Tarifas y Subsidios del IIEP-UBA (${TARIFF_DATE}).` },
      { q: "¿Incluye subsidios?", a: "No. Calcula la tarifa de un usuario residencial sin subsidio. Si tenés subsidio, tu factura va a ser menor." },
      { q: "¿Por qué el mismo consumo cuesta tan distinto según la provincia?", a: "Cada distribuidora tiene su propio costo de distribución y cada provincia y municipio cobra sus propios impuestos y tasas, además del IVA. La energía mayorista es parecida en todo el país; la diferencia está en lo demás." },
      { q: "¿Qué es el precio efectivo del kWh?", a: "Es la factura total dividida por los kWh que consumiste. Incluye el cargo fijo y los impuestos, así que es más alto que el precio de la energía del cuadro tarifario." },
      { q: "¿Mi provincia no tiene cuadro oficial: qué tan precisa es la estimación?", a: "Sirve para tener el orden de magnitud. Se interpola entre las facturas a 150, 265, 600 y 1.000 kWh que publica el IIEP-UBA, con la parte de impuestos medida en su informe. Tu factura puede variar por categoría y tasas municipales." },
    ],
    next: { href: "#calculators/ahorro", text: "Calculá cuánto ahorrarías con paneles solares" },
  },

  ahorro: {
    title: "Calculadora de ahorro con paneles solares",
    h1: "Calculadora de ahorro con paneles solares",
    lead: "Cuánto dejás de pagar de luz con la energía que generan tus paneles.",
    description: "Calculá cuánto ahorrás por mes y por año con paneles solares según tu consumo, la energía que generan y el precio del kWh de tu distribuidora.",
    intro: `Sirve para estimar cuánto baja tu factura cuando parte de tu consumo lo cubren los paneles. Cada kWh que generás y usás es uno que no le comprás a la distribuidora. Lo que generás de más no se cuenta como ahorro, porque se paga mucho menos o nada.`,
    steps: [
      "Cargá tu consumo mensual en kWh (está en la factura).",
      "Cargá la producción solar mensual. Si no la sabés: potencia del sistema en kW × horas de sol pico de tu zona × 30 días.",
      "Cargá el precio del kWh. El más realista es el precio efectivo que da la calculadora de costo para tu distribuidora.",
      "Mirá el ahorro por mes, por año y qué parte de tu consumo cubre el sistema.",
    ],
    examples() {
      const loc = (v) => sizerLocation(v);
      const ex = (label, province, dist, hsp) => {
        const kwh = 300;
        const price = costTotals({ kwh, province, dist }).perKwh;
        const solar = calcSolarKwh(2, Number(hsp));
        const t = savingsTotals({ currentKwh: kwh, solarKwh: solar, energyPrice: price });
        return { city: label, text: `Consumo de 300 kWh/mes y un sistema de 2 kWp con ${fmtNum(Number(hsp), 1)} horas de sol pico (${solar} kWh/mes) a ${fmtARS(price)} el kWh: <strong>${t.monthly} por mes</strong>, ${t.yearly} por año, ${t.pct} del consumo cubierto.` };
      };
      return [
        ex("Córdoba, EPEC", "cordoba", "epec", loc("5.0").value),
        ex("Mendoza, EDEMSA", "mendoza", "edemsa", loc("5.8").value),
        ex("CABA, Edenor", "caba", "edenor", loc("4.4").value),
      ];
    },
    faqs: [
      { q: "¿Por qué el ahorro es tan distinto entre provincias?", a: "Porque el ahorro es energía por precio, y el precio del kWh cambia mucho entre distribuidoras. Con el mismo sistema, donde la luz es más cara se ahorra más plata." },
      { q: "¿Se cuenta la energía que inyecto a la red?", a: "No. La calculadora solo cuenta la energía solar que reemplaza tu consumo. Con generación distribuida el excedente se acredita a un precio mucho menor que el que pagás, y no todas las distribuidoras lo tienen implementado." },
      { q: "¿El ahorro real es igual al de la calculadora?", a: "Suele ser algo menor: el cargo fijo lo seguís pagando y, si bajás de categoría, cambia el precio del kWh. Es una estimación para comparar opciones, no una factura." },
      { q: "¿Cuántas horas de sol pico tiene mi zona?", a: "Como referencia, unas 4,4 en el AMBA, 5,0 en Córdoba y 5,8 en Mendoza y San Juan, en promedio anual. El dimensionador usa esos valores por zona." },
      { q: "¿Cuánto cuesta el sistema y en cuánto tiempo se recupera?", a: `<a href="#configurator">Diseñá tu sistema</a> arma el sistema con equipos y precios reales y calcula el ahorro, el recupero y el retorno a 25 años.` },
    ],
    next: { href: "#configurator", text: "Armá el sistema y mirá en cuánto se recupera" },
  },

  orientacion: {
    title: "Orientación e inclinación óptima de paneles solares",
    h1: "Calculadora de orientación e inclinación de paneles solares",
    lead: "Hacia dónde y con qué ángulo conviene instalar los paneles según tu latitud.",
    description: "Calculá la inclinación y la orientación óptimas de tus paneles solares según tu latitud, con ejemplos para ciudades de Argentina. Gratis y sin registro.",
    intro: `Sirve para saber hacia dónde mirar y cuánto inclinar los paneles para generar la mayor cantidad de energía en el año. En Argentina, como en todo el hemisferio sur, el sol recorre el cielo por el norte: los paneles van orientados al norte.`,
    steps: [
      "Escribí la latitud de tu ubicación (negativa en el hemisferio sur) o tocá «Usar mi ubicación».",
      "Mirá la inclinación recomendada y la orientación. Como regla, la inclinación óptima es parecida a la latitud.",
      "En modo manual podés mover el ángulo y ver cómo queda el panel de costado y en perspectiva.",
      "Si tu techo ya tiene una inclinación, comparala con la recomendada: unos grados de diferencia cambian poco la energía anual.",
    ],
    examples() {
      const ex = (city, lat) => {
        const t = orientationTotals({ lat });
        return { city: `${city} (latitud ${fmtNum(lat, 1)})`, text: `Inclinación recomendada de <strong>${t.angle}°</strong>, mirando al ${t.azimuth.split(" ")[0].toLowerCase()}.` };
      };
      return [ex("Salta", -24.8), ex("Buenos Aires", -34.6), ex("Ushuaia", -54.8)];
    },
    faqs: [
      { q: "¿Qué pasa si mi techo mira al este o al oeste?", a: "Se puede instalar igual, pero genera menos: alrededor de un 15 % menos en el año que mirando al norte (es el valor que usa el dimensionador). Al sur no conviene en Argentina." },
      { q: "¿Conviene instalar los paneles planos, sin inclinación?", a: "No. Generan menos en invierno y no se limpian con la lluvia. Aun cerca del ecuador se recomiendan al menos 10°." },
      { q: "¿La inclinación cambia en invierno y en verano?", a: "Sí: en invierno conviene más inclinación y en verano menos. La que da la calculadora es la mejor para el año entero, que es lo que importa en una instalación fija." },
      { q: "¿Cómo sé mi latitud?", a: "Tocá «Usar mi ubicación» y el navegador la completa. También la podés ver en cualquier mapa: es el primer número de las coordenadas." },
      { q: "¿Alcanza con esta regla para hacer el proyecto?", a: "Es un punto de partida. Un proyecto real tiene en cuenta sombras, la estructura del techo y datos de radiación del lugar. Lo revisa un profesional matriculado." },
    ],
    next: { href: "#configurator", text: "Diseñá tu sistema con tu consumo y tu zona" },
  },
};

/* Bloque de texto que va debajo de la calculadora. */
function calcContentHTML(id) {
  const c = CALC_CONTENT[id];
  if (!c) return "";
  return `<section class="calc-guide" aria-labelledby="calc-guide-title">
    <div class="calc-guide-main prose">
      <h2 id="calc-guide-title">Para qué sirve</h2>
      <p>${c.intro}</p>
      <h2>Cómo se usa</h2>
      <ol class="calc-steps">${c.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <h2>Ejemplos</h2>
      <div class="calc-examples">${c.examples().map((e) => `<div class="calc-example"><h3>${e.city}</h3><p>${e.text}</p></div>`).join("")}</div>
      <p class="xsmall dim">Calculados con esta misma calculadora. Resultados orientativos.</p>
      <h2>Preguntas frecuentes</h2>
      <div class="faq">${c.faqs.map((f) => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join("")}</div>
      <p><a href="${c.next.href}" class="link-arrow">${c.next.text} ${icon("arrow-right")}</a></p>
    </div>
  </section>`;
}

/* Datos estructurados FAQPage (texto plano, sin los links de las respuestas). */
function calcFaqLd(id) {
  const text = (s) => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return {
    "@type": "FAQPage",
    mainEntity: CALC_CONTENT[id].faqs.map((f) => ({ "@type": "Question", name: text(f.q), acceptedAnswer: { "@type": "Answer", text: text(f.a) } })),
  };
}
