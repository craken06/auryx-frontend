/* AURYX: páginas de Información y Contacto. Depende de: utils/format.js, utils/calculatorHelpers.js, config.js (CONTACT_EMAIL). */

const INFO_IMAGE = "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&q=70&auto=format&fit=crop";

function renderInfo() {
  return `
  <div class="wrap page">
    <div class="page-head">
      <h1 class="page-title">Cómo trabajamos</h1>
      <p class="page-lead">Auryx vende y dimensiona sistemas fotovoltaicos para casas y PyMEs en Argentina.</p>
    </div>
    <div class="info-hero">
      <img src="${INFO_IMAGE}" srcset="${[640, 1000, 1600].map((w) => `${INFO_IMAGE.replace(/w=\d+/, `w=${w}`)} ${w}w`).join(", ")}" sizes="(min-width: 1240px) 1176px, 100vw" alt="Hileras de paneles solares sobre césped bajo un cielo con nubes" width="1600" height="1067" loading="lazy" decoding="async" />
    </div>
    <div class="info-cols">
      <div class="prose">
        <p>La idea es simple: que puedas armar tu sistema solar como armarías una PC. Elegís cada componente y la plataforma te muestra, en el momento, si funciona con lo que ya elegiste.</p>
        <h2>Datos de fabricante</h2>
        <p>Cada producto tiene las especificaciones de su hoja de datos: tensión de circuito abierto, corriente de cortocircuito, potencia máxima, rangos de tensión de batería. Con esos valores calcula el motor de compatibilidad.</p>
        <h2>Qué verifica el configurador</h2>
        <p>Que la tensión del string no supere el máximo del inversor o regulador, que la corriente entre en cada MPPT, que la potencia FV esté dentro de lo admitido y que la batería trabaje en el rango de tensión del equipo. Si algo queda justo, te avisamos en lugar de bloquearlo.</p>
        <p>La tensión se verifica <strong>en frío</strong> (con la temperatura mínima del lugar), que es cuando los paneles dan más tensión, y la corriente contra el límite de cortocircuito de cada entrada. Los cables y protecciones de continua se controlan contra el string. No considera sombras, pérdidas de cableado ni normativa local.</p>
        <h2>Precios y compra</h2>
        <p>Los precios están en pesos y dólares, son finales e <strong>incluyen IVA</strong>. Podés pagar online con Mercado Pago o, si preferís, pedir una cotización por WhatsApp o por el formulario. Si pagás online, revisamos el pedido antes de despachar: si algo no cierra, te contactamos para ajustarlo o te devolvemos el dinero. En los dos casos coordinamos con vos el envío y la instalación.</p>
        <p>Más detalle en los <a href="#terms">Términos y condiciones</a> y la <a href="#privacy">Política de privacidad</a>.</p>
      </div>
      <div class="fact-list">
        <div class="fact">${icon("solar-panel")}<strong>Residencial y PyME</strong><p>Sistemas on-grid, híbridos con batería y autónomos en corriente continua.</p></div>
        <div class="fact">${icon("shield-check")}<strong>Compatibilidad verificada</strong><p>Tensión, corriente y potencia contra los límites reales de cada equipo.</p></div>
        <div class="fact">${icon("calculator")}<strong>Cuentas a la vista</strong><p>Las calculadoras muestran cada fórmula, para que sepas de dónde sale el resultado.</p></div>
        <a href="#contact" class="btn btn-primary btn-lg mt-1">Contacto</a>
      </div>
    </div>
    <section class="process process-compact" aria-labelledby="info-process-title">
      <h2 id="info-process-title" class="process-title">Qué pasa después de tu pedido</h2>
      ${processStepsHTML()}
    </section>
    ${techNoteHTML()}
  </div>`;
}

function renderContact(state) {
  const draft = state.contactDraft || {};
  const errors = state.contactErrors || {};
  const status = state.contactStatus;
  const fieldError = (k) => errors[k] ? `<p id="contact-${k}-error" class="field-error">${esc(errors[k])}</p>` : "";
  // El carrito arma el mensaje con quoteMessage(): solo en ese caso se avisa que el detalle ya está
  const fromCart = typeof draft.message === "string" && draft.message.startsWith("Hola, quiero pedir una cotización");
  const email = contactEmailLinkHTML();
  const invalid = (k) => errors[k] ? `aria-invalid="true" aria-describedby="contact-${k}-error"` : "";

  return `
  <div class="wrap page">
    <div class="contact-grid">
      <div class="page-head page-head-aside">
        <h1 class="page-title">Contacto</h1>
        <p class="page-lead">Contanos qué necesitás: una cotización, una consulta técnica o ayuda para elegir componentes.</p>
        ${fromCart ? `<p class="muted small">El detalle de tu carrito ya está en el mensaje.</p>` : ""}
        <div>
          <a href="${whatsappLink("Hola, tengo una consulta sobre un sistema solar.")}" class="btn btn-secondary" target="_blank" rel="noopener" data-context="contacto">${icon("whatsapp-logo", "", "fill")} Escribinos por WhatsApp</a>
          <p class="xsmall dim mt-1">${WHATSAPP_DISPLAY}${email ? ` · ${email}` : ""}</p>
        </div>
      </div>
      <form class="form panel panel-pad" data-form="contact" novalidate>
        <div class="form-row">
          <div class="field">
            <label class="field-label" for="contact-name">Nombre</label>
            <input id="contact-name" class="input" name="name" type="text" autocomplete="name" placeholder="Tu nombre…"
              value="${esc(draft.name || "")}" data-bind="contact" data-field="name" ${invalid("name")} />
            ${fieldError("name")}
          </div>
          <div class="field">
            <label class="field-label" for="contact-email">Email</label>
            <input id="contact-email" class="input" name="email" type="email" autocomplete="email" spellcheck="false"
              placeholder="nombre@ejemplo.com" value="${esc(draft.email || "")}" data-bind="contact" data-field="email" ${invalid("email")} />
            ${fieldError("email")}
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="contact-phone">Teléfono <span class="unit">(opcional)</span></label>
          <input id="contact-phone" class="input" name="tel" type="tel" autocomplete="tel" inputmode="tel" placeholder="11 5555 5555"
            value="${esc(draft.phone || "")}" data-bind="contact" data-field="phone" />
        </div>
        <div class="field">
          <label class="field-label" for="contact-message">Mensaje</label>
          <textarea id="contact-message" class="textarea" name="message" rows="6" placeholder="Contanos qué necesitás…"
            data-bind="contact" data-field="message" ${invalid("message")}>${esc(draft.message || "")}</textarea>
          ${fieldError("message")}
        </div>
        ${status ? `<p class="form-status tone-${esc(status.tone)}" role="${status.tone === "bad" ? "alert" : "status"}">${esc(status.text)}</p>` : ""}
        ${status && status.action ? `<a href="${esc(status.action.href)}" class="btn btn-secondary" target="_blank" rel="noopener" data-context="contacto-respaldo">${icon("whatsapp-logo", "", "fill")} ${esc(status.action.label)}</a>` : ""}
        <div class="hp-field" aria-hidden="true"><label for="contact-website">No completar</label>
          <input id="contact-website" name="website" tabindex="-1" autocomplete="off" data-bind="contact" data-field="website" /></div>
        <button type="submit" class="btn btn-primary btn-lg" ${state.contactSending ? "disabled" : ""}>${state.contactSending ? "Enviando…" : "Enviar mensaje"}</button>
        <p class="xsmall dim">Al enviar aceptás la <a href="#privacy">Política de privacidad</a>.</p>
      </form>
    </div>
  </div>`;
}
