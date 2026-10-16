/* =========================================================================
   AURYX — Configuración de entorno
   Sin bundler (Vite/Webpack), un sitio estático no puede leer variables de
   entorno reales del sistema operativo. Este archivo cumple esa función:
   es el ÚNICO lugar que hay que tocar al mover el proyecto a otro servidor,
   cambiar el puerto del backend, o pasar a producción.

   Se carga ANTES que cualquier otro script (ver index.html), así que estas
   constantes quedan disponibles para todo el resto del frontend.
   ========================================================================= */

// URL base del backend (compragamer-api). Cambiar acá si:
// - corre en otro puerto en tu máquina
// - lo desplegás en un servidor/dominio real (ej. "https://api.auryx.com")
const API_BASE_URL = "https://compragamer-api.onrender.com";

// Tasa de cambio de referencia, SOLO para mostrar el precio en la moneda
// que un producto no tiene cargada en la base (ej. se cargó en ARS y el
// usuario quiere ver USD). Este valor es el de respaldo: al iniciar, el sitio
// le pide la cotización vigente a la API (GET /exchange-rate) y, si responde,
// la reemplaza (ver loadExchangeRate en lib/api.js).
let USD_ARS_RATE = 1500;

// WhatsApp de contacto (formato internacional, solo dígitos: 54 9 + código de área + número).
// Canal alternativo para cotizaciones y consultas (los pedidos y el formulario van a la API).
const WHATSAPP_NUMBER = "5491166858516";
const WHATSAPP_DISPLAY = "+54 9 11 6685-8516";

// Email de respaldo: si la API no responde al enviar el formulario de contacto, se abre
// el programa de correo con el mensaje armado (si queda vacío, se usa WhatsApp).
const CONTACT_EMAIL = "";
