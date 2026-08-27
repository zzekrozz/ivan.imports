function escapeAttribute(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function controlShell({ route = "/control/" } = {}) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#070b12">
  <meta name="application-name" content="Mission Control">
  <title>Mission Control</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/assets/control/manifest.webmanifest">
  <link rel="stylesheet" href="/assets/control/app.css?v=1.0.0">
</head>
<body data-control-route="${escapeAttribute(route)}">
  <a class="mc-skip-link" href="#mc-main">Saltar al panel</a>
  <div id="mission-control" data-control-app aria-busy="true">
    <main class="mc-loading" aria-label="Cargando Mission Control"><span></span><span></span><span></span></main>
  </div>
  <noscript>Necesitas activar JavaScript para utilizar Mission Control.</noscript>
  <script type="module" src="/assets/control/app.js?v=1.0.0"></script>
</body>
</html>`;
}
