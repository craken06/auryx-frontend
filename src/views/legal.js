/* AURYX: Términos y condiciones, Política de privacidad y Botón de arrepentimiento.
   Depende de: config.js (WHATSAPP_*), utils/format.js, views/footer.js (sellerInfo, contactEmailLinkHTML,
   CONSUMER_COMPLAINTS_URL). */

const LEGAL_UPDATED = "17 de octubre de 2026";

/* Misma fórmula del plazo en todo el sitio (términos, formulario y carrito). */
const REVOCATION_TERM = "10 días corridos desde que recibís el producto";

/* Leyenda obligatoria de la AAIP (Disposición 10/2008), texto oficial. */
const AAIP_LEGEND = "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.";

/* Canales para escribirnos: email (si está cargado), WhatsApp y la página de Contacto. */
function legalContactText() {
  const email = contactEmailLinkHTML();
  return `${email ? `por email a ${email}, ` : ""}por WhatsApp al ${WHATSAPP_DISPLAY} o desde la página de <a href="#contact">Contacto</a>`;
}

/* "Nombre, CUIT …, con domicilio en …" con los datos cargados del vendedor ("" si no hay nombre). */
function sellerSentence() {
  const s = sellerInfo();
  if (!s.name) return "";
  return `${esc(s.name)}${s.cuit ? `, CUIT <span class="mono">${esc(s.cuit)}</span>` : ""}${s.address ? `, con domicilio en ${esc(s.address)}` : ""}`;
}

/* Cada sección: h (título), p (párrafos), ul (lista opcional) y after (párrafos después de la lista). */
function legalPage(title, lead, sections) {
  const paras = (list) => (list || []).map((t) => `<p>${t}</p>`).join("");
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">${title}</h1>
      <p class="page-lead">${lead}</p>
      <p class="xsmall dim">Última actualización: ${LEGAL_UPDATED}</p>
    </div>
    <div class="prose legal">
      ${sections.map((s) => `<h2>${s.h}</h2>${paras(s.p)}${s.ul ? `<ul class="legal-list">${s.ul.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}${paras(s.after)}`).join("")}
      <p><a href="#" class="link-arrow">${icon("arrow-left")} Volver al inicio</a></p>
    </div>
  </div>`;
}

function renderTerms() {
  const seller = sellerSentence();
  return legalPage(
    "Términos y condiciones",
    "Reglas de uso del sitio y de las compras online.",
    [
      { h: "1. Quiénes somos", p: [
        seller
          ? `Este sitio y las ventas que se hacen en él están a cargo de ${seller}, que opera con el nombre comercial AURYX.`
          : "AURYX ofrece componentes y herramientas para armar sistemas fotovoltaicos en Argentina.",
        `Podés contactarnos ${legalContactText()}.`,
      ] },
      { h: "2. Qué hace este sitio", p: [
        "El sitio permite explorar un catálogo, verificar la compatibilidad eléctrica entre componentes, usar calculadoras y comprar online con los medios de pago que el sitio ofrezca al confirmar el pedido: Mercado Pago y, cuando esté habilitada, transferencia bancaria.",
      ] },
      { h: "3. Precios", p: [
        "Los precios publicados son finales: incluyen IVA y todos los impuestos. Se muestran en pesos argentinos y en dólares estadounidenses; los productos cargados en dólares se convierten a pesos con la cotización de referencia del día, que figura al pie del sitio.",
        "El precio que pagás es el que figura en el carrito al confirmar el pedido. El envío y la instalación no están incluidos: se presupuestan aparte y no se cobran sin que los aceptes.",
      ] },
      { h: "4. Compras online y pagos", p: [
        "Para comprar online necesitás ingresar con tu cuenta de Google. Los pagos con Mercado Pago los procesa Mercado Pago, con los medios que ofrezca en ese momento: AURYX no ve ni guarda los datos de tu tarjeta.",
        "Si pagás por transferencia bancaria (cuando el sitio lo ofrezca), te mostramos los datos de la cuenta y el plazo para transferir. El pedido se confirma cuando verificamos la acreditación; si no se paga dentro del plazo, se cancela solo y sin costo.",
        "Al confirmar recibís un código de pedido (por ejemplo, AX-7K2M9P) para consultar su estado en <a href=\"#mis-pedidos\">Mis pedidos</a>. Si el pago queda pendiente o es rechazado, el pedido no se procesa.",
        "Antes de despachar revisamos el pedido. Si encontramos un problema de stock o de compatibilidad te contactamos y, si no aceptás una alternativa, te devolvemos el importe completo.",
      ] },
      { h: "5. Entrega", p: [
        "Al comprar elegís cómo recibir el pedido:",
      ], ul: [
        "<strong>Envío</strong> a la dirección que indiques. El costo y el plazo dependen del destino y del tamaño del pedido: te los informamos antes de despachar y, si no los aceptás, podés cancelar la compra sin cargo.",
        "<strong>Retiro</strong>: coordinamos con vos el lugar, el día y el horario.",
      ], after: [
        "Dentro de las 48 h hábiles de acreditado el pago te contactamos para coordinar la entrega. Al recibir, revisá que el embalaje esté en buen estado y avisanos enseguida si algo llegó dañado.",
      ] },
      { h: "6. Derecho de arrepentimiento", p: [
        `Como consumidor, podés revocar la compra dentro de los ${REVOCATION_TERM}, sin dar motivos y sin costo (art. 34 de la Ley 24.240 y arts. 1110 y siguientes del Código Civil y Comercial).`,
        `Podés hacerlo desde el <a href="#arrepentimiento">Botón de arrepentimiento</a>, que no pide registrarte ni ingresar, o ${legalContactText()}. Dentro de las 24 h te respondemos por el mismo medio, con el código de tu solicitud.`,
        "El producto tiene que devolverse sin uso y en el estado en que lo recibiste. Los gastos de devolución corren por nuestra cuenta, y te reintegramos el importe completo por el mismo medio de pago.",
      ] },
      { h: "7. Garantía", p: [
        "Los productos nuevos tienen una garantía legal de 6 meses desde la entrega (art. 11 de la Ley 24.240), o la del fabricante si es mayor. La gestionamos nosotros: escribinos y coordinamos la revisión, la reparación o el cambio del producto.",
        "La garantía no cubre fallas causadas por una instalación incorrecta, por usar el equipo fuera de las condiciones de su hoja de datos o por golpes y manipulación posteriores a la entrega.",
      ] },
      { h: "8. Información técnica", p: [
        "La verificación de compatibilidad y las calculadoras son herramientas orientativas. Usan datos de las hojas de datos de los fabricantes y simplifican el cálculo: corrigen la tensión por la temperatura mínima indicada, pero no consideran sombras, pérdidas de cableado ni normativa local.",
        "No reemplazan el proyecto de un profesional matriculado. Antes de despachar revisamos con vos el dimensionamiento, y la instalación debe realizarla personal matriculado.",
      ] },
      { h: "9. Disponibilidad y errores", p: [
        "Hacemos lo posible para que la información sea correcta, pero puede haber errores en especificaciones o disponibilidad. Si detectamos un error en un pedido, te lo informamos antes de avanzar y podés cancelarlo con la devolución completa de lo pagado.",
        "El sitio puede interrumpirse o modificarse en cualquier momento, por ejemplo por mantenimiento.",
      ] },
      { h: "10. Propiedad intelectual", p: [
        "Las marcas y nombres de productos pertenecen a sus respectivos titulares y se usan solo para identificar los productos. El diseño, los textos y el código del sitio son de AURYX; no pueden copiarse ni reutilizarse sin autorización.",
      ] },
      { h: "11. Responsabilidad", p: [
        "En la medida permitida por la ley, AURYX no responde por daños indirectos derivados del uso del sitio o de la información publicada. Nada de esto limita los derechos que la ley les reconoce a los consumidores.",
      ] },
      { h: "12. Reclamos y ley aplicable", p: [
        `Si tenés un problema con una compra, escribinos ${legalContactText()}. También podés hacer un reclamo en la <a href="${CONSUMER_COMPLAINTS_URL}" target="_blank" rel="noopener">Ventanilla Única Federal de Defensa de las y los Consumidores</a>.`,
        "Estos términos se rigen por las leyes de la República Argentina. Podemos actualizarlos; la versión vigente es la publicada en esta página, con su fecha, y cada compra se rige por la versión vigente al momento de hacerla.",
      ] },
    ]
  );
}

function renderPrivacy() {
  const seller = sellerSentence();
  return legalPage(
    "Política de privacidad",
    "Qué datos usamos, para qué, dónde se guardan y cómo podés ejercer tus derechos.",
    [
      { h: "1. Responsable", p: [
        `El responsable de los datos que se recolectan en este sitio es ${seller || "AURYX"}. Para cualquier consulta sobre tus datos podés escribirnos ${legalContactText()}.`,
      ] },
      { h: "2. Qué datos tratamos y para qué", p: [
        "Solo los que necesitamos para cada cosa que hacés en el sitio:",
      ], ul: [
        "<strong>Tu cuenta.</strong> Si ingresás con Google, recibimos tu nombre, tu email y tu foto de perfil. Los usamos para identificarte y mostrarte tus pedidos. Nunca recibimos tu contraseña de Google.",
        "<strong>Tus pedidos.</strong> Productos, montos, teléfono, dirección de entrega, datos de facturación (DNI o CUIT y nombre o razón social, si los cargás), estado del pago que nos informa Mercado Pago, el comprobante si pagás por transferencia y estado de la entrega. Los usamos para gestionar la compra, el envío, la facturación y la garantía.",
        "<strong>Tus mensajes.</strong> Si nos escribís por el formulario de contacto o el Botón de arrepentimiento: nombre, email, teléfono y lo que nos cuentes. Los usamos para responderte.",
        "<strong>Analítica, solo si la aceptás.</strong> Páginas que visitás, tipo de dispositivo y navegador, ubicación aproximada según tu dirección IP y cómo interactuás con el sitio (clics y desplazamiento). La usamos para entender qué funciona y mejorar el sitio.",
      ], after: [
        "Darnos tus datos es voluntario. Sin los de la cuenta y el pedido no podemos procesar una compra online, pero podés ver el sitio, usar las calculadoras y escribirnos por WhatsApp sin registrarte.",
        "No vendemos tus datos ni los usamos para publicidad de terceros. Podés ver y cambiar tu teléfono, tu dirección y tus datos de facturación en <a href=\"#mi-cuenta\">Mis datos</a>.",
      ] },
      { h: "3. Pagos", p: [
        "Los pagos los procesa Mercado Pago, que trata los datos de pago según sus propias políticas. El sitio nunca ve ni guarda los datos de tu tarjeta: solo recibimos el estado del pago y su número de operación.",
      ] },
      { h: "4. Dónde se guardan y con quién los compartimos", p: [
        "Para funcionar, el sitio usa proveedores que alojan o procesan datos por cuenta nuestra, con servidores fuera de la Argentina (principalmente en Estados Unidos):",
      ], ul: [
        "<strong>GitHub Pages</strong> publica el sitio.",
        "<strong>Render</strong> aloja nuestro servidor, que recibe las cuentas, los pedidos y los mensajes.",
        "<strong>Neon</strong> aloja la base de datos donde se guardan.",
        "<strong>Google</strong> gestiona el ingreso con tu cuenta y, si la aceptás, la analítica de Google Analytics.",
        "<strong>Microsoft Clarity</strong> mide, si la aceptás, cómo se usa cada página.",
        "<strong>Mercado Pago</strong> procesa los pagos.",
        "<strong>jsDelivr</strong> y <strong>Unsplash</strong> sirven tipografías, íconos e imágenes; como en cualquier descarga web, pueden registrar tu dirección IP.",
      ], after: [
        "Esto implica una transferencia internacional de datos. Al usar el sitio y enviarnos tus datos prestás tu consentimiento para esa transferencia (art. 12 de la Ley 25.326). Les pedimos a estos proveedores medidas de seguridad adecuadas, y tratan los datos solo para prestarnos su servicio.",
        "Si nos escribís por WhatsApp, el mensaje lo trata Meta según sus propias políticas. Los botones de WhatsApp abren la conversación con el texto ya escrito, y recién se envía cuando vos lo confirmás.",
        "Fuera de estos casos, solo compartimos datos si una autoridad competente lo exige por ley.",
      ] },
      { h: "5. Cookies y almacenamiento en tu navegador", p: [
        "Para que el sitio funcione guardamos en tu dispositivo el carrito, la moneda, el tema claro u oscuro y tu decisión sobre las cookies. Si ingresás con tu cuenta, también guardamos la sesión (una clave que te identifica ante nuestro servidor durante 30 días) y una copia de tus datos para mostrarlos en el menú; se borran al tocar “Cerrar sesión”. Estos datos son necesarios y no se usan para seguirte.",
        "Las cookies de analítica (Google Analytics y Microsoft Clarity) son opcionales: solo se activan si tocás “Aceptar” en el aviso de cookies. Si elegís “Solo necesarias”, no se cargan. Podés cambiar tu decisión cuando quieras desde “Configurar cookies”, al pie de cada página.",
        "Además, cuando ingresás con Google o pagás con Mercado Pago, esos servicios usan sus propias cookies según sus políticas.",
      ] },
      { h: "6. Cuánto tiempo los guardamos", p: [
        "Los datos de tu cuenta, mientras la uses o hasta que nos pidas borrarla. Los de pedidos y facturación, durante el plazo que exigen las normas contables, fiscales y de defensa del consumidor (hasta 10 años). Los mensajes, hasta 2 años desde la última conversación. Los de analítica, como máximo 14 meses.",
      ] },
      { h: "7. Seguridad", p: [
        "Los datos viajan cifrados (HTTPS) y el acceso a la base de datos está restringido al equipo de AURYX. Ninguna medida es infalible: si detectamos un incidente que afecte tus datos, te lo vamos a informar.",
      ] },
      { h: "8. Tus derechos", p: [
        "Según la Ley 25.326 de Protección de los Datos Personales, podés pedir gratis el acceso a tus datos, su rectificación, actualización o supresión, y retirar en cualquier momento el consentimiento que diste (por ejemplo, el de la analítica).",
        `Para hacerlo, escribinos ${legalContactText()} con tu nombre y el email de tu cuenta. Respondemos los pedidos de acceso dentro de los 10 días corridos, y los de rectificación, actualización o supresión dentro de los 5 días hábiles.`,
        AAIP_LEGEND,
      ] },
      { h: "9. Cambios", p: [
        "Si cambiamos cómo tratamos los datos, actualizamos esta página antes de hacerlo, con su nueva fecha.",
      ] },
    ]
  );
}

function renderRevocation(state) {
  const r = state.revocation || {};
  const errors = r.errors || {};
  const sending = !!state.revocationSending;
  const fieldError = (k) => errors[k] ? `<p id="rev-${k}-error" class="field-error">${esc(errors[k])}</p>` : "";
  const describedBy = (k, hint) => {
    const ids = [hint ? `rev-${k}-hint` : "", errors[k] ? `rev-${k}-error` : ""].filter(Boolean).join(" ");
    return `${errors[k] ? 'aria-invalid="true" ' : ""}${ids ? `aria-describedby="${ids}"` : ""}`;
  };
  const field = (k, label, attrs = "", hint = "") => `
    <div class="field">
      <label class="field-label" for="rev-${k}">${label}</label>
      <input id="rev-${k}" class="input" name="${k}" value="${esc(r[k] || "")}" data-bind="revocation" data-field="${k}" ${attrs} ${describedBy(k, hint)} />
      ${hint ? `<p id="rev-${k}-hint" class="field-hint">${hint}</p>` : ""}
      ${fieldError(k)}
    </div>`;
  return `
  <div class="wrap page">
    <div class="contact-grid">
      <div class="page-head page-head-aside">
        <h1 class="page-title">Botón de arrepentimiento</h1>
        <p class="page-lead">Podés revocar tu compra dentro de los ${REVOCATION_TERM}, sin dar motivos y sin costo. No hace falta ingresar a tu cuenta.</p>
        <p class="muted small">Dentro de las 24 h te respondemos por el mismo medio, con el código de tu solicitud, y coordinamos la devolución. Los gastos de devolución corren por nuestra cuenta. Ley 24.240, art. 34, y Disposición 954/2025.</p>
        <div><a href="${whatsappLink("Hola, quiero arrepentirme de mi compra. Pedido: ")}" class="btn btn-secondary" target="_blank" rel="noopener" data-context="arrepentimiento">${icon("whatsapp-logo", "", "fill")} Pedirlo por WhatsApp</a></div>
      </div>
      ${r.done
        ? `<div class="panel panel-pad"><p class="form-status tone-ok" role="status">${r.code
            ? `Recibimos tu solicitud de arrepentimiento. El código de tu solicitud es <strong class="mono">${esc(r.code)}</strong>: te lo mandamos también por email. Dentro de las 24 h te escribimos para coordinar la devolución.`
            : "Recibimos tu solicitud de arrepentimiento. Dentro de las 24 h te respondemos por el mismo medio, con el código de tu solicitud."}</p></div>`
        : `<form class="form panel panel-pad" data-form="revocation" novalidate${sending ? ' aria-busy="true"' : ""}>
        ${field("orderId", "Código de pedido", 'autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="AX-…"', "Está en el email de la compra y en Mis pedidos.")}
        ${field("name", "Nombre y apellido", 'autocomplete="name"')}
        <fieldset class="field">
          <legend class="field-label">¿Cómo te respondemos?</legend>
          <p class="field-hint">Completá el email, el WhatsApp o los dos.</p>
          <div class="form-row">${field("email", "Email", 'type="email" autocomplete="email" spellcheck="false" placeholder="nombre@ejemplo.com"')}${field("phone", "WhatsApp", 'type="tel" autocomplete="tel" inputmode="tel" placeholder="11 5555 5555"')}</div>
        </fieldset>
        <div class="field">
          <label class="field-label" for="rev-reason">Motivo <span class="unit">(opcional)</span></label>
          <textarea id="rev-reason" class="textarea" name="reason" rows="4" data-bind="revocation" data-field="reason">${esc(r.reason || "")}</textarea>
        </div>
        ${r.status ? `<p class="form-status tone-${esc(r.status.tone)}" role="${r.status.tone === "bad" ? "alert" : "status"}">${esc(r.status.text)}</p>` : ""}
        <button type="submit" class="btn btn-primary btn-lg" ${sending ? "disabled" : ""}>${sending ? "Enviando…" : "Enviar solicitud"}</button>
      </form>`}
    </div>
  </div>`;
}
