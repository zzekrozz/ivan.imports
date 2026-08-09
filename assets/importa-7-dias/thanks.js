(() => {
  const config = window.IMPORTA_7_DIAS_CONFIG || {};
  const deadline = new Date(config.launchEndsAt || "2026-08-16T23:59:59+02:00");
  const launchActive = Boolean(config.launchBonus) && Number.isFinite(deadline.getTime()) && Date.now() <= deadline.getTime();
  const launchMessage = document.querySelector("[data-thank-you-launch]");
  if (launchMessage) launchMessage.hidden = !launchActive;

  const contact = document.querySelector("[data-commercial-whatsapp]");
  if (contact && config.commercialWhatsApp) {
    const message = "Hola Iván, he comprado Importa tu coche en 7 días y todavía no encuentro el email de acceso.";
    contact.href = `https://wa.me/${config.commercialWhatsApp}?text=${encodeURIComponent(message)}`;
    contact.target = "_blank";
    contact.rel = "noopener noreferrer";
  } else if (contact) {
    contact.hidden = true;
  }

  window.dataLayer = window.dataLayer || [];
  const eventData = { event: "importa7_thank_you_view", launch_active: launchActive };
  window.dataLayer.push(eventData);
  if (typeof window.gtag === "function") window.gtag("event", "importa7_thank_you_view", eventData);
})();
