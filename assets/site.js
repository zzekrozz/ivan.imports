const CONFIG = window.IVAN_IMPORTS_CONFIG || {};
const ROUTES = CONFIG.routes || {};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function trackEvent(eventName, params = {}) {
  if (!eventName) return;
  const safeParams = Object.fromEntries(Object.entries(params).filter(([key]) => !/name|email|phone|message|url|vin|document|budget/i.test(key)));
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...safeParams });
  if (typeof window.gtag === "function") window.gtag("event", eventName, safeParams);
}

function whatsappUrl(message) {
  return `https://wa.me/${CONFIG.contact?.whatsappPhone || "34674252436"}?text=${encodeURIComponent(message)}`;
}

function navLink(href, label) {
  const active = location.pathname === href || (href !== "/" && location.pathname.startsWith(href));
  return `<li><a href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a></li>`;
}

function headerMarkup() {
  return `<nav class="site-nav hub-nav" aria-label="Navegación principal">
    <div class="nav-inner">
      <a class="logo" href="/" aria-label="IvanImports, inicio"><img class="brand-wordmark" src="/assets/brand/ivan-imports-wordmark-dark.svg" alt="IvanImports" width="430" height="88"></a>
      <button class="nav-toggle js-nav-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="main-navigation"><span class="menu-icon" aria-hidden="true"></span></button>
      <div class="nav-panel" id="main-navigation">
        <ul class="nav-links">
          ${navLink(ROUTES.academy || "/academia/", "Academia")}
          ${navLink(ROUTES.opportunities || "/oportunidades/", "Oportunidades")}
          ${navLink(ROUTES.directos || "/directos/", "Directos")}
          ${navLink(ROUTES.tools || "/academia/herramientas/", "Herramientas")}
          ${navLink(ROUTES.services || "/servicios/", "Servicios PRO")}
          ${navLink(ROUTES.updates || "/actualizaciones/", "Actualizaciones")}
        </ul>
        <a class="btn btn-primary btn-nav" href="${ROUTES.academy || "/academia/"}" data-event="academy_started">Entrar gratis</a>
      </div>
    </div>
  </nav>`;
}

function footerMarkup() {
  const social = [
    CONFIG.social?.tiktok ? `<a href="${CONFIG.social.tiktok}" rel="noopener noreferrer" target="_blank">TikTok</a>` : "",
    CONFIG.social?.youtube ? `<a href="${CONFIG.social.youtube}" rel="noopener noreferrer" target="_blank">YouTube</a>` : ""
  ].filter(Boolean).join("");
  return `<footer class="site-footer hub-footer"><div class="footer-inner">
    <div class="footer-brand"><a class="logo" href="/"><img class="brand-wordmark" src="/assets/brand/ivan-imports-wordmark-dark.svg" alt="IvanImports" width="430" height="88"></a><p>Tu centro de control para encontrar, analizar, comprar, traer y matricular vehículos desde Europa.</p></div>
    <div class="footer-links"><strong>Explorar</strong><a href="/academia/">Academia gratuita</a><a href="/oportunidades/">Oportunidades</a><a href="/directos/">Directos</a><a href="/academia/herramientas/">Herramientas</a></div>
    <div class="footer-links"><strong>Pasar a la acción</strong><a href="/servicios/">Servicios PRO</a><a href="/servicios/consultoria/">Consultoría</a><a href="/servicios/primera-importacion-contigo/">Primera Importación Contigo</a>${social}</div>
  </div><div class="footer-bottom"><span>© <span data-current-year></span> IvanImports</span><span>Información educativa. Comprueba siempre los requisitos oficiales aplicables a tu operación.</span></div></footer>`;
}

function mobileNavMarkup() {
  return `<nav class="hub-mobile-nav" aria-label="Navegación móvil">
    <a href="/">Inicio</a><a href="/academia/">Academia</a><a href="/oportunidades/">Oportunidades</a><a href="/directos/">Directos</a><a href="/servicios/">Servicios</a>
  </nav>`;
}

function renderChrome() {
  document.querySelectorAll("site-header").forEach((node) => { node.outerHTML = headerMarkup(); });
  document.querySelectorAll("site-footer").forEach((node) => { node.outerHTML = footerMarkup(); });
  if (!document.querySelector(".hub-mobile-nav") && !document.body.dataset.academyRoute) document.body.insertAdjacentHTML("beforeend", mobileNavMarkup());
}

function initNavigation() {
  const toggle = document.querySelector(".js-nav-toggle");
  const panel = document.querySelector(".nav-panel");
  if (!toggle || !panel) return;
  const close = () => { panel.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Abrir menú"); };
  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });
  panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
}

function initFaq() {
  document.querySelectorAll(".faq-q").forEach((button) => {
    const answer = button.nextElementSibling;
    if (!answer) return;
    button.setAttribute("aria-expanded", "false");
    answer.hidden = true;
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      answer.hidden = !open;
    });
  });
}

function fieldValue(field) {
  if (field.type === "checkbox") return field.checked ? "Sí" : "No";
  return field.value.trim();
}

function buildFormMessage(form) {
  const heading = form.dataset.messageTitle || "Solicitud desde IvanImports";
  const lines = [heading, ""];
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    if (!field.name || field.name === "website" || field.name === "consentimiento" || field.type === "hidden") return;
    const value = fieldValue(field);
    if (!value) return;
    const label = form.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent?.replace(/\s*\*\s*$/, "").trim() || field.name;
    lines.push(`${label}: ${value}`);
  });
  return lines.join("\n");
}

function openReviewDialog(form, message) {
  let dialog = document.querySelector("#request-review-dialog");
  if (!dialog) {
    document.body.insertAdjacentHTML("beforeend", `<dialog class="hub-dialog" id="request-review-dialog"><form method="dialog"><button class="hub-dialog-close" value="cancel" aria-label="Cerrar">×</button><span class="hub-kicker">Revisa antes de enviar</span><h2>Tu solicitud está preparada</h2><pre data-review-message></pre><div class="hub-dialog-actions"><button class="btn btn-secondary" type="button" data-copy-message>Copiar mensaje</button><a class="btn btn-primary" data-send-message target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div><p class="hub-form-note">La web no almacena estos datos. Solo se enviarán cuando confirmes en WhatsApp.</p></form></dialog>`);
    dialog = document.querySelector("#request-review-dialog");
  }
  dialog.querySelector("[data-review-message]").textContent = message;
  const send = dialog.querySelector("[data-send-message]");
  send.href = whatsappUrl(message);
  send.onclick = () => trackEvent(form.dataset.completeEvent || "service_opened", { service: form.dataset.service || "general", action: "message_confirmed" });
  dialog.querySelector("[data-copy-message]").onclick = async (event) => {
    await navigator.clipboard.writeText(message);
    event.currentTarget.textContent = "Mensaje copiado";
  };
  dialog.showModal();
}

function initWhatsappForms() {
  document.querySelectorAll("[data-whatsapp-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = form.querySelector("[role=status]");
      if (form.elements.website?.value) return;
      if (!form.reportValidity()) { if (status) status.textContent = "Revisa los campos señalados."; return; }
      const message = buildFormMessage(form);
      if (status) status.textContent = "Solicitud preparada. Revísala antes de abrir WhatsApp.";
      trackEvent(form.dataset.startEvent || "service_opened", { service: form.dataset.service || "general", action: "form_review" });
      openReviewDialog(form, message);
    });
  });
}

function initDirectWhatsappLinks() {
  document.querySelectorAll(".js-whatsapp-link").forEach((link) => {
    link.href = whatsappUrl(link.dataset.waMessage || "Hola Iván, vengo de la web y quiero consultar qué opción encaja con mi caso.");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

function initTracking() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-event]");
    if (target) trackEvent(target.dataset.event, { section: target.dataset.section || "site", item: target.dataset.item || "" });
    const selectedPath = event.target.closest(".hub-paths a");
    if (selectedPath) trackEvent("hub_path_selected", { section: "home", item: selectedPath.closest(".hub-path--pro") ? "first-import" : "academy" });
  });
  const pageEvent = document.body.dataset.pageEvent;
  if (pageEvent) trackEvent(pageEvent, { section: document.body.dataset.pageType || "page" });
}

function initFades() {
  const items = document.querySelectorAll(".fade-up");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) { items.forEach((item) => item.classList.add("visible")); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); } }), { threshold: 0.08 });
  items.forEach((item) => observer.observe(item));
}

renderChrome();
document.querySelectorAll("[data-current-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });
initNavigation();
initFaq();
initWhatsappForms();
initDirectWhatsappLinks();
initTracking();
initFades();

window.trackIvanImportsEvent = trackEvent;
