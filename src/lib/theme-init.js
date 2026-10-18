/* AURYX: tema claro/oscuro resuelto ANTES de pintar (se carga en el <head>, sin defer) para
   evitar el parpadeo. Prioridad: elección guardada > preferencia del sistema > oscuro (marca).
   Está en un archivo y no en línea para que la Content-Security-Policy no tenga que permitir
   scripts en línea. */
(function () {
  var theme = null;
  try { theme = localStorage.getItem("auryx-theme"); } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.add("js");
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f3f5f9" : "#05080f");
})();

/* Inicio: la foto del hero es lo más grande de la página, pero la vista recién se dibuja cuando
   llega el catálogo. Se pide ya, con el mismo srcset/sizes que usa views/home.js (si cambian
   allá, cambiarlos acá; si no coinciden, el celular baja dos imágenes). Solo en la home. */
(function () {
  if (location.hash && location.hash !== "#" && location.hash !== "#home") return;
  var url = function (w) { return "https://images.unsplash.com/photo-1592833159155-c62df1b65634?w=" + w + "&q=75&auto=format&fit=crop"; };
  var link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.setAttribute("imagesrcset", [480, 800, 1200].map(function (w) { return url(w) + " " + w + "w"; }).join(", "));
  link.setAttribute("imagesizes", "(min-width: 900px) 45vw, 100vw");
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);
})();
