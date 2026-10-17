/* AURYX: Términos y condiciones y Política de privacidad. Depende de: config.js (WHATSAPP_*), utils/format.js. */

const LEGAL_UPDATED = "15 de octubre de 2026";

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
    "Reglas de uso del sitio, de las compras online y de las cotizaciones.",
    [
      { h: "1. Quiénes somos", p: [
        "Auryx es un proyecto en etapa de lanzamiento que ofrece componentes y herramientas para armar sistemas fotovoltaicos en Argentina. Todavía no está constituido como sociedad: el sitio lo opera su equipo fundador. Cuando eso cambie, actualizaremos esta sección con la razón social y el CUIT.",
        `Podés contactarnos por WhatsApp al ${WHATSAPP_DISPLAY} o desde la página de <a href="#contact">Contacto</a>.`,
      ] },
      { h: "2. Qué hace este sitio", p: [
        "El sitio permite explorar un catálogo, verificar la compatibilidad eléctrica entre componentes, usar calculadoras y comprar: podés pagar el carrito online con Mercado Pago o pedir una cotización.",
        "Pedir una cotización no te obliga a comprar, y de nuestro lado no implica una oferta firme hasta que te enviemos la cotización final.",
      ] },
      { h: "3. Compras online y pagos", p: [
        "Al pagar, el precio de cada producto es el que calcula el sitio en ese momento, en pesos y con IVA incluido; los productos cargados en dólares se convierten con la cotización vigente del día. El pago lo procesa Mercado Pago: Auryx no accede a los datos de tu tarjeta.",
        "El precio no incluye envío ni instalación, que se coordinan y presupuestan por separado. Antes de despachar revisamos el pedido; si encontramos un problema de stock o de compatibilidad te contactamos y, si no hay una alternativa que aceptes, te devolvemos el importe completo.",
        "Recibís un número de pedido para consultar su estado. Si el pago queda pendiente o es rechazado, el pedido no se procesa.",
      ] },
      { h: "4. Derecho de arrepentimiento", p: [
        "Como consumidor, podés revocar la compra dentro de los 10 días corridos desde que recibís el producto o se celebra el contrato, lo último que ocurra, sin dar motivos (art. 34 de la Ley 24.240 y art. 1110 del Código Civil y Comercial). Podés hacerlo desde el <a href=\"#arrepentimiento\">Botón de arrepentimiento</a>, por WhatsApp o desde Contacto. El producto tiene que devolverse en el estado en que lo recibiste; los gastos de devolución corren por nuestra cuenta.",
      ] },
      { h: "5. Precios", p: [
        "Los precios publicados incluyen IVA y son de referencia: pueden cambiar sin aviso y están sujetos a confirmación de stock, envío e instalación en la cotización final.",
        "Los precios se muestran en pesos argentinos y en dólares estadounidenses. La conversión entre ambas monedas usa una cotización de referencia del sitio y puede no coincidir con la que se aplique al concretar la operación.",
      ] },
      { h: "6. Información técnica", p: [
        "La verificación de compatibilidad y las calculadoras son herramientas orientativas. Usan datos de las hojas de datos de los fabricantes y simplifican el cálculo: corrigen la tensión por la temperatura mínima indicada, pero no consideran sombras, pérdidas de cableado ni normativa local.",
        "No reemplazan el proyecto de un profesional matriculado. Antes de comprar, el dimensionamiento final se confirma con vos, y la instalación debe realizarla personal matriculado. No nos responsabilizamos por decisiones tomadas únicamente con el resultado de estas herramientas.",
      ] },
      { h: "7. Disponibilidad y errores", p: [
        "Hacemos lo posible para que la información sea correcta, pero puede haber errores en precios, especificaciones o disponibilidad. Si detectamos un error en un pedido, te lo vamos a informar antes de avanzar.",
        "El sitio puede interrumpirse o modificarse en cualquier momento, por ejemplo por mantenimiento.",
      ] },
      { h: "8. Propiedad intelectual", p: [
        "Las marcas y nombres de productos pertenecen a sus respectivos titulares y se usan solo para identificar los productos. El diseño, los textos y el código del sitio son de Auryx; no pueden copiarse ni reutilizarse sin autorización.",
      ] },
      { h: "9. Limitación de responsabilidad", p: [
        "En la medida permitida por la ley, Auryx no responde por daños indirectos derivados del uso del sitio o de la información publicada. Esto no limita los derechos que la ley le reconoce a los consumidores.",
      ] },
      { h: "10. Ley aplicable", p: [
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
        "Solo los que vos nos das de forma voluntaria. Si nos escribís: nombre, email, teléfono (opcional) y el contenido de tu mensaje.",
        "Si comprás, necesitás ingresar con tu cuenta de Google (más adelante, también de Microsoft). De esa cuenta guardamos tu nombre, tu email y tu foto de perfil. Además guardamos el teléfono, la dirección de entrega y los datos de facturación (DNI o CUIT y nombre o razón social) que cargues, y el historial de tus pedidos: productos, montos, estado del pago que nos informa Mercado Pago y estado de la entrega.",
        "No hace falta crear una cuenta para ver el sitio, usar las calculadoras o pedir una cotización por WhatsApp. Nunca recibimos tu contraseña de Google o Microsoft.",
      ] },
      { h: "2. Para qué los usamos", p: [
        "Únicamente para responder tu consulta, preparar tu cotización o gestionar tu pedido (pago, envío, instalación, facturación y garantía). Tu cuenta sirve para identificarte, mostrarte tus pedidos en <a href=\"#mis-pedidos\">Mis pedidos</a> y, si lo elegís, completar el checkout con los datos guardados de tu última compra.",
        "No los vendemos ni los usamos para publicidad de terceros. Podés ver y cambiar tu teléfono, tu dirección y tus datos de facturación en <a href=\"#mi-cuenta\">Mis datos</a>.",
      ] },
      { h: "3. Dónde se guardan", p: [
        "Los mensajes del formulario de contacto, los datos de tu cuenta y los pedidos se guardan en nuestra base de datos, alojada en un proveedor de servicios en la nube, con acceso restringido al equipo de Auryx. Los conservamos mientras sean necesarios para atender tu consulta o pedido y para cumplir obligaciones legales (por ejemplo, de facturación y garantía).",
        "Los pagos los procesa Mercado Pago, que trata los datos de pago según sus propias políticas; nosotros sólo recibimos el estado del pago y su número de operación.",
        `Si pedís la cotización por WhatsApp, se abre WhatsApp con el mensaje ya escrito y recién se envía cuando vos lo confirmás. WhatsApp pertenece a Meta y trata los datos según sus propias políticas. Lo mismo vale si nos escribís directamente al ${WHATSAPP_DISPLAY}.`,
      ] },
      { h: "4. Datos guardados en tu navegador", p: [
        "Para que el sitio funcione mejor, guardamos en tu dispositivo (almacenamiento local del navegador) tu carrito, la moneda elegida y el tema claro u oscuro. Esa información no se envía a ningún servidor y podés borrarla desde la configuración de tu navegador o vaciando el carrito.",
        "Si ingresás con tu cuenta, también guardamos ahí la sesión (una clave que te identifica ante nuestro servidor durante 30 días) y una copia de tus datos para mostrarlos en el menú. Se borra al tocar \"Cerrar sesión\".",
        "No usamos cookies de seguimiento ni herramientas de analítica.",
      ] },
      { h: "5. Servicios de terceros", p: [
        "Para mostrar el sitio cargamos tipografías e íconos desde jsDelivr y algunas imágenes desde Unsplash. Al hacerlo, esos servicios pueden registrar tu dirección IP como en cualquier descarga de recursos web.",
        "El botón \"Continuar con Google\" lo carga Google solo cuando vas a ingresar; Google trata esos datos según sus propias políticas y nos confirma tu nombre, email y foto.",
      ] },
      { h: "6. Tus derechos", p: [
        "Según la Ley 25.326 de Protección de los Datos Personales, podés pedir acceso, rectificación o supresión de tus datos escribiéndonos por WhatsApp o desde la página de <a href=\"#contact\">Contacto</a>.",
        "La Agencia de Acceso a la Información Pública (AAIP) es el órgano de control de la Ley 25.326 y atiende denuncias y reclamos relacionados con el incumplimiento de las normas de protección de datos personales.",
      ] },
      { h: "7. Cambios", p: [
        "Si cambiamos cómo tratamos los datos, actualizaremos esta página antes de hacerlo.",
      ] },
    ]
  );
}

function renderRevocation(state) {
  const r = state.revocation || {};
  const errors = r.errors || {};
  const fieldError = (k) => errors[k] ? `<p id="rev-${k}-error" class="field-error">${errors[k]}</p>` : "";
  const invalid = (k) => errors[k] ? `aria-invalid="true" aria-describedby="rev-${k}-error"` : "";
  const field = (k, label, attrs = "") => `
    <div class="field">
      <label class="field-label" for="rev-${k}">${label}</label>
      <input id="rev-${k}" class="input" name="${k}" value="${esc(r[k] || "")}" data-bind="revocation" data-field="${k}" ${attrs} ${invalid(k)} />
      ${fieldError(k)}
    </div>`;
  return `
  <div class="wrap page">
    <div class="contact-grid">
      <div class="page-head" style="margin-bottom:0;align-content:start">
        <h1 class="page-title">Botón de arrepentimiento</h1>
        <p class="page-lead">Podés revocar tu compra dentro de los 10 días corridos desde que recibiste el producto, sin dar motivos.</p>
        <p class="muted small">Te respondemos por email con un código de trámite y coordinamos la devolución. Los gastos de devolución corren por nuestra cuenta. Ley 24.240, art. 34, y Resolución 424/2020.</p>
        <a href="${whatsappLink("Hola, quiero arrepentirme de mi compra. Pedido: ")}" class="btn btn-secondary" target="_blank" rel="noopener">${icon("whatsapp-logo", "", "fill")} Pedirlo por WhatsApp</a>
      </div>
      ${r.done
        ? `<div class="panel panel-pad"><p class="form-status tone-ok" role="status">Recibimos tu pedido de arrepentimiento. Te escribimos por email dentro de las 24 h hábiles con el código de trámite.</p></div>`
        : `<form class="form panel panel-pad" data-form="revocation" novalidate>
        <div class="form-row">${field("name", "Nombre y apellido", 'autocomplete="name"')}${field("email", "Email", 'type="email" autocomplete="email" spellcheck="false"')}</div>
        <div class="form-row">${field("orderId", "Número de pedido", 'autocomplete="off" spellcheck="false"')}${field("phone", 'Teléfono <span class="unit">(opcional)</span>', 'type="tel" autocomplete="tel"')}</div>
        <div class="field">
          <label class="field-label" for="rev-reason">Comentarios <span class="unit">(opcional)</span></label>
          <textarea id="rev-reason" class="textarea" name="reason" rows="4" data-bind="revocation" data-field="reason">${esc(r.reason || "")}</textarea>
        </div>
        ${r.status ? `<p class="form-status tone-${r.status.tone}" role="status">${esc(r.status.text)}</p>` : ""}
        <button type="submit" class="btn btn-primary btn-lg">Enviar pedido de arrepentimiento</button>
      </form>`}
    </div>
  </div>`;
}
