/* AURYX: Sesión del cliente (ingreso con Google). Depende de: config.js (GOOGLE_CLIENT_ID); usa storageGet/storageSet de app.js en tiempo de ejecución. */

/* =========================================================================
   La sesión es el token que devuelve POST /customer-auth/google más los
   datos públicos del cliente. Se guarda en localStorage (no en cookies: el
   sitio y la API están en dominios distintos y Safari las bloquearía).
   ========================================================================= */

const SESSION_KEY = "auryx-session";
// Página a la que se vuelve después de ingresar (sessionStorage: dura lo que la pestaña)
const AFTER_LOGIN_KEY = "auryx-after-login";

/* { token, customer } o null si no hay sesión (o lo guardado está roto). */
function getSession() {
  let s = null;
  try { s = JSON.parse(storageGet(SESSION_KEY) || "null"); } catch (e) { s = null; }
  if (!s || typeof s.token !== "string" || !s.token || !s.customer || typeof s.customer !== "object") return null;
  return s;
}

function setSession(s) { storageSet(SESSION_KEY, JSON.stringify({ token: s.token, customer: s.customer })); }

/* Borra la sesión. El carrito no se toca. */
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* modo privado: se ignora */ }
}

/* Recuerda a qué página volver después de ingresar (nunca a #ingresar). */
function rememberAfterLogin(hash) {
  const h = (hash || "").replace(/^#/, "");
  if (h === "ingresar") return;
  try { sessionStorage.setItem(AFTER_LOGIN_KEY, h); } catch (e) { /* se ignora */ }
}

/* Devuelve el hash guardado (sin "#") y lo borra; "" si no había. */
function takeAfterLogin() {
  let h = "";
  try {
    h = sessionStorage.getItem(AFTER_LOGIN_KEY) || "";
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
  } catch (e) { h = ""; }
  return h === "ingresar" ? "" : h;
}

/* Carga el script de Google Identity Services una sola vez. Rechaza si no carga
   (bloqueador, sin red) o si tarda más de 10 s; en ese caso se puede reintentar. */
let googleScriptPromise = null;
function loadGoogleScript() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => fail(new Error("El script de Google tardó demasiado.")), 10000);
    function fail(err) {
      clearTimeout(timer);
      script.remove();
      googleScriptPromise = null; // permite reintentar en la próxima visita a #ingresar
      reject(err);
    }
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) { clearTimeout(timer); resolve(); }
      else fail(new Error("El script de Google cargó incompleto."));
    };
    script.onerror = () => fail(new Error("No se pudo cargar el script de Google."));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}
