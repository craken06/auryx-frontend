/* AURYX: página "Para instaladores" (/para-instaladores/). Qué ofrece AURYX a instaladores y electricistas y
   cómo darse de alta por WhatsApp (Ref: <origen>-INSTALADORES, ver lib/analytics.js). Las condiciones
   comerciales (precios de gremio, referidos) NO se publican: se consultan por WhatsApp.
   Link en el pie, no en la home. Depende de: utils/format.js. */

const INSTALLER_WA_TEXT = "Hola, soy instalador/a o electricista y quiero darme de alta en AURYX.";

/* Lo que usa un instalador en su trabajo, con el link a cada herramienta. */
const INSTALLER_TOOLS = [
  { icon: "lightning", title: "Dimensionador", href: "#configurator", link: "Abrir el dimensionador",
    text: "Cargás consumo, zona, techo y objetivo del cliente. Te devuelve paneles, inversor y baterías, los strings por MPPT, el armado del banco y el retorno estimado." },
  { icon: "check-circle", title: "Configurador con chequeo de compatibilidad", href: "#configurator/paso-a-paso", link: "Armar paso a paso",
    text: "Elegís cada equipo y te avisa si no es compatible: tensión de los strings en frío contra la máxima del inversor, corriente por MPPT y tensión de las baterías, antes de comprar." },
  { icon: "share-network", title: "Sistemas para compartir", href: "#configurator", link: "Probar con un sistema",
    text: "Cada resultado se comparte con un link: se lo mandás a tu cliente para que lo vea o nos lo mandás por WhatsApp para cotizarlo." },
  { icon: "calculator", title: "Calculadoras para explicarle al cliente", href: "#calculators", link: "Ver las calculadoras",
    text: "Consumo, costo de la luz por distribuidora, ahorro y orientación, cada una con la cuenta a la vista." },
];

const INSTALLER_STEPS = [
  { title: "Escribinos por WhatsApp", text: "Contanos quién sos, en qué zona trabajás y qué tipo de instalaciones hacés." },
  { title: "Te pasamos las condiciones", text: "Precios de gremio y beneficios por referidos, según tu caso." },
  { title: "Empezás a trabajar", text: "Armás los sistemas con las herramientas y nos pasás los pedidos o los clientes." },
];

const INSTALLER_FAQS = [
  { q: "¿Las herramientas tienen costo?", a: "No. El dimensionador, el configurador y las calculadoras son gratis y se usan sin registrarse." },
  { q: "¿Cuáles son los precios de gremio?", a: "No los publicamos: te los pasamos según tu caso. Consultá las condiciones por WhatsApp." },
  { q: "¿Cómo funcionan los referidos?", a: "Si nos recomendás clientes, sumás beneficios. Consultá las condiciones por WhatsApp." },
  { q: "¿Tengo que ser matriculado?", a: "Las instalaciones las tiene que hacer personal matriculado, y el proyecto lo tiene que firmar un profesional. Contanos tu situación cuando nos escribas." },
];

function installerWaButton(extraClass = "") {
  return `<a class="btn btn-primary btn-lg${extraClass ? ` ${extraClass}` : ""}" href="${whatsappLink(INSTALLER_WA_TEXT)}" target="_blank" rel="noopener" data-context="instaladores">${icon("whatsapp-logo", "", "fill")} Darme de alta por WhatsApp</a>`;
}

function renderInstallers() {
  return `
  <div class="wrap page installers">
    <div class="page-head inst-head">
      <h1 class="page-title">Para instaladores y electricistas</h1>
      <p class="page-lead">Herramientas para dimensionar y verificar sistemas solares, precios de gremio y beneficios por referidos.</p>
      <div class="hero-ctas">${installerWaButton()}<a href="#configurator" class="btn btn-secondary btn-lg">Probar el dimensionador</a></div>
    </div>

    <section class="inst-section" aria-labelledby="inst-tools-title">
      <h2 id="inst-tools-title" class="band-title">Herramientas de trabajo</h2>
      <p class="inst-lead">Lo que usamos para armar cada sistema, a disposición tuya y de tus clientes.</p>
      <ul class="inst-tools">
        ${INSTALLER_TOOLS.map((t) => `
        <li>
          <span class="system-icon">${icon(t.icon)}</span>
          <div>
            <h3>${t.title}</h3>
            <p>${t.text}</p>
            <a href="${t.href}" class="link-arrow">${t.link} ${icon("arrow-right")}</a>
          </div>
        </li>`).join("")}
      </ul>
    </section>

    <section class="inst-section inst-terms" aria-labelledby="inst-terms-title">
      <div>
        <h2 id="inst-terms-title" class="band-title">Precios de gremio y referidos</h2>
        <p>Si instalás o hacés obras eléctricas, tenés condiciones especiales para comprar los equipos. Y si nos recomendás clientes, también sumás beneficios.</p>
        <p class="inst-note">${icon("chat-circle-text")}<span>Consultá las condiciones por WhatsApp.</span></p>
      </div>
    </section>

    <section class="inst-section" aria-labelledby="inst-steps-title">
      <h2 id="inst-steps-title" class="band-title">Cómo darte de alta</h2>
      <ol class="process-steps inst-steps">
        ${INSTALLER_STEPS.map((s, i) => `
        <li>
          <span class="process-num" aria-hidden="true">${i + 1}</span>
          <div><h3>${s.title}</h3><p>${s.text}</p></div>
        </li>`).join("")}
      </ol>
      <div class="hero-ctas hero-ctas-spaced">${installerWaButton()}</div>
    </section>

    <section class="inst-section" aria-labelledby="inst-faq-title">
      <h2 id="inst-faq-title" class="band-title">Preguntas frecuentes</h2>
      <div class="faq inst-faq">${INSTALLER_FAQS.map((f) => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join("")}</div>
    </section>
  </div>`;
}
