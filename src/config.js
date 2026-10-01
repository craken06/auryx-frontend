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
const API_BASE_URL = "https://6757-186-18-242-43.ngrok-free.app";

// Tasa de cambio de referencia, SOLO para mostrar el precio en la moneda
// que un producto no tiene cargada en la base (ej. se cargó en ARS y el
// usuario quiere ver USD). Ajustar según cotización real, o reemplazar
// más adelante por una consulta a una API de cotización en vivo.
const USD_ARS_RATE = 1350;
