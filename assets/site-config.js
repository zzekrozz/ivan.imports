window.IVAN_IMPORTS_CONFIG = Object.freeze({
  brand: {
    name: "IvanImports",
    legalName: "",
    taxId: "",
    address: "",
  },
  siteUrl: "https://ivanimports.es",
  promoGo: {
    active: true,
    label: "50% · 10 PLAZAS",
    code: "AGOSTO50",
  },
  contact: {
    whatsappPhone: "34674252436",
    email: "",
  },
  social: {
    tiktok: "https://www.tiktok.com/@ivan.imports",
    youtube: "https://www.youtube.com/@IvanPogg",
    instagram: "",
  },
  products: {
    subastasPro: "https://subastaspro.ivanimports.es",
    matriculaPro: "https://matriculapro.ivanimports.es",
    importCourse: "/importa-en-7-dias/",
  },
  legal: {
    notice: "",
    privacy: "",
    cookies: "",
    purchaseTerms: "",
  },
  prices: {
    copart: {
      amount: 397,
      baseAmount: 328.10,
      vatRate: 21,
      vatAmount: 68.90,
      label: "397 € IVA incluido",
    },
    consultationExpress: {
      amount: 30,
      minutes: 15,
      label: "30 €",
    },
    consultationFull: {
      amount: 70,
      minutes: 45,
      label: "70 €",
    },
  },
  dossier: {
    url: "/docs/guia-compra-guiada-copart.pdf",
    available: false,
  },
  linkHub: [
    { title: "Compra guiada Copart Alemania", label: "Para compraventas", marker: "C", href: "/copart/", track: "click_copart_service", featured: true },
    { title: "Aprender subastas con SubastasPro", label: "Copart, Auto1 y plataformas profesionales", marker: "S", linkKey: "subastasPro", track: "click_subastaspro" },
    { title: "Importa tu coche en 7 días", label: "Formación práctica paso a paso", marker: "7", linkKey: "importCourse", track: "click_import_course", fallbackWaMessage: "Hola Iván, quiero información sobre la formación Importa tu coche en 7 días." },
    { title: "MatriculaPRO", label: "Herramientas para matricular en España", marker: "M", linkKey: "matriculaPro", track: "click_matriculapro" },
    { title: "Reservar una consultoría", label: "Revisa tu caso conmigo", marker: "?", href: "/consultoria/", track: "click_consultoria" },
    { title: "Hablar por WhatsApp", label: "Cuéntame en qué punto estás", marker: "W", whatsappMessage: "Hola Iván, vengo de la página Empieza y quiero consultarte mi caso.", track: "click_whatsapp" },
  ],
});
