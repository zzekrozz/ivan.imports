import { ACADEMY_PROGRAM_ID } from "./security.js";

function escapeAttribute(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function academyShell({ route = "/academia/importa-tu-primer-coche/" } = {}) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#071827">
  <title>Importa tu primer coche | Academia IvanImports</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/academy/app.css?v=1.1.0-vehicle3">
</head>
<body class="academy-app-page" data-academy-program="${ACADEMY_PROGRAM_ID}" data-academy-route="${escapeAttribute(route)}">
  <a class="skip-link" href="#academy-app">Saltar al programa</a>
  <div id="academy-app" data-academy-app aria-busy="true">
    <p role="status">Preparando tu programa…</p>
  </div>
  <noscript>Necesitas activar JavaScript para utilizar la experiencia interactiva. Los recursos privados siguen disponibles desde tu cuenta.</noscript>
  <script type="module" src="/assets/academy/app.js?v=1.1.0-vehicle3"></script>
</body>
</html>`;
}
