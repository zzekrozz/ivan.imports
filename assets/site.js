const WHATSAPP_PHONE = "34674252436";
const TIKTOK_URL = "https://www.tiktok.com/@ivan.imports";
const MATRICULAPRO_URL = "https://matriculapro.ivanimports.es";
const GA_EVENT_ALIASES = {
  "whatsapp-service-europa-360": "click_pack_europa_360",
  "whatsapp-service-purchase-prep": "click_revision_completa",
  "details-purchase-prep": "click_revision_completa",
  "whatsapp-service-matriculation": "click_matriculacion",
  "details-matriculation": "click_matriculacion",
  "whatsapp-service-cost-real": "click_calculo_coste",
  "details-cost-real": "click_calculo_coste",
};

function createWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });

  const gaEventNames = new Set();
  if (eventName.startsWith("whatsapp-")) {
    gaEventNames.add("click_whatsapp");
  }
  if (GA_EVENT_ALIASES[eventName]) {
    gaEventNames.add(GA_EVENT_ALIASES[eventName]);
  }

  if (typeof window.gtag === "function") {
    const eventsToSend = gaEventNames.size ? gaEventNames : new Set([eventName]);
    eventsToSend.forEach((gaEventName) => {
      window.gtag("event", gaEventName, params);
    });
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

function initSliderDots() {
  const sliders = document.querySelectorAll(".js-slider");

  sliders.forEach((slider) => {
    const dots = slider.parentElement?.querySelector(".js-slider-dots");
    const slides = Array.from(slider.children).filter((child) => child instanceof HTMLElement);
    let touchStartX = null;
    let touchStartIndex = 0;

    if (!dots || slides.length < 2) {
      if (dots) dots.innerHTML = "";
      return;
    }

    dots.innerHTML = "";

    const clampIndex = (value) => Math.max(0, Math.min(slides.length - 1, value));

    const getActiveIndex = () => {
      const sliderRect = slider.getBoundingClientRect();
      const sliderCenter = sliderRect.left + sliderRect.width / 2;
      let activeIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      slides.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const slideCenter = rect.left + rect.width / 2;
        const distance = Math.abs(sliderCenter - slideCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          activeIndex = index;
        }
      });

      return activeIndex;
    };

    const scrollToSlide = (index) => {
      const target = slides[clampIndex(index)];
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    };

    const dotButtons = slides.map((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", `Ir al bloque ${index + 1}`);
      dot.addEventListener("click", () => scrollToSlide(index));
      dots.appendChild(dot);
      return dot;
    });

    const updateActiveDot = () => {
      const activeIndex = getActiveIndex();

      dotButtons.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === activeIndex);
        dot.setAttribute("aria-current", index === activeIndex ? "true" : "false");
      });
    };

    let ticking = false;
    slider.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        updateActiveDot();
        ticking = false;
      });
    }, { passive: true });

    slider.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
      touchStartIndex = getActiveIndex();
    }, { passive: true });

    slider.addEventListener("touchend", (event) => {
      if (touchStartX === null) return;

      const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
      const deltaX = touchEndX - touchStartX;
      const targetIndex = Math.abs(deltaX) > 36
        ? clampIndex(touchStartIndex + (deltaX < 0 ? 1 : -1))
        : getActiveIndex();

      window.setTimeout(() => scrollToSlide(targetIndex), 40);
      touchStartX = null;
    }, { passive: true });

    window.addEventListener("resize", updateActiveDot);
    updateActiveDot();
  });
}

initSliderDots();

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

