const CONFIG = window.IVAN_IMPORTS_CONFIG || {
  brand: { name: "IvanImports" },
  contact: { whatsappPhone: "34674252436", email: "" },
  social: { tiktok: "", youtube: "", instagram: "" },
  products: { subastasPro: "", matriculaPro: "", importCourse: "" },
  legal: { notice: "", privacy: "" },
  prices: {
    copart: { label: "397 € IVA incluido" },
    consultation30: { amount: 60, label: "60 € IVA incluido", minutes: 30, vatIncluded: true, bookingUrl: "" },
    consultation60: { amount: 90, label: "90 € IVA incluido", minutes: 60, vatIncluded: true, bookingUrl: "" },
  },
  dossier: { url: "/docs/guia-compra-guiada-copart.pdf", available: false },
};

const CONFIG_LINKS = {
  subastasPro: CONFIG.products.subastasPro,
  matriculaPro: CONFIG.products.matriculaPro,
  importCourse: CONFIG.products.importCourse,
  tiktok: CONFIG.social.tiktok,
  youtube: CONFIG.social.youtube,
  instagram: CONFIG.social.instagram,
  legalNotice: CONFIG.legal.notice,
  privacy: CONFIG.legal.privacy,
};

function createWhatsAppUrl(message) {
  return `https://wa.me/${CONFIG.contact.whatsappPhone}?text=${encodeURIComponent(message)}`;
}

function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

function externalLinkAttributes(link) {
  if (!link.href || link.href.startsWith(window.location.origin)) return;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

function getHeaderMarkup() {
  return `
    <nav class="site-nav" aria-label="Navegación principal">
      <div class="nav-inner">
        <a class="logo" href="/" aria-label="IvanImports, inicio">
          <img class="brand-wordmark" src="/assets/brand/ivan-imports-wordmark-dark.svg" alt="IvanImports" width="430" height="88">
        </a>
        <button class="nav-toggle js-nav-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="main-navigation">
          <span class="menu-icon" aria-hidden="true"></span>
        </button>
        <div class="nav-panel" id="main-navigation">
          <ul class="nav-links">
            <li><a href="/">Inicio</a></li>
            <li><a href="/copart/">Compra guiada Copart</a></li>
            <li><a href="/academia/" data-track="click_academia">Academia gratuita</a></li>
            <li><a href="/consultoria/">Consultoría</a></li>
          </ul>
          <a href="#" class="btn btn-primary btn-nav js-whatsapp-link" data-track="click_whatsapp" data-wa-message="Hola Iván, vengo de la web y quiero saber qué servicio encaja con mi caso.">Hablar con Iván</a>
        </div>
      </div>
    </nav>`;
}

function optionalFooterLink(url, label, trackName = "") {
  if (!url) return "";
  const track = trackName ? ` data-track="${trackName}"` : "";
  return `<a href="${url}"${track}>${label}</a>`;
}

function getFooterMarkup() {
  const socialLinks = [
    optionalFooterLink(CONFIG.social.tiktok, "TikTok", "click_tiktok"),
    optionalFooterLink(CONFIG.social.youtube, "YouTube", "click_youtube"),
    optionalFooterLink(CONFIG.social.instagram, "Instagram", "click_instagram"),
  ].filter(Boolean).join("");

  const legalLinks = [
    optionalFooterLink(CONFIG.legal.notice, "Aviso legal"),
    optionalFooterLink(CONFIG.legal.privacy, "Privacidad"),
  ].filter(Boolean).join("");

  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <a class="logo" href="/">
            <img class="brand-wordmark" src="/assets/brand/ivan-imports-wordmark-dark.svg" alt="IvanImports" width="430" height="88">
          </a>
          <p>Compra, subastas, importación y matriculación de vehículos en Europa con experiencia práctica.</p>
        </div>
        <div class="footer-links" aria-label="Servicios">
          <strong>Servicios</strong>
          <a href="/copart/">Compra guiada Copart</a>
          <a href="/academia/" data-track="click_academia">Academia gratuita</a>
          <a href="#" data-config-link="subastasPro" data-track="click_subastaspro">SubastasPro</a>
          <a href="/consultoria/">Consultoría</a>
        </div>
        <div class="footer-links" aria-label="Contacto y redes">
          <strong>Contacto</strong>
          <a href="#" class="js-whatsapp-link" data-track="click_whatsapp" data-wa-message="Hola Iván, vengo de la web y quiero consultarte mi caso.">WhatsApp</a>
          ${socialLinks}
          ${legalLinks}
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-current-year></span> IvanImports</span>
        <span>Los servicios pueden ser online, formativos o incluir coordinación y retirada del vehículo, según el servicio contratado.</span>
      </div>
    </footer>`;
}

function renderSiteChrome() {
  document.querySelectorAll("site-header").forEach((element) => {
    element.outerHTML = getHeaderMarkup();
  });

  document.querySelectorAll("site-footer").forEach((element) => {
    element.outerHTML = getFooterMarkup();
  });

  document.querySelectorAll("body > nav:not(.site-nav)").forEach((legacyNav) => {
    legacyNav.outerHTML = getHeaderMarkup();
  });

  document.querySelectorAll("body > footer:not(.site-footer)").forEach((legacyFooter) => {
    legacyFooter.outerHTML = getFooterMarkup();
  });
}

function hydrateConfigLinks() {
  document.querySelectorAll("[data-config-link]").forEach((link) => {
    const url = CONFIG_LINKS[link.dataset.configLink] || "";
    if (url) {
      link.href = url;
      externalLinkAttributes(link);
      return;
    }

    const fallbackMessage = link.dataset.fallbackWaMessage;
    if (fallbackMessage) {
      link.href = createWhatsAppUrl(fallbackMessage);
      externalLinkAttributes(link);
      link.dataset.track = link.dataset.track || "click_whatsapp";
      return;
    }

    link.hidden = true;
  });

  document.querySelectorAll(".js-whatsapp-link").forEach((link) => {
    const message = link.dataset.waMessage || "Hola Iván, vengo de la web y quiero consultarte mi caso.";
    link.href = createWhatsAppUrl(message);
    externalLinkAttributes(link);
  });
}

function hydratePrices() {
  document.querySelectorAll("[data-price]").forEach((element) => {
    const price = CONFIG.prices[element.dataset.price];
    if (!price) return;

    const amount = element.querySelector("[data-price-amount]");
    const vat = element.querySelector("[data-price-vat]");
    if (amount && Number.isFinite(Number(price.amount))) amount.textContent = `${Number(price.amount)} €`;
    if (vat) vat.textContent = price.vatIncluded === true ? "IVA incluido" : "";
    if (!amount && price.label) element.textContent = price.label;
  });
}

function hydrateConsultingLinks() {
  document.querySelectorAll("[data-consulting-booking]").forEach((link) => {
    const option = CONFIG.prices[link.dataset.consultingBooking];
    if (!option?.bookingUrl) return;
    link.href = option.bookingUrl;
    externalLinkAttributes(link);
  });
}

function initNavigation() {
  const toggle = document.querySelector(".js-nav-toggle");
  const panel = document.querySelector(".nav-panel");
  if (!toggle || !panel) return;

  const closeMenu = () => {
    panel.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  };

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });

  panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function initFaq() {
  document.querySelectorAll(".faq-q").forEach((question) => {
    if (question.tagName !== "BUTTON") {
      question.setAttribute("role", "button");
      question.setAttribute("tabindex", "0");
    }

    const toggle = () => {
      const answer = question.nextElementSibling;
      const isOpen = question.classList.toggle("open");
      question.setAttribute("aria-expanded", String(isOpen));
      if (answer) {
        answer.classList.toggle("open", isOpen);
        answer.hidden = !isOpen;
      }
    };

    question.setAttribute("aria-expanded", "false");
    const answer = question.nextElementSibling;
    if (answer) answer.hidden = true;

    if (!question.hasAttribute("onclick")) {
      question.addEventListener("click", toggle);
    }
    question.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  });
}

function toggleFaq(question) {
  const answer = question.nextElementSibling;
  const isOpen = !question.classList.contains("open");
  question.classList.toggle("open", isOpen);
  question.setAttribute("aria-expanded", String(isOpen));
  if (answer) {
    answer.classList.toggle("open", isOpen);
    answer.hidden = !isOpen;
  }
}

function initDossier() {
  document.querySelectorAll(".js-dossier-link").forEach((link) => {
    link.href = CONFIG.dossier.url;
    if (CONFIG.dossier.available) {
      link.setAttribute("download", "guia-compra-guiada-copart.pdf");
      return;
    }

    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled", "true");
    link.dataset.track = "dossier_interest";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const status = document.querySelector("[data-dossier-status]");
      if (status) status.textContent = "El dossier definitivo todavía no está publicado.";
    });
  });
}

function initLinkHub() {
  const container = document.querySelector(".js-link-hub-list");
  if (!container || !Array.isArray(CONFIG.linkHub)) return;

  container.innerHTML = CONFIG.linkHub.map((item) => {
    let href = item.href || CONFIG_LINKS[item.linkKey] || "";
    if (item.whatsappMessage) href = createWhatsAppUrl(item.whatsappMessage);
    if (!href && item.fallbackWaMessage) href = createWhatsAppUrl(item.fallbackWaMessage);
    if (!href) return "";

    const featuredClass = item.featured ? " featured" : "";
    const external = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `
      <a class="link-hub-button${featuredClass}" href="${href}" data-track="${item.track || "link_hub_click"}"${external}>
        <span class="link-hub-marker" aria-hidden="true">${item.marker}</span>
        <span class="link-hub-copy"><strong>${item.title}</strong><span>${item.label}</span></span>
        <span class="link-hub-arrow" aria-hidden="true">→</span>
      </a>`;
  }).join("");
}

function initCopartForm() {
  const form = document.querySelector(".js-copart-form");
  if (!form) return;

  const status = form.querySelector(".form-status");
  const plateSelect = form.querySelector("[name='placas_rojas']");
  const plateWarning = form.querySelector(".js-plate-warning");
  const loadedAt = Date.now();

  const updatePlateWarning = () => {
    const needsWarning = plateSelect?.value === "No dispongo de placas rojas";
    if (plateWarning) plateWarning.hidden = !needsWarning;
  };

  plateSelect?.addEventListener("change", updatePlateWarning);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (status) status.textContent = "";

    if (!form.checkValidity()) {
      form.reportValidity();
      if (status) status.textContent = "Revisa los campos obligatorios antes de continuar.";
      return;
    }

    const formData = new FormData(form);
    if (formData.get("website") || Date.now() - loadedAt < 2500) {
      if (status) status.textContent = "Espera un momento y vuelve a intentarlo.";
      return;
    }

    const lines = [
      "Hola Iván, quiero solicitar la compra guiada en Copart Alemania.",
      `Precio del servicio: ${CONFIG.prices.copart.label}`,
      "",
      `Nombre: ${formData.get("nombre")}`,
      `Empresa: ${formData.get("empresa") || "No indicada"}`,
      `Teléfono: ${formData.get("telefono")}`,
      `Correo: ${formData.get("correo")}`,
      `Vehículos buscados: ${formData.get("vehiculos")}`,
      `Presupuesto: ${formData.get("presupuesto")}`,
      `Placas rojas S: ${formData.get("placas_rojas")}`,
      `Experiencia con Copart: ${formData.get("experiencia")}`,
      `Mensaje: ${formData.get("mensaje") || "Sin mensaje adicional"}`,
    ];

    trackEvent("submit_copart_form", {
      plates: formData.get("placas_rojas"),
      experience: formData.get("experiencia"),
    });

    if (status) status.textContent = "Se ha abierto WhatsApp con tu solicitud preparada. Revísala y pulsa enviar.";
    window.open(createWhatsAppUrl(lines.join("\n")), "_blank", "noopener,noreferrer");
  });
}

function initTracking() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-track]") : null;
    if (!target) return;
    trackEvent(target.dataset.track, {
      label: target.textContent.trim().slice(0, 120),
      href: target.getAttribute("href") || "",
      page: window.location.pathname,
    });
  });
}

function initReveal() {
  const revealElements = document.querySelectorAll(".fade-up");
  if (!("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  revealElements.forEach((element) => observer.observe(element));
}

renderSiteChrome();
hydrateConfigLinks();
hydratePrices();
hydrateConsultingLinks();
initNavigation();
initFaq();
initDossier();
initLinkHub();
initCopartForm();
initTracking();
initReveal();
document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

window.toggleFaq = toggleFaq;
