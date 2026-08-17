export const ACADEMY_VERSION = "1.1.0";

export const ACADEMY_PATCH_NOTES = Object.freeze([
  Object.freeze({
    version: "1.1.0",
    date: "16 agosto 2026",
    title: "Fichas de vehículos desde mobile.de",
    summary: "Nueva base normalizada para importar, revisar y guardar vehículos sin inventar datos ausentes.",
    sections: Object.freeze([
      Object.freeze({
        label: "NUEVO",
        items: Object.freeze([
          "El Analizador crea fichas editables desde URLs compatibles de mobile.de o mediante entrada manual.",
          "Mis vehículos conserva fichas en el dispositivo y permite abrir, actualizar, duplicar, eliminar y enviar el precio a la calculadora.",
        ]),
      }),
      Object.freeze({
        label: "SEGURIDAD",
        items: Object.freeze([
          "La importación server-side limita protocolos, hosts, redirecciones, tiempo y tamaño de respuesta.",
          "Los datos ausentes permanecen como no indicados y el contenido remoto se presenta siempre como texto seguro.",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    version: "1.0.1",
    date: "14 agosto 2026",
    title: "Navegación y herramientas más fiables",
    summary: "Correcciones de rutas públicas, formularios, estados de error y experiencia responsive.",
    sections: Object.freeze([
      Object.freeze({
        label: "CORREGIDO",
        items: Object.freeze([
          "Las herramientas utilizan sus URLs públicas canónicas y conservan compatibilidad con los enlaces anteriores.",
          "Los campos numéricos respetan cero, decimales y límites sin alterar los cálculos.",
          "Los errores y rutas inexistentes ofrecen caminos claros para continuar.",
        ]),
      }),
      Object.freeze({
        label: "MEJORADO",
        items: Object.freeze([
          "Servicios PRO muestra con más claridad la progresión de menor a mayor intervención.",
          "Se han afinado objetivos táctiles, navegación móvil y consistencia visual.",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    version: "1.0.0",
    date: "13 agosto 2026",
    title: "IvanImports Academy abierta",
    sections: Object.freeze([
      Object.freeze({
        label: "NUEVO",
        items: Object.freeze([
          "Acceso público y gratuito, sin registro ni pago.",
          "Ruta completa con 12 etapas y un prólogo de preparación.",
          "72 lecciones, 317 conceptos, 17 herramientas y centro de respuestas.",
          "Guía completa, cuaderno de trabajo y guía de placas verdes integrados.",
        ]),
      }),
      Object.freeze({
        label: "MEJORADO",
        items: Object.freeze([
          "El progreso y la operación se guardan automáticamente en este dispositivo.",
          "Navegación móvil, mapa visual y fuentes oficiales reunidos en una sola Academia.",
        ]),
      }),
    ]),
  }),
]);
