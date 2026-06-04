const WHATSAPP_PHONE = "34674252436";
const TIKTOK_URL = "https://www.tiktok.com/@ivan.imports";
const MATRICULAPRO_URL = "https://matriculapro.ivanimports.es";

function createWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

function toggleFaq(el) {
  const answer = el.nextElementSibling;
  const isOpen = el.classList.contains("open");

  document.querySelectorAll(".faq-q").forEach((question) => {
    question.classList.remove("open");
    if (question.nextElementSibling) {
      question.nextElementSibling.classList.remove("open");
    }
  });

  if (!isOpen) {
    el.classList.add("open");
    if (answer) {
      answer.classList.add("open");
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-track]") : null;
  if (!target) return;

  trackEvent(target.dataset.track, {
    label: target.textContent.trim().slice(0, 120),
    href: target.getAttribute("href") || "",
  });
});

document.querySelectorAll(".js-whatsapp-link").forEach((link) => {
  const message = link.dataset.waMessage || "Hola Iván, vengo de la web y quiero consultarte un caso sobre un coche.";
  link.href = createWhatsAppUrl(message);
  link.target = "_blank";
  link.rel = "noreferrer";
});

document.querySelectorAll(".js-tiktok-link").forEach((link) => {
  link.href = TIKTOK_URL;
  link.target = "_blank";
  link.rel = "noreferrer";
});

document.querySelectorAll(".js-matriculapro-link").forEach((link) => {
  link.href = MATRICULAPRO_URL;
  link.target = "_blank";
  link.rel = "noreferrer";
});

const navToggle = document.querySelector(".js-nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  const syncNavToggle = () => {
    const isOpen = navLinks.classList.contains("open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    navToggle.textContent = isOpen ? "Cerrar" : "Menú";
  };

  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    syncNavToggle();
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      syncNavToggle();
    });
  });

  syncNavToggle();
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add("visible"), index * 60);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".fade-up").forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll(".fade-up").forEach((el) => el.classList.add("visible"));
}
