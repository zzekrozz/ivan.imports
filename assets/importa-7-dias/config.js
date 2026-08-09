(() => {
  const site = window.IVAN_IMPORTS_CONFIG || {};

  window.IMPORTA_7_DIAS_CONFIG = Object.freeze({
    productName: "Importa tu coche en 7 días",
    edition: "2026",
    price: 179,
    currency: "EUR",
    priceLabel: "179 €",
    vatIncluded: true,
    launchEndsAt: "2026-08-16T23:59:59+02:00",
    launchBonus: true,
    supportDays: 14,

    // Obligatorio antes de publicar. Debe ser una URL HTTPS del checkout definitivo.
    checkoutUrl: "",

    // Opcional. La sección de vídeo no se renderiza mientras esta URL esté vacía.
    videoUrl: "",
    videoPoster: "",

    thankYouUrl: "/importa-en-7-dias/gracias/",
    commercialWhatsApp: site.contact?.whatsappPhone || "34674252436",
    social: Object.freeze({
      tiktok: site.social?.tiktok || "https://www.tiktok.com/@ivan.imports",
      youtube: site.social?.youtube || "",
      instagram: site.social?.instagram || "",
    }),
    legal: Object.freeze({
      notice: site.legal?.notice || "",
      privacy: site.legal?.privacy || "",
      cookies: site.legal?.cookies || "",
      purchaseTerms: site.legal?.purchaseTerms || "",
      contact: "/#contacto",
    }),
  });
})();
