/* AURYX: Términos y condiciones y Política de privacidad. Depende de: config.js (WHATSAPP_*), utils/format.js. */

const LEGAL_UPDATED = "1 de octubre de 2026";

function legalPage(title, lead, sections) {
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">${title}</h1>
      <p class="page-lead">${lead}</p>
      <p class="xsmall dim">Última actualización: ${LEGAL_UPDATED}</p>
    </div>
    <div class="prose legal">
      ${sections.map((s) => `<h2>${s.h}</h2>${s.p.map((t) => `<p>${t}</p>`).join("")}`).join("")}
      <p><a href="#" class="link-arrow">${icon("arrow-left")} Volver al inicio</a></p>
    </div>
  </div>`;
}

function renderTerms() {
  return legalPage(
    "Términos y condiciones",
    "Reglas de uso del sitio y de cómo funcionan las cotizaciones.",
    [
      { h: "1. Quiénes somos", p: [
        "Auryx es un proyecto en etapa de lanzamiento que ofrece componentes y herramientas para armar sistemas fotovoltaicos en Argentina. Todavía no está constituido como sociedad: el sitio lo opera su equipo fundador. Cuando eso cambie, actualizaremos esta sección con la razón social y el CUIT.",
        `Podés contactarnos por WhatsApp al ${WHATSAPP_DISPLAY} o desde la página de <a href="#contact">Contacto</a>.`,
      ] },
      { h: "2. Qué hace este sitio", p: [
        "El sitio permite explorar un catálogo, verificar la compatibilidad eléctrica entre componentes, usar calculadoras y armar un pedido de cotización. <strong>No es una tienda con pago online:</strong> el carrito termina en una solicitud de cotización y no se realiza ninguna compra hasta que se confirme por separado con vos.",
        "Pedir una cotización no te obliga a comprar, y de nuestro lado no implica una oferta firme hasta que te enviemos la cotización final.",
      ] },
      { h: "3. Precios", p: [
        "Los precios publicados incluyen IVA y son de referencia: pueden cambiar sin aviso y están sujetos a confirmación de stock, envío e instalación en la cotización final.",
        "Los precios se muestran en pesos argentinos y en dólares estadounidenses. La conversión entre ambas monedas usa una cotización de referencia del sitio y puede no coincidir con la que se aplique al concretar la operación.",
      ] },
      { h: "4. Información técnica", p: [
        "La verificación de compatibilidad y las calculadoras son herramientas orientativas. Usan datos de las hojas de datos de los fabricantes y simplifican el cálculo: por ejemplo, no aplican corrección por temperatura, sombras, pérdidas de cableado ni normativa local.",
        "No reemplazan el proyecto de un profesional matriculado. Antes de comprar, el dimensionamiento final se confirma con vos, y la instalación debe realizarla personal matriculado. No nos responsabilizamos por decisiones tomadas únicamente con el resultado de estas herramientas.",
      ] },
      { h: "5. Disponibilidad y errores", p: [
        "Hacemos lo posible para que la información sea correcta, pero puede haber errores en precios, especificaciones o disponibilidad. Si detectamos un error en un pedido, te lo vamos a informar antes de avanzar.",
        "El sitio puede interrumpirse o modificarse en cualquier momento, por ejemplo por mantenimiento.",
      ] },
      { h: "6. Propiedad intelectual", p: [
        "Las marcas y nombres de productos pertenecen a sus respectivos titulares y se usan solo para identificar los productos. El diseño, los textos y el código del sitio son de Auryx; no pueden copiarse ni reutilizarse sin autorización.",
      ] },
      { h: "7. Limitación de responsabilidad", p: [
        "En la medida permitida por la ley, Auryx no responde por daños indirectos derivados del uso del sitio o de la información publicada. Esto no limita los derechos que la ley le reconoce a los consumidores.",
      ] },
      { h: "8. Ley aplicable", p: [
        "Estos términos se rigen por las leyes de la República Argentina. Podemos actualizarlos; la versión vigente es la publicada en esta página, con su fecha de actualización.",
      ] },
    ]
  );
}

function renderPrivacy() {
  return legalPage(
    "Política de privacidad",
    "Qué datos usamos, para qué y cómo podés ejercer tus derechos.",
    [
      { h: "1. Qué datos tratamos", p: [
        "Solo los que vos escribís de forma voluntaria: nombre, email, teléfono (opcional) y el contenido de tu mensaje o de tu pedido de cotización. No hace falta crear una cuenta para usar el sitio.",
      ] },
      { h: "2. Para qué los usamos", p: [
        "Únicamente para responder tu consulta o preparar tu cotización. No los vendemos ni los usamos para publicidad de terceros.",
      ] },
      { h: "3. Cómo se envían", p: [
        `Hoy el sitio no guarda tus mensajes en un servidor propio. Al enviar el formulario o pedir una cotización, se abre WhatsApp (o tu programa de correo) con el mensaje ya escrito, y recién se envía cuando vos lo confirmás. WhatsApp pertenece a Meta y trata los datos según sus propias políticas. Lo mismo vale si nos escribís directamente al ${WHATSAPP_DISPLAY}.`,
      ] },
      { h: "4. Datos guardados en tu navegador", p: [
        "Para que el sitio funcione mejor, guardamos en tu dispositivo (almacenamiento local del navegador) tu carrito, la moneda elegida y el tema claro u oscuro. Esa información no se envía a ningún servidor y podés borrarla desde la configuración de tu navegador o vaciando el carrito.",
        "No usamos cookies de seguimiento ni herramientas de analítica.",
      ] },
      { h: "5. Servicios de terceros", p: [
        "Para mostrar el sitio cargamos tipografías e íconos desde jsDelivr y algunas imágenes desde Unsplash. Al hacerlo, esos servicios pueden registrar tu dirección IP como en cualquier descarga de recursos web.",
      ] },
      { h: "6. Tus derechos", p: [
        "Según la Ley 25.326 de Protección de los Datos Personales, podés pedir acceso, rectificación o supresión de tus datos escribiéndonos por WhatsApp o desde la página de <a href=\"#contact\">Contacto</a>.",
        "La Agencia de Acceso a la Información Pública (AAIP) es el órgano de control de la Ley 25.326 y atiende denuncias y reclamos relacionados con el incumplimiento de las normas de protección de datos personales.",
      ] },
      { h: "7. Cambios", p: [
        "Si cambiamos cómo tratamos los datos (por ejemplo, al incorporar pedidos online), actualizaremos esta página antes de hacerlo.",
      ] },
    ]
  );
}
