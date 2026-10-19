/* =========================================================================
   AURYX — Configuración de entorno
   Sin bundler (Vite/Webpack), un sitio estático no puede leer variables de
   entorno reales del sistema operativo. Este archivo cumple esa función:
   es el ÚNICO lugar que hay que tocar al mover el proyecto a otro servidor,
   cambiar el puerto del backend, o pasar a producción.

   Se carga ANTES que cualquier otro script (ver index.html), así que estas
   constantes quedan disponibles para todo el resto del frontend.
   Lo que queda vacío ("") se oculta del sitio: nunca se muestra un dato de relleno.
   ========================================================================= */

// URL base del backend (compragamer-api). Cambiar acá si:
// - corre en otro puerto en tu máquina
// - lo desplegás en un servidor/dominio real (ej. "https://api.auryx.com")
// Si cambia el dominio, actualizá también el Content-Security-Policy de index.html (connect-src).
const API_BASE_URL = "https://compragamer-api.onrender.com";

// Cotización USD→ARS. No tiene valor por defecto a propósito: al iniciar, el sitio se la pide
// a la API (GET /exchange-rate, la misma que usa el backend para cobrar) y recién ahí muestra
// precios. Así lo que ve el cliente coincide con lo que se le cobra (ver loadCatalog en lib/api.js).
let USD_ARS_RATE = null;

// WhatsApp de contacto (formato internacional, solo dígitos: 54 9 + código de área + número).
// Canal alternativo para cotizaciones y consultas (los pedidos y el formulario van a la API).
// Si lo cambiás, cambiá también el link fijo del botón flotante y del <noscript> en index.html.
const WHATSAPP_NUMBER = "5491166858516";
const WHATSAPP_DISPLAY = "+54 9 11 6685-8516";

// Email de contacto que se publica en el sitio (Términos, Privacidad, pie). Lo pide la ley de
// datos personales para ejercer los derechos de acceso y rectificación: cargalo antes de lanzar.
// También es el respaldo del formulario de contacto si la API no responde (vacío = WhatsApp).
const CONTACT_EMAIL = "contacto@auryx.com.ar";

// Client ID de Google (OAuth "Aplicación web") para "Continuar con Google". Es público: no es
// un secreto. Vacío = el ingreso de clientes queda deshabilitado y #ingresar lo avisa.
const GOOGLE_CLIENT_ID = "22309348641-70prap97ugr2a30af2fjrtphruia4q4g.apps.googleusercontent.com";

// Redes de AURYX: íconos en el pie y "sameAs" de los datos para buscadores (le dicen a Google que
// esos perfiles son de esta empresa). Vacío = no se muestra. Si cambian, cambiá también "sameAs"
// en index.html (las demás páginas lo toman de acá al regenerarse).
const INSTAGRAM_URL = "https://www.instagram.com/auryx.oficial/";
/* Instalación y asesoría: porcentaje del precio de los equipos del sistema. El mismo valor que
   src/orders/installation.ts de la API, que es la que calcula lo que se cobra. */
const INSTALLATION_RATE = 0.25;
const LINKEDIN_URL = "https://www.linkedin.com/in/auryx-fv";

// Datos del vendedor (Ley 24.240, comercio electrónico). Se muestran en el pie y en Términos.
// Vacío = no se muestra esa línea (nunca se publican datos de relleno).
const SELLER_NAME = "";        // nombre y apellido o razón social, ej. "Juan Pérez" o "AURYX S.A.S."
const SELLER_CUIT = "";        // con guiones, ej. "20-12345678-9"
const SELLER_ADDRESS = "";     // domicilio legal, ej. "Av. Siempreviva 742, CABA"

// Data Fiscal de ARCA (Formulario 960/D): lo da ARCA al dar de alta el sitio web.
// Vacío = no se muestra el QR en el pie.
const DATA_FISCAL_URL = "";    // el link que da ARCA (empieza con https://servicioscf.afip.gob.ar/…)
const DATA_FISCAL_IMG = "";    // la URL de la imagen del QR que da ARCA

// Analítica (ver src/lib/analytics.js). Vacío = deshabilitada: no se carga ningún script de
// terceros, no hay llamadas de red y el banner de cookies no aparece.
// Solo se activan si el visitante acepta las cookies en el banner.
const GA4_ID = "G-HQRPL3Q8GY"; // Google Analytics 4: "G-XXXXXXXXXX" (Administrar > Flujos de datos)
const CLARITY_ID = "";         // Microsoft Clarity: el ID del proyecto (Settings > Overview), ej. "abc123xyz"
