/* AURYX: cursos (Auryx Academia). Catálogo (/cursos/), ficha (/cursos/<slug>/), aula
   (/cursos/<slug>/aula/?leccion=N), Mis cursos y verificación de certificados (/certificados/<código>/).
   Las vistas devuelven HTML; Courses (al final) pide los datos a la API y redibuja.
   Depende de: utils/format.js, lib/api.js, lib/session.js, views/cart.js (safePaymentUrl, pendingStatusHTML).
   Usa App, navigate y copyText de app.js en tiempo de ejecución. */

const COURSE_LEVELS = { inicial: "Inicial", intermedio: "Intermedio", avanzado: "Avanzado" };
const LESSON_KINDS = {
  video: { icon: "play-circle", label: "Video" },
  lectura: { icon: "book-open-text", label: "Lectura" },
  prueba: { icon: "exam", label: "Prueba" },
  tarea: { icon: "clipboard-text", label: "Tarea" },
};
const SUBMISSION_LABELS = {
  entregada: { label: "En revisión", tone: "warn" },
  aprobada: { label: "Aprobada", tone: "ok" },
  a_rehacer: { label: "A rehacer", tone: "bad" },
};
const CERT_CODE_RE = /^CERT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

const coursePrice = (c) => (Number(c.priceArs) > 0 ? fmtARS(Number(c.priceArs)) : "Gratis");

function minutesText(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
const fileSizeText = (b) => { const n = Number(b) || 0; return n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; };
const hoursText = (h) => { const n = Number(h) || 0; return `${String(n).replace(".", ",")} ${n === 1 ? "hora" : "horas"}`; };

/* Texto de lecciones y descripciones: formato simple y seguro (todo se escapa antes).
   Párrafos separados por línea en blanco, "## " títulos, "- " listas, **negrita** y [texto](https://…). */
function courseTextHTML(text) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  return String(text || "").replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => {
    const lines = block.split("\n").filter((l) => l.trim());
    if (!lines.length) return "";
    if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`).join("")}</ul>`;
    if (lines.length === 1 && /^#{2,3} /.test(lines[0])) return `<h3>${inline(lines[0].replace(/^#{2,3} /, ""))}</h3>`;
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("");
}

function progressBarHTML(pct, label = "Avance") {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  return `<div class="course-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${esc(label)}: ${p} %">
    <span style="width:${p}%"></span></div><p class="xsmall dim">${p} % completado</p>`;
}

function courseCoverHTML(c, cls = "course-cover") {
  return c.coverUrl
    ? `<img class="${cls}" src="${esc(c.coverUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<div class="${cls} course-cover-empty" aria-hidden="true">${icon("graduation-cap")}</div>`;
}

function courseLoadingHTML(text) {
  return `<div class="wrap page"><p class="boot-msg" role="status"><span class="spinner" aria-hidden="true"></span><span>${esc(text)}</span></p></div>`;
}

function courseErrorHTML(title, text, actions = "") {
  return `<div class="wrap page"><div class="empty empty-narrow">${icon("warning-circle")}
    <h1 class="page-title page-title-sm">${esc(title)}</h1><p>${esc(text)}</p>
    <div class="hero-ctas hero-ctas-center">${actions || `<a href="#courses" class="btn btn-secondary">Ver los cursos</a>`}</div></div></div>`;
}

/* ---------------------------------------------------------------- catálogo */

function courseCardHTML(c, mine) {
  const meta = [COURSE_LEVELS[c.level] || "", c.durationHours ? hoursText(c.durationHours) : minutesText(c.totalMin), `${c.lessonCount} ${c.lessonCount === 1 ? "lección" : "lecciones"}`].filter(Boolean);
  return `
  <article class="product-card course-card">
    ${courseCoverHTML(c)}
    <div class="card-body">
      <p class="brand">${meta.map(esc).join(" · ")}</p>
      <h3><a href="#courses/${encodeURIComponent(c.slug)}">${esc(c.title)}</a></h3>
      ${c.subtitle ? `<p class="key-spec">${esc(c.subtitle)}</p>` : ""}
      <div class="card-foot">
        <span class="price">${esc(coursePrice(c))}</span>
        ${mine && mine.status === "activa" ? `<span class="badge tone-ok">${icon("check-circle", "", "fill")} Inscripto</span>` : `<span class="xsmall dim">${icon("certificate")} Con certificado</span>`}
      </div>
    </div>
  </article>`;
}

function renderCourses(state) {
  const l = state.coursesList || {};
  let body;
  if (l.error) body = `<div class="empty">${icon("cloud-slash")}<h2>No pudimos cargar los cursos</h2><p>${esc(l.error)}</p>
      <button type="button" class="btn btn-primary" data-action="courses-retry">Reintentar</button></div>`;
  else if (!l.data) body = `<p class="boot-msg" role="status"><span class="spinner" aria-hidden="true"></span><span>Cargando los cursos…</span></p>`;
  else if (!l.data.length) body = `<div class="empty">${icon("video-camera")}<h2>Estamos grabando los primeros cursos</h2>
      <p>Van a ser cursos prácticos, de la teoría a la instalación, con certificado. Escribinos y te avisamos cuando salgan.</p>
      <a class="btn btn-primary" href="${whatsappLink("Hola, quiero que me avisen cuando salgan los cursos de Auryx.")}" target="_blank" rel="noopener" data-context="cursos">${icon("whatsapp-logo", "", "fill")} Avisame cuando salgan</a></div>`;
  else {
    const mine = new Map(((state.myCourses && state.myCourses.data) || []).map((e) => [e.course.slug, e]));
    body = `<div class="product-grid course-grid">${l.data.map((c) => courseCardHTML(c, mine.get(c.slug))).join("")}</div>`;
  }
  return `
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow">Auryx Academia</p>
      <h1 class="page-title">Cursos de energía solar</h1>
      <p class="page-lead">Cursos grabados por el equipo de Auryx: de la teoría a la instalación, a tu ritmo, con prácticas y certificado al terminar.</p>
    </header>
    ${body}
    <section class="course-verify panel panel-pad" aria-labelledby="verify-title">
      <h2 id="verify-title" class="summary-title">${icon("seal-check")} Verificar un certificado</h2>
      <form class="course-verify-form" data-form="cert-verify" novalidate>
        <label class="visually-hidden" for="cert-code">Código del certificado</label>
        <input id="cert-code" class="input mono" name="code" placeholder="CERT-XXXXXX" autocomplete="off" spellcheck="false" maxlength="11" />
        <button type="submit" class="btn btn-secondary">Verificar</button>
      </form>
    </section>
  </div>`;
}

/* ---------------------------------------------------------------- ficha */

function courseCtaHTML(state, c) {
  const mine = ((state.myCourses && state.myCourses.data) || []).find((e) => e.course.slug === c.slug);
  const cs = state.course || {};
  const status = cs.status ? `<p class="form-status tone-${cs.status.tone}" role="${cs.status.tone === "bad" ? "alert" : "status"}">${esc(cs.status.text)}</p>` : "";
  if (mine && mine.status === "activa") {
    return `<a href="#learn/${encodeURIComponent(c.slug)}" class="btn btn-primary btn-lg btn-block">${icon("play")} Ir al aula</a>
      ${progressBarHTML(mine.progressPct)}`;
  }
  const payUrl = mine && mine.status === "pendiente_pago" ? safePaymentUrl(mine.paymentUrl) : null;
  const free = !(Number(c.priceArs) > 0);
  const label = free ? "Inscribirme gratis" : "Comprar el curso";
  return `
    ${payUrl ? `<p class="small muted">Tenés el pago pendiente. Si ya pagaste, puede tardar unos minutos en acreditarse.</p>` : ""}
    ${cs.enrolling ? pendingStatusHTML(free ? "Inscribiéndote…" : "Preparando el pago…", cs.slow) : status}
    <button type="button" class="btn btn-primary btn-lg btn-block" data-action="course-enroll" ${cs.enrolling ? "disabled" : ""}>
      ${icon(free ? "user-plus" : "credit-card")} ${payUrl ? "Completar el pago" : label}</button>
    <p class="xsmall dim">${free ? "Necesitás ingresar con tu cuenta de Google." : `El pago lo procesa Mercado Pago. Tenés ${REVOCATION_TERM} para arrepentirte (<a href="#arrepentimiento">Botón de arrepentimiento</a>).`}</p>`;
}

function syllabusHTML(c, preview) {
  return c.modules.map((m, i) => `
    <details class="syllabus-module"${i === 0 ? " open" : ""}>
      <summary><span class="syllabus-num">${i + 1}</span><strong>${esc(m.title)}</strong><span class="xsmall dim">${m.lessons.length} ${m.lessons.length === 1 ? "lección" : "lecciones"} · ${minutesText(m.lessons.reduce((s, l) => s + (l.durationMin || 0), 0))}</span></summary>
      ${m.description ? `<p class="small muted syllabus-desc">${esc(m.description)}</p>` : ""}
      <ol class="syllabus-lessons">
        ${m.lessons.map((l) => {
          const k = LESSON_KINDS[l.kind] || LESSON_KINDS.video;
          return `<li>${icon(k.icon)}<span class="syllabus-title">${esc(l.title)}${l.isOptional ? ' <span class="xsmall dim">(opcional)</span>' : ""}</span>
            ${l.isPreview ? `<button type="button" class="link-btn" data-action="course-preview" data-id="${l.id}"${preview && preview.lessonId === l.id ? ' aria-pressed="true"' : ""}>Ver gratis</button>` : ""}
            <span class="xsmall dim">${l.durationMin ? minutesText(l.durationMin) : k.label}</span></li>`;
        }).join("")}
      </ol>
    </details>`).join("");
}

function videoFrameHTML(video, title) {
  if (!video || !video.embedUrl) return "";
  return `<div class="course-video"><iframe src="${esc(video.embedUrl)}" title="${esc(title)}" loading="lazy"
    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

function coursePreviewHTML(p) {
  if (!p) return "";
  let inner;
  if (p.error) inner = `<p class="form-status tone-bad" role="alert">${esc(p.error)}</p>`;
  else if (!p.data) inner = pendingStatusHTML("Cargando la vista previa…", false);
  else inner = `<h3 class="summary-title">${esc(p.data.title)}</h3>${videoFrameHTML(p.data.video, p.data.title)}<div class="prose">${courseTextHTML(p.data.body)}</div>`;
  return `<section class="panel panel-pad course-preview" id="course-preview" aria-label="Vista previa" tabindex="-1">
    <div class="course-preview-head"><span class="badge tone-ok">Vista previa gratis</span>
    <button type="button" class="icon-btn" data-action="course-preview-close" aria-label="Cerrar la vista previa">${icon("x")}</button></div>${inner}</section>`;
}

function renderCourseDetail(state) {
  const cs = state.course || {};
  if (cs.error) return courseErrorHTML("No encontramos el curso", cs.error);
  const c = cs.data;
  if (!c) return courseLoadingHTML("Cargando el curso…");
  const facts = [
    [icon("signal-high"), COURSE_LEVELS[c.level] || "Inicial"],
    [icon("clock"), c.durationHours ? hoursText(c.durationHours) : minutesText(c.totalMin)],
    [icon("list-numbers"), `${c.lessonCount} ${c.lessonCount === 1 ? "lección" : "lecciones"}`],
    ...(c.quizCount ? [[icon("exam"), `${c.quizCount} prueba${c.quizCount > 1 ? "s" : ""}`]] : []),
    ...(c.assignmentCount ? [[icon("clipboard-text"), `${c.assignmentCount} tarea${c.assignmentCount > 1 ? "s" : ""} práctica${c.assignmentCount > 1 ? "s" : ""}`]] : []),
    [icon("certificate"), "Certificado verificable"],
  ];
  const list = (items) => `<ul class="course-checks">${items.map((t) => `<li>${icon("check")}${esc(t)}</li>`).join("")}</ul>`;
  return `
  <article class="wrap page course-page">
    <nav class="crumbs" aria-label="Estás en"><a href="#courses">Cursos</a>${icon("caret-right")}<span aria-current="page">${esc(c.title)}</span></nav>
    <div class="course-hero">
      <header class="page-head course-head">
        <p class="eyebrow">Auryx Academia</p>
        <h1 class="page-title">${esc(c.title)}</h1>
        ${c.subtitle ? `<p class="page-lead">${esc(c.subtitle)}</p>` : ""}
        <ul class="course-facts">${facts.map(([i, t]) => `<li>${i}${esc(t)}</li>`).join("")}</ul>
      </header>
      <aside class="panel course-buy" aria-label="Inscripción">
        ${courseCoverHTML(c, "course-buy-cover")}
        <div class="panel-pad course-buy-body">
          <p class="price price-lg">${esc(coursePrice(c))}${Number(c.priceArs) > 0 ? '<small class="iva">IVA incluido</small>' : ""}</p>
          ${courseCtaHTML(state, c)}
        </div>
      </aside>
    </div>
    <div class="course-body">
      ${c.outcomes && c.outcomes.length ? `<section aria-labelledby="c-out"><h2 id="c-out" class="course-h2">Qué vas a aprender</h2>${list(c.outcomes)}</section>` : ""}
      <section aria-labelledby="c-syl"><h2 id="c-syl" class="course-h2">Temario</h2>
        <p class="small muted">${c.modules.length} módulos · ${c.lessonCount} lecciones · ${minutesText(c.totalMin)} de contenido${c.sequential ? " · Las lecciones se habilitan en orden" : ""}</p>
        ${coursePreviewHTML(cs.preview)}
        ${syllabusHTML(c, cs.preview)}
      </section>
      ${c.description ? `<section aria-labelledby="c-desc"><h2 id="c-desc" class="course-h2">Sobre el curso</h2><div class="prose">${courseTextHTML(c.description)}</div></section>` : ""}
      ${c.requirements && c.requirements.length ? `<section aria-labelledby="c-req"><h2 id="c-req" class="course-h2">Requisitos</h2>${list(c.requirements)}</section>` : ""}
      ${c.instructorName ? `<section class="course-instructor" aria-labelledby="c-ins"><h2 id="c-ins" class="course-h2">Quién lo dicta</h2>
        <div class="course-instructor-row">${c.instructorPhotoUrl ? `<img src="${esc(c.instructorPhotoUrl)}" alt="" loading="lazy" />` : `<span class="course-instructor-ph" aria-hidden="true">${icon("user")}</span>`}
        <div><p><strong>${esc(c.instructorName)}</strong></p>${c.instructorBio ? `<p class="small muted">${esc(c.instructorBio)}</p>` : ""}</div></div></section>` : ""}
    </div>
  </article>`;
}

/* ---------------------------------------------------------------- aula */

function lessonStateIcon(l, current) {
  if (l.completed) return icon("check-circle", "tone-text-ok", "fill");
  if (l.locked) return icon("lock-simple");
  return icon((LESSON_KINDS[l.kind] || LESSON_KINDS.video).icon, current ? "tone-text-accent" : "");
}

function learnSidebarHTML(room, lessonId) {
  return `
    <aside class="learn-side panel" aria-label="Temario">
      <div class="panel-pad learn-side-head">
        <a href="#courses/${encodeURIComponent(room.course.slug)}" class="xsmall dim">${icon("arrow-left")} Ficha del curso</a>
        <h2 class="learn-course-title">${esc(room.course.title)}</h2>
        ${progressBarHTML(room.progressPct)}
      </div>
      <nav class="learn-modules">
        ${room.modules.map((m, i) => `
          <div class="learn-module"><p class="learn-module-title"><span class="syllabus-num">${i + 1}</span>${esc(m.title)}</p>
            <ol>${m.lessons.map((l) => {
              const current = l.id === lessonId;
              const meta = [l.durationMin ? minutesText(l.durationMin) : "", l.quiz ? `Nota ${l.quiz.bestPct} %` : "", l.submission ? (SUBMISSION_LABELS[l.submission] || {}).label || "" : ""].filter(Boolean).join(" · ");
              const inner = `${lessonStateIcon(l, current)}<span>${esc(l.title)}${meta ? `<span class="xsmall dim">${esc(meta)}</span>` : ""}</span>`;
              return `<li>${l.locked
                ? `<span class="learn-lesson is-locked" title="Completá las lecciones anteriores">${inner}</span>`
                : `<a class="learn-lesson${current ? " is-current" : ""}" href="#learn/${encodeURIComponent(room.course.slug)}?leccion=${l.id}"${current ? ' aria-current="page"' : ""}>${inner}</a>`}</li>`;
            }).join("")}</ol>
          </div>`).join("")}
      </nav>
      ${certificateBoxHTML(room)}
    </aside>`;
}

function certificateBoxHTML(room) {
  const L = App.state.learn || {};
  const cert = room.certificate;
  if (cert && !cert.revoked) {
    return `<div class="panel-pad learn-cert">${icon("certificate", "tone-text-ok", "fill")}<p><strong>¡Curso terminado!</strong></p>
      <a href="#certificate/${encodeURIComponent(cert.code)}" class="btn btn-primary btn-block">Ver mi certificado</a></div>`;
  }
  if (!room.canCertify) return "";
  const c = L.cert || {};
  return `<div class="panel-pad learn-cert">
    <p><strong>${icon("certificate", "", "fill")} ¡Completaste el curso!</strong></p>
    <form class="form" data-form="course-cert" novalidate>
      <label class="field-label" for="cert-name">Nombre que va a figurar en el certificado</label>
      <input id="cert-name" class="input" name="name" value="${esc(c.name !== undefined ? c.name : room.suggestedName || "")}" maxlength="80" autocomplete="name" />
      ${c.sending ? pendingStatusHTML("Emitiendo el certificado…", false) : c.status ? `<p class="form-status tone-${c.status.tone}" role="alert">${esc(c.status.text)}</p>` : ""}
      <button type="submit" class="btn btn-primary btn-block" ${c.sending ? "disabled" : ""}>Obtener mi certificado</button>
      <p class="xsmall dim">Revisalo bien: una vez emitido no se puede cambiar.</p>
    </form></div>`;
}

function resourcesHTML(lesson) {
  if (!lesson.resources || !lesson.resources.length) return "";
  return `<section class="learn-block" aria-labelledby="res-title"><h2 id="res-title" class="learn-h2">${icon("paperclip")} Recursos</h2>
    <ul class="learn-resources">${lesson.resources.map((r) => `<li>
      ${r.kind === "link"
        ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${icon("link")} ${esc(r.title)}</a>`
        : `<button type="button" class="link-btn" data-action="course-resource" data-id="${r.id}">${icon("download-simple")} ${esc(r.title)}</button>${r.fileSize ? ` <span class="xsmall dim">${fileSizeText(r.fileSize)}</span>` : ""}`}
    </li>`).join("")}</ul></section>`;
}

function quizHTML(lesson, L) {
  const q = lesson.quiz;
  if (!q) return "";
  const r = (L.quiz && L.quiz.result) || null;
  const answers = (L.quiz && L.quiz.answers) || {};
  const wrong = new Set(r ? r.wrong : []);
  const noAttempts = q.attemptsLeft === 0 && !q.passed;
  const head = `<p class="small muted">Nota mínima: ${q.passPct} %${q.maxAttempts ? ` · Intentos: ${q.attemptsUsed} de ${q.maxAttempts}` : ""}${q.attemptsUsed ? ` · Tu mejor nota: ${q.bestPct} %` : ""}</p>`;
  let result = "";
  if (r) result = `<p class="form-status tone-${r.passed ? "ok" : "bad"}" role="status">${r.passed ? `¡Aprobaste con ${r.scorePct} %!` : `Sacaste ${r.scorePct} % (necesitás ${r.passPct} %). Revisá las preguntas marcadas${r.attemptsLeft === 0 ? "." : " y probá de nuevo."}`}</p>`;
  else if (q.passed) result = `<p class="form-status tone-ok" role="status">Ya aprobaste esta prueba. Podés volver a hacerla si querés practicar.</p>`;
  if (!q.questions.length) return `<section class="learn-block"><p class="muted">Esta prueba todavía no tiene preguntas.</p></section>`;
  return `<section class="learn-block" aria-labelledby="quiz-title"><h2 id="quiz-title" class="learn-h2">${icon("exam")} Prueba</h2>${head}${result}
    <form class="form quiz-form" data-form="quiz" novalidate>
      ${q.questions.map((qq, i) => {
        const type = qq.kind === "multiple" ? "checkbox" : "radio";
        const picked = new Set(answers[qq.id] || []);
        return `<fieldset class="quiz-q${wrong.has(qq.id) ? " is-wrong" : ""}">
          <legend><span class="mono">${i + 1}.</span> ${esc(qq.prompt)}${qq.kind === "multiple" ? ' <span class="xsmall dim">(puede haber más de una)</span>' : ""}</legend>
          ${qq.options.map((o) => `<label class="choice"><input type="${type}" name="q${qq.id}" value="${esc(o.id)}" data-bind="quiz-answer" data-q="${qq.id}" data-multi="${type === "checkbox" ? 1 : 0}"${picked.has(o.id) ? " checked" : ""} ${noAttempts ? "disabled" : ""} /><span>${esc(o.text)}</span></label>`).join("")}
          ${wrong.has(qq.id) ? `<p class="field-error">${icon("x-circle")} Respuesta incorrecta</p>` : ""}
        </fieldset>`;
      }).join("")}
      ${L.quiz && L.quiz.sending ? pendingStatusHTML("Corrigiendo…", false) : ""}
      ${L.quiz && L.quiz.error ? `<p class="form-status tone-bad" role="alert">${esc(L.quiz.error)}</p>` : ""}
      ${noAttempts ? `<p class="small muted">No te quedan intentos. Escribinos si necesitás otro.</p>` : `<button type="submit" class="btn btn-primary" ${L.quiz && L.quiz.sending ? "disabled" : ""}>Enviar respuestas</button>`}
    </form></section>`;
}

function fmtCourseDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function assignmentHTML(lesson, L) {
  const a = lesson.assignment;
  if (!a) return "";
  const subs = a.submissions || [];
  const approved = subs.some((s) => s.status === "aprobada");
  const S = L.submission || {};
  const history = subs.length ? `<ul class="learn-submissions">${subs.map((s) => {
    const st = SUBMISSION_LABELS[s.status] || SUBMISSION_LABELS.entregada;
    return `<li class="panel panel-pad"><p><span class="badge tone-${st.tone}">${st.label}</span> <span class="xsmall dim">Entregada el ${esc(fmtCourseDate(s.createdAt))}</span></p>
      ${s.text ? `<p class="small">${esc(s.text).replace(/\n/g, "<br>")}</p>` : ""}
      ${s.fileName ? `<p class="xsmall dim">${icon("paperclip")} ${esc(s.fileName)}</p>` : ""}
      ${s.feedback ? `<div class="learn-feedback"><p class="xsmall dim">Comentario de Auryx</p><p class="small">${esc(s.feedback).replace(/\n/g, "<br>")}</p></div>` : ""}</li>`;
  }).join("")}</ul>` : "";
  return `<section class="learn-block" aria-labelledby="task-title"><h2 id="task-title" class="learn-h2">${icon("clipboard-text")} Tarea</h2>
    ${a.instructions ? `<div class="prose">${courseTextHTML(a.instructions)}</div>` : ""}
    ${history}
    ${approved ? `<p class="form-status tone-ok" role="status">¡Tarea aprobada!</p>` : `
    <form class="form submission-form" data-form="submission" novalidate>
      <label class="field-label" for="sub-text">${subs.length ? "Nueva entrega" : "Tu entrega"}</label>
      <textarea id="sub-text" class="textarea" name="text" rows="5" maxlength="20000" data-bind="submission-text" placeholder="Escribí tu respuesta o pegá un link">${esc(S.text || "")}</textarea>
      <label class="field-label" for="sub-file">Archivo <span class="xsmall dim">(opcional: PDF, imágenes, ZIP, Excel o Word, hasta 25 MB)</span></label>
      <input id="sub-file" class="input" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.xlsx,.docx,.pptx,.csv,.txt" />
      ${S.sending ? pendingStatusHTML("Enviando la entrega…", false) : S.status ? `<p class="form-status tone-${S.status.tone}" role="${S.status.tone === "bad" ? "alert" : "status"}">${esc(S.status.text)}</p>` : ""}
      <button type="submit" class="btn btn-primary" ${S.sending ? "disabled" : ""}>Enviar la tarea</button>
    </form>`}
  </section>`;
}

function lessonMainHTML(room, L) {
  if (L.lessonError) return `<div class="empty">${icon("lock-simple")}<h2>No podés abrir esta lección</h2><p>${esc(L.lessonError)}</p></div>`;
  const lesson = L.lesson;
  if (!lesson) return pendingStatusHTML("Cargando la lección…", false);
  const k = LESSON_KINDS[lesson.kind] || LESSON_KINDS.video;
  const slug = encodeURIComponent(room.course.slug);
  const canMark = lesson.kind === "video" || lesson.kind === "lectura";
  const nav = `<nav class="learn-nav" aria-label="Lecciones">
      ${lesson.prevId ? `<a class="btn btn-secondary" href="#learn/${slug}?leccion=${lesson.prevId}">${icon("arrow-left")} Anterior</a>` : "<span></span>"}
      ${canMark ? (lesson.completed
        ? `<span class="badge tone-ok">${icon("check-circle", "", "fill")} Completada</span>`
        : `<button type="button" class="btn btn-primary" data-action="lesson-complete" ${L.completing ? "disabled" : ""}>${icon("check")} Marcar como completada</button>`) : ""}
      ${lesson.nextId ? `<a class="btn btn-secondary" href="#learn/${slug}?leccion=${lesson.nextId}">Siguiente ${icon("arrow-right")}</a>` : "<span></span>"}
    </nav>`;
  return `
    <header class="learn-head">
      <p class="xsmall dim">${icon(k.icon)} ${k.label}${lesson.durationMin ? ` · ${minutesText(lesson.durationMin)}` : ""}${lesson.isOptional ? " · Opcional" : ""}</p>
      <h1 id="lesson-title" class="page-title page-title-sm" tabindex="-1">${esc(lesson.title)}</h1>
    </header>
    ${videoFrameHTML(lesson.video, lesson.title)}
    ${lesson.body ? `<div class="prose learn-body">${courseTextHTML(lesson.body)}</div>` : ""}
    ${resourcesHTML(lesson)}
    ${quizHTML(lesson, L)}
    ${assignmentHTML(lesson, L)}
    ${nav}`;
}

function renderLearn(state) {
  const L = state.learn || {};
  if (L.error) {
    const actions = `<a href="#courses/${encodeURIComponent(L.slug || "")}" class="btn btn-primary">Ver el curso</a><a href="#mis-cursos" class="btn btn-secondary">Mis cursos</a>`;
    return courseErrorHTML(L.notEnrolled ? "Todavía no estás inscripto" : "No pudimos abrir el aula", L.error, actions);
  }
  if (!L.room) return courseLoadingHTML("Abriendo el aula…");
  return `
  <div class="wrap page learn-page">
    <div class="learn-layout">
      ${learnSidebarHTML(L.room, L.lessonId)}
      <article class="learn-main">${lessonMainHTML(L.room, L)}</article>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- Mis cursos */

function renderMyCourses(state) {
  const m = state.myCourses || {};
  let body;
  if (m.error) body = `<div class="empty">${icon("cloud-slash")}<h2>No pudimos cargar tus cursos</h2><p>${esc(m.error)}</p></div>`;
  else if (!m.data) body = pendingStatusHTML("Cargando tus cursos…", false);
  else if (!m.data.length) body = `<div class="empty empty-narrow">${icon("graduation-cap")}<h2>Todavía no te inscribiste a ningún curso</h2>
      <a href="#courses" class="btn btn-primary">Ver los cursos</a></div>`;
  else body = `<ul class="my-courses">${m.data.map((e) => {
    const payUrl = e.status === "pendiente_pago" ? safePaymentUrl(e.paymentUrl) : null;
    return `<li class="panel my-course">
      ${courseCoverHTML(e.course, "my-course-cover")}
      <div class="panel-pad my-course-body">
        <h2 class="summary-title"><a href="#courses/${encodeURIComponent(e.course.slug)}">${esc(e.course.title)}</a></h2>
        ${e.status === "activa" ? progressBarHTML(e.progressPct) : `<p><span class="badge tone-warn">Pago pendiente</span></p>`}
        <div class="hero-ctas">
          ${e.status === "activa" ? `<a href="#learn/${encodeURIComponent(e.course.slug)}" class="btn btn-primary">${e.progressPct ? "Seguir" : "Empezar"}</a>` : payUrl ? `<a href="${esc(payUrl)}" class="btn btn-primary">Completar el pago</a>` : ""}
          ${e.certificate ? `<a href="#certificate/${encodeURIComponent(e.certificate.code)}" class="btn btn-secondary">${icon("certificate")} Certificado</a>` : ""}
        </div>
      </div></li>`;
  }).join("")}</ul>`;
  return `<div class="wrap page"><div class="page-head"><h1 class="page-title">Mis cursos</h1></div>${body}</div>`;
}

/* ---------------------------------------------------------------- certificado */

function renderCertificate(state) {
  const c = state.certificate || {};
  if (c.error) return courseErrorHTML("Certificado no encontrado", c.error);
  if (!c.data) return courseLoadingHTML("Verificando el certificado…");
  const d = c.data;
  const pdf = `${API_BASE_URL}/certificates/${encodeURIComponent(d.code)}/pdf`;
  return `
  <div class="wrap page">
    <div class="cert-card panel panel-pad">
      <p class="eyebrow">Auryx Academia</p>
      ${d.valid
        ? `<p class="badge tone-ok cert-status">${icon("seal-check", "", "fill")} Certificado válido</p>`
        : `<p class="badge tone-bad cert-status">${icon("x-circle", "", "fill")} Certificado revocado</p>`}
      <h1 class="page-title cert-name">${esc(d.name)}</h1>
      <p class="page-lead">completó y aprobó el curso <strong>${d.courseSlug ? `<a href="#courses/${encodeURIComponent(d.courseSlug)}">${esc(d.courseTitle)}</a>` : esc(d.courseTitle)}</strong></p>
      <dl class="order-facts">
        <div><dt>Duración</dt><dd>${esc(hoursText(d.hours))}</dd></div>
        <div><dt>Emitido</dt><dd>${esc(fmtCourseDate(d.issuedAt))}</dd></div>
        <div><dt>Código</dt><dd class="mono">${esc(d.code)}</dd></div>
      </dl>
      ${d.valid ? `<div class="hero-ctas">
        <a class="btn btn-primary" href="${esc(pdf)}" target="_blank" rel="noopener">${icon("file-pdf")} Descargar PDF</a>
        <button type="button" class="btn btn-secondary" data-action="copy-text" data-text="${esc(location.origin + routeToPath(`certificate/${d.code}`))}">${icon("link")} Copiar link</button>
      </div>` : `<p class="small muted">Este certificado fue revocado y ya no es válido.</p>`}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- datos y acciones */

const Courses = {
  render(view) { if (App.state.view === view) App.render(); },

  async loadList(force = false) {
    const s = App.state;
    if (s.coursesList && s.coursesList.data && !force) return;
    s.coursesList = { data: null, error: null };
    if (getSession()) this.loadMine(true);
    try {
      s.coursesList.data = await apiRequest("/courses", { timeoutMs: 70000 });
    } catch (err) {
      s.coursesList.error = apiErrorText(err);
    }
    this.render("courses");
  },

  /* Mis inscripciones (para saber si mostrar "Ir al aula"). quiet = sin redibujar la página de Mis cursos. */
  async loadMine(quiet = false) {
    const s = App.state;
    if (!getSession()) { s.myCourses = null; return; }
    if (!quiet || !s.myCourses) s.myCourses = { data: null, error: null };
    try {
      s.myCourses = { data: await apiRequest("/me/courses", { auth: true, timeoutMs: 70000, redirectOn401: !quiet }), error: null };
    } catch (err) {
      if (err.status === 401) return;
      s.myCourses = { data: quiet ? [] : null, error: quiet ? null : apiErrorText(err) };
    }
    ["my-courses", "courses", "course-detail"].forEach((v) => this.render(v));
  },

  async loadCourse(slug) {
    const s = App.state;
    if (s.course && s.course.slug === slug && (s.course.data || s.course.loading)) return;
    s.course = { slug, data: null, error: null, loading: true, preview: null };
    if (getSession()) this.loadMine(true);
    try {
      const data = await apiRequest(`/courses/${encodeURIComponent(slug)}`, { timeoutMs: 70000 });
      if (!s.course || s.course.slug !== slug) return;
      Object.assign(s.course, { data, loading: false });
      document.title = `${data.title} | Cursos | AURYX`;
    } catch (err) {
      if (!s.course || s.course.slug !== slug) return;
      Object.assign(s.course, { loading: false, error: err.status === 404 ? "El curso no existe o ya no está disponible." : apiErrorText(err) });
    }
    this.render("course-detail");
  },

  async enroll() {
    const s = App.state;
    const cs = s.course;
    if (!cs || !cs.data || cs.enrolling) return;
    if (!getSession()) { rememberAfterLogin(currentRoute()); navigate("ingresar"); return; }
    Object.assign(cs, { enrolling: true, slow: false, status: null });
    App.render();
    const slowTimer = setTimeout(() => { if (cs.enrolling) { cs.slow = true; this.render("course-detail"); } }, 5000);
    try {
      const r = await apiRequest(`/courses/${encodeURIComponent(cs.slug)}/enroll`, { method: "POST", auth: true, timeoutMs: 70000 });
      const payUrl = safePaymentUrl(r.paymentUrl);
      if (payUrl) { window.location.href = payUrl; return; }
      cs.enrolling = false;
      s.myCourses = null;
      s.learn = null; // el aula se vuelve a pedir ya con la inscripción
      Track.event("sign_up", { method: "curso", course: cs.slug });
      navigate(`learn/${cs.slug}`);
    } catch (err) {
      cs.enrolling = false;
      if (err.status === 401) return;
      cs.status = { tone: "bad", text: err.status && err.status < 500 ? err.message : apiErrorText(err) };
      this.render("course-detail");
    } finally {
      clearTimeout(slowTimer);
    }
  },

  async preview(lessonId) {
    const cs = App.state.course;
    if (!cs) return;
    cs.preview = { lessonId, data: null, error: null };
    App.render({ focusSelector: "#course-preview" });
    try {
      const data = await apiRequest(`/courses/${encodeURIComponent(cs.slug)}/lessons/${lessonId}/preview`, { timeoutMs: 70000 });
      if (cs.preview && cs.preview.lessonId === lessonId) cs.preview.data = data;
    } catch (err) {
      if (cs.preview && cs.preview.lessonId === lessonId) cs.preview.error = apiErrorText(err);
    }
    this.render("course-detail");
  },

  /* Aula: el temario se pide al entrar al curso; la lección, cada vez que cambia ?leccion=. */
  async loadRoom(slug, lessonParam) {
    const s = App.state;
    const wanted = Number(lessonParam) || null;
    // otro curso, o un intento anterior que falló (no inscripto, sin red): se empieza de cero
    if (!s.learn || s.learn.slug !== slug || s.learn.error) s.learn = { slug, room: null, error: null, lessonId: null, lesson: null };
    const L = s.learn;
    if (!L.room && !L.loadingRoom) {
      L.loadingRoom = true;
      try {
        L.room = await apiRequest(`/me/courses/${encodeURIComponent(slug)}`, { auth: true, timeoutMs: 70000 });
        document.title = `${L.room.course.title} | Aula | AURYX`;
      } catch (err) {
        if (err.status === 401) return;
        L.notEnrolled = err.status === 403;
        L.error = err.status === 404 ? "El curso no existe o ya no está disponible." : err.status === 403 ? `${err.message} Inscribite desde la ficha del curso.` : apiErrorText(err);
      } finally {
        L.loadingRoom = false;
      }
      if (s.learn !== L) return;
      if (L.error) { this.render("learn"); return; }
    }
    if (!L.room) return;
    const target = wanted || L.room.nextLessonId;
    if (!target) { this.render("learn"); return; }
    if (!wanted) history.replaceState(history.state, "", routeToPath(`learn/${slug}?leccion=${target}`));
    if (L.lessonId === target && (L.lesson || L.loadingLesson)) { this.render("learn"); return; }
    this.loadLesson(target);
  },

  async loadLesson(lessonId) {
    const L = App.state.learn;
    Object.assign(L, { lessonId, lesson: null, lessonError: null, loadingLesson: true, quiz: { answers: {} }, submission: {}, completing: false });
    this.render("learn");
    try {
      const lesson = await apiRequest(`/me/courses/${encodeURIComponent(L.slug)}/lessons/${lessonId}`, { auth: true, timeoutMs: 70000 });
      if (App.state.learn !== L || L.lessonId !== lessonId) return;
      L.lesson = lesson;
    } catch (err) {
      if (err.status === 401 || App.state.learn !== L || L.lessonId !== lessonId) return;
      L.lessonError = err.status === 403 || err.status === 404 ? err.message : apiErrorText(err);
    } finally {
      L.loadingLesson = false;
    }
    if (App.state.view !== "learn") return;
    App.render({ focusSelector: "#lesson-title" });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  /* Recarga el temario (avance, candados, certificado) sin perder la lección abierta. */
  async refreshRoom() {
    const L = App.state.learn;
    if (!L) return;
    try {
      L.room = await apiRequest(`/me/courses/${encodeURIComponent(L.slug)}`, { auth: true, timeoutMs: 70000 });
      App.state.myCourses = null;
    } catch (err) { /* el aula sigue con el temario anterior */ }
    this.render("learn");
  },

  async complete() {
    const L = App.state.learn;
    if (!L || !L.lesson || L.completing) return;
    L.completing = true;
    App.render();
    try {
      await apiRequest(`/me/courses/${encodeURIComponent(L.slug)}/lessons/${L.lesson.id}/complete`, { method: "POST", auth: true, timeoutMs: 70000 });
      L.lesson.completed = true;
      L.completing = false;
      await this.refreshRoom();
      // sigue con la próxima lección
      if (L.lesson.nextId) App.toast("¡Lección completada!", { label: "Siguiente", run: () => navigate(`learn/${L.slug}?leccion=${L.lesson.nextId}`) });
    } catch (err) {
      L.completing = false;
      if (err.status !== 401) App.toast(err.status && err.status < 500 ? err.message : apiErrorText(err));
      this.render("learn");
    }
  },

  setAnswer(el) {
    const L = App.state.learn;
    if (!L) return;
    const q = el.dataset.q;
    const cur = new Set(L.quiz.answers[q] || []);
    if (el.dataset.multi === "1") { if (el.checked) cur.add(el.value); else cur.delete(el.value); }
    else { cur.clear(); cur.add(el.value); }
    L.quiz.answers[q] = [...cur];
  },

  async submitQuiz() {
    const L = App.state.learn;
    if (!L || !L.lesson || !L.lesson.quiz || L.quiz.sending) return;
    const missing = L.lesson.quiz.questions.filter((q) => !(L.quiz.answers[q.id] || []).length).length;
    if (missing) { L.quiz.error = `Te falta${missing > 1 ? "n" : ""} responder ${missing} pregunta${missing > 1 ? "s" : ""}.`; App.render({ focusSelector: ".quiz-form .form-status" }); return; }
    Object.assign(L.quiz, { sending: true, error: null });
    App.render();
    try {
      const r = await apiRequest(`/me/courses/${encodeURIComponent(L.slug)}/lessons/${L.lesson.id}/attempts`, { method: "POST", auth: true, timeoutMs: 70000, body: { answers: L.quiz.answers } });
      L.quiz.result = r;
      const q = L.lesson.quiz;
      q.attemptsUsed += 1;
      q.attemptsLeft = r.attemptsLeft;
      q.bestPct = Math.max(q.bestPct, r.scorePct);
      q.passed = q.passed || r.passed;
      await this.refreshRoom();
    } catch (err) {
      if (err.status !== 401) L.quiz.error = err.status && err.status < 500 ? err.message : apiErrorText(err);
    } finally {
      L.quiz.sending = false;
    }
    App.render({ focusSelector: ".quiz-form .form-status, #quiz-title" });
  },

  /* Entrega: si hay archivo, se firma la subida, va directo a R2 y después se registra la entrega. */
  async submitAssignment(form) {
    const L = App.state.learn;
    if (!L || !L.lesson || (L.submission && L.submission.sending)) return;
    const S = L.submission;
    const file = form.querySelector('input[type="file"]').files[0];
    const text = (S.text || "").trim();
    const fail = (t) => { S.status = { tone: "bad", text: t }; App.render({ focusSelector: ".submission-form .form-status" }); };
    if (!text && !file) return fail("Escribí tu respuesta o adjuntá un archivo.");
    if (file && file.size > 25 * 1024 * 1024) return fail("El archivo supera los 25 MB.");
    Object.assign(S, { sending: true, status: null });
    App.render();
    const base = `/me/courses/${encodeURIComponent(L.slug)}/lessons/${L.lesson.id}/submission`;
    try {
      const body = { text };
      if (file) {
        const up = await apiRequest(`${base}/upload-url`, { method: "POST", auth: true, timeoutMs: 70000, body: { filename: file.name, size: file.size, contentType: file.type || undefined } });
        const put = await fetch(up.url, { method: "PUT", headers: up.headers || {}, body: file });
        if (!put.ok) throw new Error("No se pudo subir el archivo. Probá de nuevo.");
        Object.assign(body, { key: up.key, fileName: up.fileName, fileSize: up.fileSize });
      }
      const sub = await apiRequest(base, { method: "POST", auth: true, timeoutMs: 70000, body });
      L.lesson.assignment.submissions.unshift({ ...sub, feedback: "", fileSize: body.fileSize || null });
      Object.assign(S, { sending: false, text: "", status: { tone: "ok", text: "¡Listo! Recibimos tu tarea. Te avisamos por mail cuando la corrijamos." } });
      this.refreshRoom();
    } catch (err) {
      S.sending = false;
      if (err.status === 401) return;
      S.status = { tone: "bad", text: err.status && err.status < 500 ? err.message : apiErrorText(err) };
    }
    App.render({ focusSelector: ".submission-form .form-status" });
  },

  async resource(id) {
    const L = App.state.learn;
    if (!L) return;
    // se abre la pestaña antes de esperar a la API: si no, el navegador la bloquea como ventana emergente
    const win = window.open("", "_blank");
    try {
      const { url } = await apiRequest(`/me/courses/${encodeURIComponent(L.slug)}/resources/${id}`, { auth: true, timeoutMs: 70000 });
      if (win) { win.opener = null; win.location.href = url; } else window.location.href = url;
    } catch (err) {
      if (win) win.close();
      if (err.status !== 401) App.toast(err.status && err.status < 500 ? err.message : apiErrorText(err));
    }
  },

  async issueCertificate(form) {
    const L = App.state.learn;
    if (!L || !L.room) return;
    const name = form.querySelector('input[name="name"]').value;
    L.cert = { name, sending: true, status: null };
    App.render();
    try {
      const cert = await apiRequest(`/me/courses/${encodeURIComponent(L.slug)}/certificate`, { method: "POST", auth: true, timeoutMs: 70000, body: { name } });
      L.cert = null;
      App.state.myCourses = null;
      navigate(`certificate/${cert.code}`);
    } catch (err) {
      if (err.status === 401) return;
      L.cert = { name, sending: false, status: { tone: "bad", text: err.status && err.status < 500 ? err.message : apiErrorText(err) } };
      App.render({ focusSelector: "#cert-name" });
    }
  },

  async loadCertificate(code) {
    const s = App.state;
    const c = String(code || "").toUpperCase();
    if (s.certificate && s.certificate.code === c && s.certificate.data) return;
    s.certificate = { code: c, data: null, error: null };
    if (!CERT_CODE_RE.test(c)) { s.certificate.error = "El código no tiene el formato de un certificado (CERT-XXXXXX)."; return; }
    try {
      const data = await apiRequest(`/certificates/${encodeURIComponent(c)}`, { timeoutMs: 70000 });
      if (s.certificate && s.certificate.code === c) s.certificate.data = data;
    } catch (err) {
      if (s.certificate && s.certificate.code === c) s.certificate.error = err.status === 404 ? "No hay ningún certificado con ese código. Revisá que esté bien escrito." : apiErrorText(err);
    }
    this.render("certificate");
  },

  verifyFromForm(form) {
    const code = form.querySelector('input[name="code"]').value.trim().toUpperCase();
    if (!code) return;
    navigate(`certificate/${code.startsWith("CERT-") ? code : `CERT-${code}`}`);
  },
};
