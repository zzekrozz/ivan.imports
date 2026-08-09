(() => {
  const config = window.IMPORTA_7_DIAS_CONFIG || {};
  const deadline = new Date(config.launchEndsAt || "2026-08-16T23:59:59+02:00");
  const launchActive = Boolean(config.launchBonus)
    && Number.isFinite(deadline.getTime())
    && Date.now() <= deadline.getTime();

  document.querySelectorAll("[data-thank-you-launch]").forEach((section) => {
    section.hidden = !launchActive;
  });

  document.querySelectorAll("[data-support-days]").forEach((element) => {
    element.textContent = String(config.supportDays || 14);
  });

  document.querySelectorAll("[data-commercial-whatsapp]").forEach((contact) => {
    if (!config.commercialWhatsApp) {
      contact.href = config.legal?.contact || "/#contacto";
      return;
    }

    const message = "Hola Iván, he comprado Importa tu coche en 7 días y todavía no encuentro el email de acceso.";
    contact.href = `https://wa.me/${config.commercialWhatsApp}?text=${encodeURIComponent(message)}`;
    contact.target = "_blank";
    contact.rel = "noopener noreferrer";
  });

  const revealElements = document.querySelectorAll("[data-reveal]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px" });

    revealElements.forEach((element) => observer.observe(element));
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "importa7_purchase_thankyou_view",
    launch_active: launchActive,
  });
})();
