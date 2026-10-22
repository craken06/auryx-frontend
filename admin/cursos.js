/* =========================================================================
   AURYX admin: Cursos (Auryx Academia), Entregas y Certificados.
   Llama a /admin/... de compragamer-api directo con apiFetch (backend.js) y el token del panel.
   Todo se dibuja con template strings y se maneja con un solo listener por pestaña (data-act).
   Usa esc, getToken, showLogin y flash del script principal (index.html).
   ========================================================================= */

async function cursosApi(path, options = {}) {
  try {
    return await apiFetch(getToken(), path, options);
  } catch (err) {
    if (err.status === 401) { showLogin('Tu sesión venció. Ingresá de nuevo.'); throw new Error('Sesión vencida'); }
    throw err;
  }
}
const jsonBody = (method, body) => ({ method, body: JSON.stringify(body ?? {}) });

const SITE_URL = 'https://auryx.com.ar';
const NIVELES = { inicial: 'Inicial', intermedio: 'Intermedio', avanzado: 'Avanzado' };
const ESTADO_CURSO = { borrador: '', publicado: 'ok', archivado: 'warn' };
const TIPOS_LECCION = {
  video: ['ph-play-circle', 'Video'], lectura: ['ph-book-open-text', 'Lectura'], prueba: ['ph-exam', 'Prueba'], tarea: ['ph-clipboard-text', 'Tarea'],
};
const TIPOS_PREGUNTA = { unica: 'Opción única', multiple: 'Opción múltiple', vf: 'Verdadero / falso' };
const ESTADO_ENTREGA = { entregada: ['warn', 'Para corregir'], aprobada: ['ok', 'Aprobada'], a_rehacer: ['bad', 'A rehacer'] };
const ESTADO_INSCRIPCION = { activa: 'ok', pendiente_pago: 'warn', cancelada: 'bad' };
const pesos = (n) => Number(n) > 0 ? Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : 'Gratis';
const ico = (name) => `<i class="ph ${name}" aria-hidden="true"></i>`;
const slugDe = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const lineas = (txt) => String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean);

const CUR = { status: null, list: [], course: null, sub: 'datos', lessonId: null, question: null, enrollments: null };

/* Sube un archivo a R2 con la URL firmada que da la API. purpose: cover | instructor | resource. */
async function subirArchivo(file, purpose, courseId) {
  const up = await cursosApi('/admin/uploads', jsonBody('POST', { purpose, courseId, filename: file.name, size: file.size, contentType: file.type || undefined }));
  const res = await fetch(up.url, { method: 'PUT', headers: up.headers || {}, body: file });
  if (!res.ok) throw new Error(`R2 rechazó la subida (${res.status}). Revisá el CORS del bucket.`);
  return up;
}

// ============================================================ lista de cursos

async function cargarCursos() {
  CUR.status = await cursosApi('/admin/courses-status').catch(() => null);
  CUR.list = await cursosApi('/admin/courses');
  if (CUR.course) await abrirCurso(CUR.course.id, true);
  else renderCursos();
}

function avisosConfig() {
  const s = CUR.status;
  if (!s) return '';
  const faltan = [];
  if (!s.storage) faltan.push('R2 (archivos: portadas, recursos y entregas) — variables R2_*');
  else if (!s.publicStorage) faltan.push('bucket público de R2 para las portadas — R2_PUBLIC_BUCKET y R2_PUBLIC_URL');
  if (!s.bunny) faltan.push('Bunny Stream (videos) — BUNNY_LIBRARY_ID y BUNNY_API_KEY. Mientras tanto podés usar videos de YouTube');
  else if (!s.bunnyTokenAuth) faltan.push('BUNNY_TOKEN_KEY: sin esto los videos de Bunny no van firmados (cualquiera con el link los ve)');
  return faltan.length ? `<div class="msg error" style="display:block">Falta configurar en Render:<br>${faltan.map((f) => `• ${esc(f)}`).join('<br>')}</div>` : '';
}

function renderCursos() {
  CUR.course = null;
  const box = document.getElementById('cursos_root');
  box.innerHTML = `
  <div class="card">
    <div class="card-head"><h2>Cursos</h2><button type="button" class="small" data-act="nuevo">${ico('ph-plus')}Nuevo curso</button></div>
    <p class="muted">Los borradores no se ven en el sitio. Al publicar, el curso aparece en <a href="${SITE_URL}/cursos/" target="_blank" rel="noopener">auryx.com.ar/cursos</a> (la página indexable se genera en el próximo build del sitio, una vez por día o al publicar).</p>
    ${avisosConfig()}
    <div id="cursos_msg" class="msg" role="status"></div>
    <div id="curso_nuevo" class="hidden">
      <div class="row">
        <div><label for="nc_titulo">Título</label><input id="nc_titulo" maxlength="160" placeholder="Instalaciones on-grid: del techo al medidor"></div>
        <div><label for="nc_slug">Dirección (slug)</label><input id="nc_slug" maxlength="80" placeholder="instalaciones-on-grid" spellcheck="false"></div>
      </div>
      <div class="actions"><button type="button" data-act="crear">${ico('ph-check')}Crear borrador</button><button type="button" class="secondary" data-act="cancelar-nuevo">Cancelar</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Curso</th><th>Estado</th><th>Precio</th><th>Lecciones</th><th>Alumnos</th><th>Orden</th><th></th></tr></thead>
      <tbody>${CUR.list.length ? CUR.list.map((c, i) => `
        <tr><td><strong style="font-family:inherit">${esc(c.title)}</strong><br><span class="muted">/cursos/${esc(c.slug)}/</span></td>
        <td><span class="tag ${ESTADO_CURSO[c.status] ?? ''}">${esc(c.status)}</span></td>
        <td>${esc(pesos(c.priceArs))}</td><td>${c.lessons}</td><td>${c.enrollments}</td>
        <td style="white-space:nowrap"><button type="button" class="secondary small icon-only" data-act="curso-subir" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ico('ph-arrow-up')}</button><button type="button" class="secondary small icon-only" data-act="curso-bajar" data-i="${i}" ${i === CUR.list.length - 1 ? 'disabled' : ''} aria-label="Bajar">${ico('ph-arrow-down')}</button></td>
        <td><button type="button" class="small" data-act="editar" data-id="${c.id}">${ico('ph-pencil-simple')}Editar</button></td></tr>`).join('')
        : '<tr><td colspan="7">Todavía no hay cursos. Creá el primero con "Nuevo curso".</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

async function abrirCurso(id, mantenerSub = false) {
  CUR.course = await cursosApi(`/admin/courses/${id}`);
  if (!mantenerSub) { CUR.sub = 'datos'; CUR.lessonId = null; CUR.question = null; CUR.enrollments = null; }
  renderEditor();
}

/** Aplica el curso que devuelve la API después de un cambio y redibuja. */
function aplicar(course, msg) {
  CUR.course = course;
  renderEditor();
  if (msg) flash('curso_msg', msg);
}

// ============================================================ editor

function renderEditor() {
  const c = CUR.course;
  const box = document.getElementById('cursos_root');
  const sub = (id, label, icon) => `<button type="button" class="${CUR.sub === id ? '' : 'secondary'} small" data-act="sub" data-sub="${id}">${ico(icon)}${label}</button>`;
  box.innerHTML = `
  <div class="card">
    <div class="card-head">
      <div><button type="button" class="link" data-act="volver">${ico('ph-arrow-left')} Todos los cursos</button>
        <h2 style="margin-top:8px">${esc(c.title)} <span class="tag ${ESTADO_CURSO[c.status] ?? ''}">${esc(c.status)}</span></h2></div>
      <div class="actions" style="margin:0">${c.status === 'publicado' ? `<a href="${SITE_URL}/cursos/${encodeURIComponent(c.slug)}/" target="_blank" rel="noopener">Ver en el sitio ${ico('ph-arrow-square-out')}</a>` : ''}</div>
    </div>
    <div class="actions" style="margin-top:12px">${sub('datos', 'Datos', 'ph-info')}${sub('temario', 'Temario', 'ph-list-numbers')}${sub('alumnos', `Alumnos (${c._count?.enrollments ?? 0})`, 'ph-users')}</div>
    <div id="curso_msg" class="msg" role="status"></div>
  </div>
  ${CUR.sub === 'datos' ? datosHTML(c) : CUR.sub === 'temario' ? temarioHTML(c) : alumnosHTML()}`;
}

function imagenCampo(id, label, url, purpose) {
  return `<div><label for="${id}">${label}</label>
    <input id="${id}" value="${esc(url || '')}" placeholder="https://… (o subí una imagen)">
    <div class="actions" style="margin-top:8px"><input type="file" accept=".jpg,.jpeg,.png,.webp" data-upload="${purpose}" data-target="${id}" style="max-width:260px" aria-label="Subir ${label}"></div>
    ${url ? `<img src="${esc(url)}" alt="" style="margin-top:8px;max-width:220px;border-radius:8px;border:1px solid var(--line)">` : ''}</div>`;
}

function datosHTML(c) {
  return `
  <div class="card">
    <h2>Datos del curso</h2>
    <div class="row">
      <div><label for="cd_title">Título</label><input id="cd_title" value="${esc(c.title)}" maxlength="160"></div>
      <div><label for="cd_slug">Dirección (slug)</label><input id="cd_slug" value="${esc(c.slug)}" maxlength="80" spellcheck="false"></div>
    </div>
    <label for="cd_subtitle">Subtítulo</label><input id="cd_subtitle" value="${esc(c.subtitle)}" maxlength="300">
    <label for="cd_description">Descripción <span class="muted">(párrafos separados por una línea en blanco; "## " título, "- " lista, **negrita**, [texto](https://…))</span></label>
    <textarea id="cd_description" style="font-family:inherit;font-size:0.875rem;min-height:160px">${esc(c.description)}</textarea>
    <div class="row">
      <div><label for="cd_level">Nivel</label><select id="cd_level">${Object.entries(NIVELES).map(([k, v]) => `<option value="${k}" ${c.level === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label for="cd_hours">Horas (para el certificado)</label><input id="cd_hours" type="number" min="0" step="0.5" value="${esc(c.durationHours)}"></div>
      <div><label for="cd_price">Precio en pesos, IVA incluido (0 = gratis)</label><input id="cd_price" type="number" min="0" step="100" value="${esc(c.priceArs)}"></div>
      <div><label for="cd_status">Estado</label><select id="cd_status">${['borrador', 'publicado', 'archivado'].map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cd_sequential" ${c.sequential ? 'checked' : ''}> Orden obligatorio (cada lección se abre al completar la anterior)</label>
    <div class="row">${imagenCampo('cd_cover', 'Portada (16:9)', c.coverUrl, 'cover')}</div>
    <div class="row">
      <div><label for="cd_out">Qué vas a aprender <span class="muted">(uno por línea)</span></label><textarea id="cd_out" style="font-family:inherit;min-height:120px">${esc((c.outcomes || []).join('\n'))}</textarea></div>
      <div><label for="cd_req">Requisitos <span class="muted">(uno por línea)</span></label><textarea id="cd_req" style="font-family:inherit;min-height:120px">${esc((c.requirements || []).join('\n'))}</textarea></div>
    </div>
    <h2 style="margin-top:24px">Quién lo dicta</h2>
    <div class="row">
      <div><label for="cd_iname">Nombre</label><input id="cd_iname" value="${esc(c.instructorName)}" maxlength="120"></div>
      ${imagenCampo('cd_iphoto', 'Foto', c.instructorPhotoUrl, 'instructor')}
    </div>
    <label for="cd_ibio">Bio</label><textarea id="cd_ibio" style="font-family:inherit;min-height:80px">${esc(c.instructorBio)}</textarea>
    <div class="actions">
      <button type="button" data-act="guardar-datos">${ico('ph-floppy-disk')}Guardar</button>
      <button type="button" class="danger" data-act="borrar-curso">${ico('ph-trash')}Borrar curso</button>
    </div>
  </div>`;
}

function leccionFila(l, m, i) {
  const [icon, label] = TIPOS_LECCION[l.kind] || TIPOS_LECCION.video;
  const extras = [
    l.isPreview ? '<span class="tag ok">vista previa</span>' : '', l.isOptional ? '<span class="tag">opcional</span>' : '',
    l.kind === 'prueba' ? `<span class="tag">${l.questions.length} preguntas</span>` : '',
    l.videoProvider ? `<span class="tag">${esc(l.videoProvider)}</span>` : (l.kind === 'video' ? '<span class="tag warn">sin video</span>' : ''),
    l.resources.length ? `<span class="tag">${l.resources.length} recursos</span>` : '',
  ].join('');
  return `<tr${CUR.lessonId === l.id ? ' style="outline:2px solid var(--accent)"' : ''}><td>${ico(icon)} <span class="muted">${label}</span></td><td><strong style="font-family:inherit">${esc(l.title)}</strong><br>${extras}</td>
    <td>${l.durationMin ? `${l.durationMin} min` : '-'}</td>
    <td style="white-space:nowrap"><button type="button" class="secondary small icon-only" data-act="leccion-subir" data-m="${m.id}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ico('ph-arrow-up')}</button><button type="button" class="secondary small icon-only" data-act="leccion-bajar" data-m="${m.id}" data-i="${i}" ${i === m.lessons.length - 1 ? 'disabled' : ''} aria-label="Bajar">${ico('ph-arrow-down')}</button></td>
    <td style="white-space:nowrap"><button type="button" class="small" data-act="leccion-editar" data-id="${l.id}">${ico('ph-pencil-simple')}Editar</button><button type="button" class="danger small icon-only" data-act="leccion-borrar" data-id="${l.id}" aria-label="Borrar lección">${ico('ph-trash')}</button></td></tr>`;
}

function temarioHTML(c) {
  const mods = c.modules.map((m, i) => `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:220px"><label for="m_${m.id}" style="margin-top:0">Módulo ${i + 1}</label>
          <input id="m_${m.id}" value="${esc(m.title)}" maxlength="160"></div>
        <div class="actions" style="margin:0">
          <button type="button" class="secondary small" data-act="modulo-guardar" data-id="${m.id}">Guardar nombre</button>
          <button type="button" class="secondary small icon-only" data-act="modulo-subir" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir módulo">${ico('ph-arrow-up')}</button>
          <button type="button" class="secondary small icon-only" data-act="modulo-bajar" data-i="${i}" ${i === c.modules.length - 1 ? 'disabled' : ''} aria-label="Bajar módulo">${ico('ph-arrow-down')}</button>
          <button type="button" class="danger small icon-only" data-act="modulo-borrar" data-id="${m.id}" aria-label="Borrar módulo">${ico('ph-trash')}</button>
        </div>
      </div>
      <div class="table-wrap"><table><tbody>${m.lessons.length ? m.lessons.map((l, j) => leccionFila(l, m, j)).join('') : '<tr><td colspan="5">Sin lecciones.</td></tr>'}</tbody></table></div>
      <div class="row" style="align-items:flex-end">
        <div style="flex:2"><label for="nl_${m.id}">Nueva lección</label><input id="nl_${m.id}" maxlength="160" placeholder="Título de la lección"></div>
        <div><label for="nlk_${m.id}">Tipo</label><select id="nlk_${m.id}">${Object.entries(TIPOS_LECCION).map(([k, [, v]]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div style="flex:0"><button type="button" data-act="leccion-crear" data-m="${m.id}">${ico('ph-plus')}Agregar</button></div>
      </div>
    </div>`).join('');
  const lesson = CUR.lessonId ? c.modules.flatMap((m) => m.lessons).find((l) => l.id === CUR.lessonId) : null;
  return `${lesson ? leccionEditorHTML(lesson, c) : ''}
    ${mods || '<div class="card"><p class="muted">Todavía no hay módulos. Un módulo agrupa lecciones (ej. "1. Conceptos básicos").</p></div>'}
    <div class="card"><div class="row" style="align-items:flex-end">
      <div><label for="nm_titulo" style="margin-top:0">Nuevo módulo</label><input id="nm_titulo" maxlength="160" placeholder="Ej.: Dimensionamiento"></div>
      <div style="flex:0"><button type="button" data-act="modulo-crear">${ico('ph-plus')}Agregar módulo</button></div>
    </div></div>`;
}

// ------------------------------------------------------------ editor de lección

function leccionEditorHTML(l, c) {
  const [icon] = TIPOS_LECCION[l.kind] || TIPOS_LECCION.video;
  return `
  <div class="card" id="leccion_editor" style="border-color:var(--accent)">
    <div class="card-head"><h2>${ico(icon)} Editar lección</h2><button type="button" class="secondary small" data-act="leccion-cerrar">${ico('ph-x')}Cerrar</button></div>
    <div class="row">
      <div style="flex:2"><label for="le_title">Título</label><input id="le_title" value="${esc(l.title)}" maxlength="160"></div>
      <div><label for="le_kind">Tipo</label><select id="le_kind">${Object.entries(TIPOS_LECCION).map(([k, [, v]]) => `<option value="${k}" ${l.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label for="le_dur">Duración (min)</label><input id="le_dur" type="number" min="0" max="1000" value="${l.durationMin}"></div>
      <div><label for="le_mod">Módulo</label><select id="le_mod">${c.modules.map((m) => `<option value="${m.id}" ${m.id === l.moduleId ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select></div>
    </div>
    <div class="actions" style="gap:20px">
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="le_preview" ${l.isPreview ? 'checked' : ''}> Vista previa gratis (se ve sin inscripción)</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="le_optional" ${l.isOptional ? 'checked' : ''}> Opcional (no cuenta para el certificado)</label>
    </div>
    <label for="le_body">Texto de la lección <span class="muted">(mismo formato que la descripción)</span></label>
    <textarea id="le_body" style="font-family:inherit;font-size:0.875rem;min-height:160px">${esc(l.body)}</textarea>
    ${l.kind === 'prueba' ? `<div class="row">
      <div><label for="le_pass">Nota mínima (%)</label><input id="le_pass" type="number" min="1" max="100" value="${l.passPct}"></div>
      <div><label for="le_attempts">Intentos máximos <span class="muted">(vacío = sin límite)</span></label><input id="le_attempts" type="number" min="1" max="100" value="${l.maxAttempts ?? ''}"></div>
    </div>` : ''}
    ${l.kind === 'tarea' ? `<label for="le_instr">Consigna de la tarea</label><textarea id="le_instr" style="font-family:inherit;font-size:0.875rem;min-height:120px">${esc(l.instructions)}</textarea>` : ''}
    <div class="actions"><button type="button" data-act="leccion-guardar" data-id="${l.id}">${ico('ph-floppy-disk')}Guardar lección</button></div>

    <h2 style="margin-top:28px">${ico('ph-video-camera')} Video</h2>
    ${videoHTML(l)}

    ${l.kind === 'prueba' ? preguntasHTML(l) : ''}

    <h2 style="margin-top:28px">${ico('ph-paperclip')} Recursos</h2>
    ${l.resources.length ? `<div class="table-wrap"><table><tbody>${l.resources.map((r, i) => `<tr>
      <td>${r.kind === 'link' ? ico('ph-link') : ico('ph-file')} <strong style="font-family:inherit">${esc(r.title)}</strong><br><span class="muted">${r.kind === 'link' ? esc(r.url) : `${esc(r.fileName || '')}${r.fileSize ? ` · ${(r.fileSize / 1048576).toFixed(1)} MB` : ''}`}</span></td>
      <td style="white-space:nowrap"><button type="button" class="secondary small icon-only" data-act="recurso-subir" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ico('ph-arrow-up')}</button><button type="button" class="secondary small icon-only" data-act="recurso-bajar" data-i="${i}" ${i === l.resources.length - 1 ? 'disabled' : ''} aria-label="Bajar">${ico('ph-arrow-down')}</button>
      <button type="button" class="secondary small" data-act="recurso-ver" data-id="${r.id}">Abrir</button><button type="button" class="danger small icon-only" data-act="recurso-borrar" data-id="${r.id}" aria-label="Borrar recurso">${ico('ph-trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin recursos.</p>'}
    <div class="row" style="align-items:flex-end">
      <div><label for="re_title">Nombre del recurso</label><input id="re_title" maxlength="160" placeholder="Planilla de dimensionamiento"></div>
      <div><label for="re_url">Link <span class="muted">(o elegí un archivo)</span></label><input id="re_url" placeholder="https://…"></div>
      <div><label for="re_file">Archivo (hasta 200 MB)</label><input id="re_file" type="file" accept=".pdf,.zip,.xlsx,.docx,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp"></div>
      <div style="flex:0"><button type="button" data-act="recurso-agregar" data-id="${l.id}">${ico('ph-plus')}Agregar</button></div>
    </div>
    <div id="recurso_estado" class="muted" role="status"></div>
  </div>`;
}

function videoHTML(l) {
  const bunnyOk = CUR.status?.bunny;
  return `
    <p class="muted">${l.videoProvider === 'bunny' ? `Video en Bunny: <code>${esc(l.videoId)}</code>` : l.videoProvider === 'youtube' ? `YouTube: <code>${esc(l.videoId)}</code> (cualquiera con el link lo puede ver: usalo para vistas previas)` : 'Esta lección no tiene video.'}</p>
    <div class="row" style="align-items:flex-end">
      <div><label for="vi_file">Subir a Bunny Stream ${bunnyOk ? '' : '<span class="muted">(falta configurar)</span>'}</label><input id="vi_file" type="file" accept="video/*" ${bunnyOk ? '' : 'disabled'}></div>
      <div style="flex:0"><button type="button" data-act="video-subir" data-id="${l.id}" ${bunnyOk ? '' : 'disabled'}>${ico('ph-upload-simple')}Subir video</button></div>
      ${l.videoProvider === 'bunny' ? `<div style="flex:0"><button type="button" class="secondary" data-act="video-estado" data-id="${l.id}">${ico('ph-arrows-clockwise')}Ver estado</button></div>` : ''}
    </div>
    <progress id="vi_prog" max="100" value="0" class="hidden" style="width:100%;margin-top:10px"></progress>
    <div id="vi_estado" class="muted" role="status"></div>
    <div class="row" style="align-items:flex-end">
      <div><label for="vi_yt">O pegá un link de YouTube</label><input id="vi_yt" placeholder="https://youtu.be/…" value="${l.videoProvider === 'youtube' ? esc(l.videoId) : ''}"></div>
      <div style="flex:0"><button type="button" class="secondary" data-act="video-youtube" data-id="${l.id}">Usar YouTube</button></div>
      ${l.videoProvider ? `<div style="flex:0"><button type="button" class="danger" data-act="video-quitar" data-id="${l.id}">${ico('ph-trash')}Quitar video</button></div>` : ''}
    </div>`;
}

function preguntasHTML(l) {
  const q = CUR.question;
  const editando = q && q.lessonId === l.id ? q : null;
  return `
    <h2 style="margin-top:28px">${ico('ph-exam')} Preguntas (${l.questions.length})</h2>
    ${l.questions.length ? `<div class="table-wrap"><table><tbody>${l.questions.map((p, i) => `<tr>
      <td><span class="muted">${i + 1}. ${esc(TIPOS_PREGUNTA[p.kind] || p.kind)}</span><br><strong style="font-family:inherit">${esc(p.prompt)}</strong><br>
        ${(p.options || []).map((o) => `<span class="tag ${o.correct ? 'ok' : ''}">${o.correct ? '✓ ' : ''}${esc(o.text)}</span>`).join('')}</td>
      <td style="white-space:nowrap"><button type="button" class="secondary small icon-only" data-act="pregunta-subir" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ico('ph-arrow-up')}</button><button type="button" class="secondary small icon-only" data-act="pregunta-bajar" data-i="${i}" ${i === l.questions.length - 1 ? 'disabled' : ''} aria-label="Bajar">${ico('ph-arrow-down')}</button>
      <button type="button" class="small" data-act="pregunta-editar" data-id="${p.id}">Editar</button><button type="button" class="danger small icon-only" data-act="pregunta-borrar" data-id="${p.id}" aria-label="Borrar pregunta">${ico('ph-trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Todavía no hay preguntas: la prueba no se puede rendir hasta que tenga al menos una.</p>'}
    ${editando ? preguntaFormHTML(editando) : `<div class="actions"><button type="button" class="secondary" data-act="pregunta-nueva" data-id="${l.id}">${ico('ph-plus')}Nueva pregunta</button></div>`}`;
}

function preguntaFormHTML(q) {
  const opciones = q.kind === 'vf' ? '' : `
    <label>Opciones <span class="muted">(marcá ${q.kind === 'unica' ? 'la correcta' : 'las correctas'})</span></label>
    ${q.options.map((o, i) => `<div class="row" style="align-items:center;margin-top:6px">
      <div style="flex:0;min-width:0"><input type="${q.kind === 'unica' ? 'radio' : 'checkbox'}" name="pq_ok" data-qopt="${i}" ${o.correct ? 'checked' : ''} aria-label="Correcta" style="width:18px;height:18px;min-height:0"></div>
      <div><input data-qtext="${i}" value="${esc(o.text)}" maxlength="500" placeholder="Opción ${i + 1}"></div>
      <div style="flex:0;min-width:0"><button type="button" class="danger small icon-only" data-act="opcion-borrar" data-i="${i}" ${q.options.length <= 2 ? 'disabled' : ''} aria-label="Borrar opción">${ico('ph-x')}</button></div></div>`).join('')}
    <button type="button" class="secondary small" data-act="opcion-agregar" style="margin-top:8px" ${q.options.length >= 10 ? 'disabled' : ''}>${ico('ph-plus')}Opción</button>`;
  return `<div class="card" style="margin-top:14px;background:var(--bg-raised)">
    <h2>${q.id ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
    <div class="row">
      <div style="flex:0;min-width:200px"><label for="pq_kind">Tipo</label><select id="pq_kind" data-act-change="pregunta-tipo">${Object.entries(TIPOS_PREGUNTA).map(([k, v]) => `<option value="${k}" ${q.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label for="pq_prompt">Enunciado</label><input id="pq_prompt" value="${esc(q.prompt)}" maxlength="2000"></div>
    </div>
    ${q.kind === 'vf' ? `<label>Respuesta correcta</label><div class="actions" style="gap:18px">
      <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="pq_vf" value="v" ${q.answer !== false ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Verdadero</label>
      <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="pq_vf" value="f" ${q.answer === false ? 'checked' : ''} style="width:18px;height:18px;min-height:0"> Falso</label></div>` : opciones}
    <label for="pq_expl">Explicación <span class="muted">(opcional, solo para vos)</span></label><input id="pq_expl" value="${esc(q.explanation || '')}" maxlength="2000">
    <div class="actions"><button type="button" data-act="pregunta-guardar">${ico('ph-floppy-disk')}Guardar pregunta</button><button type="button" class="secondary" data-act="pregunta-cancelar">Cancelar</button></div>
  </div>`;
}

/** Lee el formulario de pregunta al estado (para no perder lo tipeado al agregar o sacar opciones). */
function leerPregunta() {
  const q = CUR.question;
  if (!q) return;
  q.prompt = document.getElementById('pq_prompt')?.value ?? q.prompt;
  q.explanation = document.getElementById('pq_expl')?.value ?? q.explanation;
  if (q.kind === 'vf') {
    const v = document.querySelector('input[name="pq_vf"]:checked');
    q.answer = v ? v.value === 'v' : true;
  } else {
    q.options = q.options.map((o, i) => ({
      ...o,
      text: document.querySelector(`[data-qtext="${i}"]`)?.value ?? o.text,
      correct: !!document.querySelector(`[data-qopt="${i}"]`)?.checked,
    }));
  }
}

// ------------------------------------------------------------ alumnos

function alumnosHTML() {
  const rows = CUR.enrollments;
  return `<div class="card">
    <h2>Alumnos</h2>
    <p class="muted">Para inscribir a alguien a mano (un regalo, un pago por fuera) tiene que haber ingresado al sitio al menos una vez con Google.</p>
    <div class="row" style="align-items:flex-end">
      <div><label for="al_email">Email del cliente</label><input id="al_email" type="email" placeholder="nombre@gmail.com"></div>
      <div style="flex:0"><button type="button" data-act="alumno-inscribir">${ico('ph-user-plus')}Inscribir</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Inscripción</th><th>Alumno</th><th>Estado</th><th>Avance</th><th>Certificado</th><th></th></tr></thead>
      <tbody>${!rows ? '<tr><td colspan="6">Cargando…</td></tr>' : rows.length ? rows.map((e) => `<tr>
        <td><strong>${esc(e.code)}</strong><br><span class="muted">${new Date(e.createdAt).toLocaleDateString('es-AR')} · ${esc(e.source)}${e.priceArs ? ` · ${esc(pesos(e.priceArs))}` : ''}</span></td>
        <td>${esc(e.customer.name)}<br><span class="muted">${esc(e.customer.email)}</span></td>
        <td><span class="tag ${ESTADO_INSCRIPCION[e.status] ?? ''}">${esc(e.status.replace('_', ' '))}</span></td>
        <td>${e.progressPct} %</td>
        <td>${e.certificate ? `<a href="${SITE_URL}/certificados/${esc(e.certificate.code)}/" target="_blank" rel="noopener">${esc(e.certificate.code)}</a>${e.certificate.revoked ? ' <span class="tag bad">revocado</span>' : ''}` : '-'}</td>
        <td>${e.status === 'activa'
          ? `<button type="button" class="danger small" data-act="alumno-estado" data-id="${e.id}" data-estado="cancelada">Quitar acceso</button>`
          : `<button type="button" class="secondary small" data-act="alumno-estado" data-id="${e.id}" data-estado="activa">Dar acceso</button>`}</td></tr>`).join('')
        : '<tr><td colspan="6">Todavía no hay alumnos.</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

async function cargarAlumnos() {
  CUR.enrollments = null;
  renderEditor();
  CUR.enrollments = await cursosApi(`/admin/courses/${CUR.course.id}/enrollments`);
  if (CUR.sub === 'alumnos') renderEditor();
}

// ------------------------------------------------------------ video (Bunny, TUS)

function subirVideo(lessonId, file, auth) {
  return new Promise((resolve, reject) => {
    if (typeof tus === 'undefined') { reject(new Error('No cargó la librería de subida (tus-js-client). Recargá la página.')); return; }
    const prog = document.getElementById('vi_prog');
    const estado = document.getElementById('vi_estado');
    prog.classList.remove('hidden');
    const upload = new tus.Upload(file, {
      endpoint: auth.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      chunkSize: 50 * 1024 * 1024,
      headers: { AuthorizationSignature: auth.signature, AuthorizationExpire: String(auth.expires), VideoId: auth.videoId, LibraryId: String(auth.libraryId) },
      metadata: { filetype: file.type || 'video/mp4', title: file.name },
      onError: (err) => reject(new Error(`La subida falló: ${err.message || err}`)),
      onProgress: (sent, total) => {
        const pct = Math.round((sent / total) * 100);
        prog.value = pct;
        estado.textContent = `Subiendo… ${pct} % (${(sent / 1048576).toFixed(0)} de ${(total / 1048576).toFixed(0)} MB). No cierres esta pestaña.`;
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

async function estadoVideo(lessonId) {
  const estado = document.getElementById('vi_estado');
  const s = await cursosApi(`/admin/lessons/${lessonId}/video`);
  const txt = { esperando_subida: 'Esperando la subida', subido: 'Subido, en cola para procesar', procesando: 'Procesando', codificando: `Codificando (${s.encodeProgress} %)`, listo: 'Listo para ver', error: 'Error al codificar', error_subida: 'Falló la subida' }[s.status] || s.status;
  if (estado) estado.innerHTML = `Estado: <strong>${esc(txt)}</strong>${s.status === 'listo' && s.embedUrl ? ` · <a href="${esc(s.embedUrl)}" target="_blank" rel="noopener">Ver</a>` : ''}`;
  return s;
}

// ============================================================ acciones (Cursos)

function moverEn(lista, i, delta) {
  const ids = lista.map((x) => x.id);
  const j = i + delta;
  if (j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}
const leccionActual = () => CUR.course.modules.flatMap((m) => m.lessons).find((l) => l.id === CUR.lessonId);

document.getElementById('cursos_root').addEventListener('change', async (e) => {
  // cambiar el tipo de pregunta rearma las opciones
  if (e.target.id === 'pq_kind') {
    leerPregunta();
    const q = CUR.question;
    q.kind = e.target.value;
    if (q.kind !== 'vf' && q.options.length < 2) q.options = [{ text: '', correct: false }, { text: '', correct: false }];
    renderEditor();
    return;
  }
  // subir portada o foto: la URL pública queda en el campo y se guarda con "Guardar"
  const purpose = e.target.dataset.upload;
  if (purpose && e.target.files[0]) {
    const target = document.getElementById(e.target.dataset.target);
    try {
      flash('curso_msg', 'Subiendo la imagen…');
      const up = await subirArchivo(e.target.files[0], purpose, CUR.course.id);
      target.value = up.publicUrl;
      flash('curso_msg', 'Imagen subida. Tocá "Guardar" para usarla.');
    } catch (err) { flash('curso_msg', err.message, false); }
  }
});

document.getElementById('cursos_root').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.act;
  const id = Number(btn.dataset.id);
  const c = CUR.course;
  const run = async (fn, okMsg) => {
    btn.disabled = true;
    try { const r = await fn(); if (r && r.modules) aplicar(r, okMsg); else if (okMsg) flash(c ? 'curso_msg' : 'cursos_msg', okMsg); }
    catch (err) { flash(document.getElementById('curso_msg') ? 'curso_msg' : 'cursos_msg', err.message, false); }
    finally { btn.disabled = false; }
  };

  switch (act) {
    // ---- lista
    case 'nuevo': document.getElementById('curso_nuevo').classList.remove('hidden'); document.getElementById('nc_titulo').focus(); break;
    case 'cancelar-nuevo': document.getElementById('curso_nuevo').classList.add('hidden'); break;
    case 'crear': {
      const title = document.getElementById('nc_titulo').value.trim();
      const slug = document.getElementById('nc_slug').value.trim() || slugDe(title);
      await run(async () => { const r = await cursosApi('/admin/courses', jsonBody('POST', { title, slug })); CUR.sub = 'datos'; CUR.list = await cursosApi('/admin/courses'); return r; }, 'Curso creado como borrador.');
      break;
    }
    case 'editar': await run(() => abrirCurso(id)); break;
    case 'curso-subir': case 'curso-bajar': {
      const ids = moverEn(CUR.list, Number(btn.dataset.i), act === 'curso-subir' ? -1 : 1);
      if (ids) await run(async () => { CUR.list = await cursosApi('/admin/courses/order', jsonBody('PATCH', { ids })); renderCursos(); });
      break;
    }
    case 'volver': CUR.course = null; CUR.list = await cursosApi('/admin/courses'); renderCursos(); break;
    case 'sub':
      CUR.sub = btn.dataset.sub;
      if (CUR.sub === 'alumnos') await run(cargarAlumnos); else renderEditor();
      break;

    // ---- datos
    case 'guardar-datos': {
      const v = (k) => document.getElementById(k).value;
      const body = {
        title: v('cd_title'), slug: v('cd_slug').trim(), subtitle: v('cd_subtitle'), description: v('cd_description'),
        level: v('cd_level'), durationHours: Number(v('cd_hours') || 0), priceArs: Number(v('cd_price') || 0), status: v('cd_status'),
        sequential: document.getElementById('cd_sequential').checked,
        coverUrl: v('cd_cover').trim() || null, instructorName: v('cd_iname'), instructorBio: v('cd_ibio'),
        instructorPhotoUrl: v('cd_iphoto').trim() || null, outcomes: lineas(v('cd_out')), requirements: lineas(v('cd_req')),
      };
      await run(() => cursosApi(`/admin/courses/${c.id}`, jsonBody('PUT', body)), 'Curso guardado.');
      break;
    }
    case 'borrar-curso':
      if (!confirm(`¿Borrar el curso "${c.title}" con todos sus módulos, lecciones, videos y archivos? No se puede deshacer.`)) return;
      await run(async () => { await cursosApi(`/admin/courses/${c.id}`, { method: 'DELETE' }); CUR.course = null; CUR.list = await cursosApi('/admin/courses'); renderCursos(); flash('cursos_msg', 'Curso borrado.'); });
      break;

    // ---- módulos
    case 'modulo-crear': await run(() => cursosApi(`/admin/courses/${c.id}/modules`, jsonBody('POST', { title: document.getElementById('nm_titulo').value })), 'Módulo agregado.'); break;
    case 'modulo-guardar': await run(() => cursosApi(`/admin/modules/${id}`, jsonBody('PUT', { title: document.getElementById(`m_${id}`).value })), 'Módulo guardado.'); break;
    case 'modulo-borrar': {
      const m = c.modules.find((x) => x.id === id);
      if (!confirm(`¿Borrar el módulo "${m.title}" y sus ${m.lessons.length} lecciones (con videos, recursos y el avance de los alumnos)?`)) return;
      await run(() => cursosApi(`/admin/modules/${id}`, { method: 'DELETE' }), 'Módulo borrado.');
      break;
    }
    case 'modulo-subir': case 'modulo-bajar': {
      const ids = moverEn(c.modules, Number(btn.dataset.i), act === 'modulo-subir' ? -1 : 1);
      if (ids) await run(() => cursosApi(`/admin/courses/${c.id}/modules/order`, jsonBody('PATCH', { ids })));
      break;
    }

    // ---- lecciones
    case 'leccion-crear': {
      const m = btn.dataset.m;
      await run(() => cursosApi(`/admin/modules/${m}/lessons`, jsonBody('POST', { title: document.getElementById(`nl_${m}`).value, kind: document.getElementById(`nlk_${m}`).value })), 'Lección agregada. Tocá "Editar" para cargar el contenido.');
      break;
    }
    case 'leccion-editar': CUR.lessonId = id; CUR.question = null; renderEditor(); document.getElementById('leccion_editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'leccion-cerrar': CUR.lessonId = null; CUR.question = null; renderEditor(); break;
    case 'leccion-guardar': {
      const v = (k) => document.getElementById(k)?.value;
      const body = {
        title: v('le_title'), kind: v('le_kind'), durationMin: Number(v('le_dur') || 0), moduleId: Number(v('le_mod')),
        isPreview: document.getElementById('le_preview').checked, isOptional: document.getElementById('le_optional').checked, body: v('le_body'),
      };
      if (document.getElementById('le_pass')) { body.passPct = Number(v('le_pass') || 70); body.maxAttempts = v('le_attempts') === '' ? null : Number(v('le_attempts')); }
      if (document.getElementById('le_instr')) body.instructions = v('le_instr');
      await run(() => cursosApi(`/admin/lessons/${id}`, jsonBody('PUT', body)), 'Lección guardada.');
      break;
    }
    case 'leccion-borrar': {
      const l = c.modules.flatMap((m) => m.lessons).find((x) => x.id === id);
      if (!confirm(`¿Borrar la lección "${l.title}" (con su video, recursos, intentos y entregas)?`)) return;
      if (CUR.lessonId === id) CUR.lessonId = null;
      await run(() => cursosApi(`/admin/lessons/${id}`, { method: 'DELETE' }), 'Lección borrada.');
      break;
    }
    case 'leccion-subir': case 'leccion-bajar': {
      const m = c.modules.find((x) => x.id === Number(btn.dataset.m));
      const ids = moverEn(m.lessons, Number(btn.dataset.i), act === 'leccion-subir' ? -1 : 1);
      if (ids) await run(() => cursosApi(`/admin/modules/${m.id}/lessons/order`, jsonBody('PATCH', { ids })));
      break;
    }

    // ---- video
    case 'video-subir': {
      const file = document.getElementById('vi_file').files[0];
      if (!file) { flash('curso_msg', 'Elegí el archivo del video.', false); return; }
      btn.disabled = true;
      try {
        const auth = await cursosApi(`/admin/lessons/${id}/video`, { method: 'POST' });
        await subirVideo(id, file, auth);
        document.getElementById('vi_estado').textContent = 'Subido. Bunny lo está codificando: puede tardar unos minutos.';
        CUR.course = await cursosApi(`/admin/courses/${c.id}`);
        flash('curso_msg', 'Video subido. Revisá el estado en unos minutos con "Ver estado".');
        renderEditor();
      } catch (err) { flash('curso_msg', err.message, false); btn.disabled = false; }
      break;
    }
    case 'video-estado': await run(() => estadoVideo(id)); break;
    case 'video-youtube': await run(() => cursosApi(`/admin/lessons/${id}`, jsonBody('PUT', { videoProvider: 'youtube', videoId: document.getElementById('vi_yt').value })), 'Video de YouTube guardado.'); break;
    case 'video-quitar':
      if (!confirm('¿Sacar el video de esta lección? Si es de Bunny, se borra.')) return;
      await run(() => cursosApi(`/admin/lessons/${id}`, jsonBody('PUT', { videoProvider: null })), 'Video quitado.');
      break;

    // ---- recursos
    case 'recurso-agregar': {
      const title = document.getElementById('re_title').value.trim();
      const url = document.getElementById('re_url').value.trim();
      const file = document.getElementById('re_file').files[0];
      const estado = document.getElementById('recurso_estado');
      if (!file && !url) { flash('curso_msg', 'Pegá un link o elegí un archivo.', false); return; }
      await run(async () => {
        if (!file) return cursosApi(`/admin/lessons/${id}/resources`, jsonBody('POST', { kind: 'link', title, url }));
        estado.textContent = `Subiendo ${file.name}…`;
        const up = await subirArchivo(file, 'resource', c.id);
        estado.textContent = '';
        return cursosApi(`/admin/lessons/${id}/resources`, jsonBody('POST', { kind: 'archivo', title: title || up.fileName, key: up.key, fileName: up.fileName, fileSize: up.fileSize }));
      }, 'Recurso agregado.');
      break;
    }
    case 'recurso-ver': {
      const win = window.open('', '_blank');
      try { const { url } = await cursosApi(`/admin/resources/${id}/download`); win.opener = null; win.location.href = url; }
      catch (err) { win.close(); flash('curso_msg', err.message, false); }
      break;
    }
    case 'recurso-borrar':
      if (!confirm('¿Borrar este recurso?')) return;
      await run(() => cursosApi(`/admin/resources/${id}`, { method: 'DELETE' }), 'Recurso borrado.');
      break;
    case 'recurso-subir': case 'recurso-bajar': {
      const l = leccionActual();
      const ids = moverEn(l.resources, Number(btn.dataset.i), act === 'recurso-subir' ? -1 : 1);
      if (ids) await run(() => cursosApi(`/admin/lessons/${l.id}/resources/order`, jsonBody('PATCH', { ids })));
      break;
    }

    // ---- preguntas
    case 'pregunta-nueva': CUR.question = { lessonId: id, id: null, kind: 'unica', prompt: '', explanation: '', answer: true, options: [{ text: '', correct: true }, { text: '', correct: false }] }; renderEditor(); document.getElementById('pq_prompt')?.focus(); break;
    case 'pregunta-editar': {
      const p = leccionActual().questions.find((x) => x.id === id);
      CUR.question = { lessonId: CUR.lessonId, id: p.id, kind: p.kind, prompt: p.prompt, explanation: p.explanation, answer: (p.options || []).find((o) => o.id === 'v')?.correct !== false, options: (p.options || []).map((o) => ({ ...o })) };
      renderEditor();
      break;
    }
    case 'pregunta-cancelar': CUR.question = null; renderEditor(); break;
    case 'opcion-agregar': leerPregunta(); CUR.question.options.push({ text: '', correct: false }); renderEditor(); break;
    case 'opcion-borrar': leerPregunta(); CUR.question.options.splice(Number(btn.dataset.i), 1); renderEditor(); break;
    case 'pregunta-guardar': {
      leerPregunta();
      const q = CUR.question;
      const body = { kind: q.kind, prompt: q.prompt, explanation: q.explanation, ...(q.kind === 'vf' ? { answer: q.answer } : { options: q.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })) }) };
      await run(async () => {
        const r = await cursosApi(q.id ? `/admin/questions/${q.id}` : `/admin/lessons/${q.lessonId}/questions`, jsonBody(q.id ? 'PUT' : 'POST', body));
        CUR.question = null;
        return r;
      }, 'Pregunta guardada.');
      break;
    }
    case 'pregunta-borrar':
      if (!confirm('¿Borrar esta pregunta?')) return;
      await run(() => cursosApi(`/admin/questions/${id}`, { method: 'DELETE' }), 'Pregunta borrada.');
      break;
    case 'pregunta-subir': case 'pregunta-bajar': {
      const l = leccionActual();
      const ids = moverEn(l.questions, Number(btn.dataset.i), act === 'pregunta-subir' ? -1 : 1);
      if (ids) await run(() => cursosApi(`/admin/lessons/${l.id}/questions/order`, jsonBody('PATCH', { ids })));
      break;
    }

    // ---- alumnos
    case 'alumno-inscribir':
      await run(async () => { CUR.enrollments = await cursosApi(`/admin/courses/${c.id}/enrollments`, jsonBody('POST', { email: document.getElementById('al_email').value })); renderEditor(); }, 'Alumno inscripto: le mandamos un mail con el acceso.');
      break;
    case 'alumno-estado': {
      const estado = btn.dataset.estado;
      if (estado === 'cancelada' && !confirm('¿Quitarle el acceso al curso? (Si pagó, la devolución se hace aparte en Mercado Pago.)')) return;
      await run(async () => { CUR.enrollments = await cursosApi(`/admin/enrollments/${id}`, jsonBody('PATCH', { status: estado })); renderEditor(); }, 'Inscripción actualizada.');
      break;
    }
    default:
  }
});

// ============================================================ Entregas

async function cargarEntregas() {
  const filtro = document.getElementById('entregas_filtro').value;
  const rows = await cursosApi(`/admin/submissions${filtro ? `?status=${encodeURIComponent(filtro)}` : ''}`);
  document.querySelector('#tabla_entregas tbody').innerHTML = rows.length ? rows.map((s) => {
    const [tono, label] = ESTADO_ENTREGA[s.status] || ['', s.status];
    return `<tr><td>${new Date(s.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}<br><span class="tag ${tono}">${label}</span></td>
      <td>${esc(s.customer.name)}<br><span class="muted">${esc(s.customer.email)}</span></td>
      <td><strong style="font-family:inherit">${esc(s.lesson.title)}</strong><br><span class="muted">${esc(s.course.title)}</span></td>
      <td style="min-width:260px">${s.text ? `<div style="white-space:pre-wrap">${esc(s.text)}</div>` : ''}${s.hasFile ? `<button type="button" class="secondary small" data-ent="bajar" data-id="${s.id}" style="margin-top:6px">${ico('ph-download-simple')}${esc(s.fileName || 'Archivo')}</button>` : ''}</td>
      <td style="min-width:260px"><textarea data-ent-feedback="${s.id}" placeholder="Comentario para el alumno" style="min-height:70px;font-family:inherit">${esc(s.feedback)}</textarea>
        <div class="actions" style="gap:6px"><button type="button" class="small" data-ent="aprobada" data-id="${s.id}" style="margin-top:6px">${ico('ph-check')}Aprobar</button>
        <button type="button" class="danger small" data-ent="a_rehacer" data-id="${s.id}" style="margin-top:6px">A rehacer</button></div></td></tr>`;
  }).join('') : '<tr><td colspan="5">No hay entregas con este filtro.</td></tr>';
}

document.getElementById('entregas_filtro').addEventListener('change', () => cargarEntregas().catch((err) => flash('entregas_msg', err.message, false)));
document.getElementById('tabla_entregas').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-ent]');
  if (!btn) return;
  const id = btn.dataset.id;
  btn.disabled = true;
  try {
    if (btn.dataset.ent === 'bajar') {
      const win = window.open('', '_blank');
      try { const { url } = await cursosApi(`/admin/submissions/${id}/download`); win.opener = null; win.location.href = url; } catch (err) { win.close(); throw err; }
    } else {
      const feedback = document.querySelector(`[data-ent-feedback="${id}"]`).value;
      await cursosApi(`/admin/submissions/${id}`, jsonBody('PATCH', { status: btn.dataset.ent, feedback }));
      flash('entregas_msg', btn.dataset.ent === 'aprobada' ? 'Entrega aprobada: la lección quedó completa y le avisamos al alumno.' : 'Le pedimos al alumno que la rehaga.');
      await cargarEntregas();
    }
  } catch (err) { flash('entregas_msg', err.message, false); }
  finally { btn.disabled = false; }
});

// ============================================================ Certificados

async function cargarCertificados() {
  const q = document.getElementById('certs_q').value.trim();
  const rows = await cursosApi(`/admin/certificates${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  renderCertificados(rows);
}

function renderCertificados(rows) {
  document.querySelector('#tabla_certs tbody').innerHTML = rows.length ? rows.map((c) => `<tr>
    <td><a href="${SITE_URL}/certificados/${esc(c.code)}/" target="_blank" rel="noopener"><strong>${esc(c.code)}</strong></a></td>
    <td>${esc(c.name)}<br><span class="muted">${esc(c.email)}</span></td>
    <td>${esc(c.courseTitle)}<br><span class="muted">${String(c.hours).replace('.', ',')} h</span></td>
    <td>${new Date(c.issuedAt).toLocaleDateString('es-AR')}</td>
    <td>${c.revokedAt ? `<span class="tag bad">revocado</span><br><span class="muted">${esc(c.revokeReason || '')}</span>` : '<span class="tag ok">válido</span>'}</td>
    <td>${c.revokedAt
      ? `<button type="button" class="secondary small" data-cert="restaurar" data-id="${c.id}">Restaurar</button>`
      : `<button type="button" class="danger small" data-cert="revocar" data-id="${c.id}">Revocar</button>`}</td></tr>`).join('')
    : '<tr><td colspan="6">No hay certificados.</td></tr>';
}

let certsTimer;
document.getElementById('certs_q').addEventListener('input', () => { clearTimeout(certsTimer); certsTimer = setTimeout(() => cargarCertificados().catch((err) => flash('certs_msg', err.message, false)), 300); });
document.getElementById('tabla_certs').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-cert]');
  if (!btn) return;
  const revocar = btn.dataset.cert === 'revocar';
  let reason = '';
  if (revocar) {
    reason = prompt('Motivo de la revocación (queda registrado):') || '';
    if (!reason.trim()) return;
  } else if (!confirm('¿Restaurar este certificado? Vuelve a ser válido.')) return;
  btn.disabled = true;
  try {
    renderCertificados(await cursosApi(`/admin/certificates/${btn.dataset.id}`, jsonBody('PATCH', { revoked: revocar, reason })));
    flash('certs_msg', revocar ? 'Certificado revocado.' : 'Certificado restaurado.');
  } catch (err) { flash('certs_msg', err.message, false); btn.disabled = false; }
});
