# Segunda pasada visual
Composición editorial sobre la landing existente. Paleta original: azul --hub-blue / --hub-deep, amarillo --yellow. Tipografías existentes; monoespaciada del sistema para anotaciones.

Se mantienen secciones, copy comercial, precios, configuración, IDs de compra, consentimiento, GTM, legales, FAQ y SEO. Las nuevas palabras son únicamente anotaciones de proceso y fuentes, y numeración editorial.
Los estilos están limitados a .revender-page; no afectan a otras páginas.
No se añaden dependencias, vídeos autoplay, fuentes externas ni librerías de animación.
Contenido siempre visible; IntersectionObserver y CSS aportan solo una entrada suave cuando no se solicita movimiento reducido.

Faltan capturas auténticas. COURSE_PREVIEWS mantiene sus valores vacíos:
assets/como-encontrar-coches/capturas/hero.webp
assets/como-encontrar-coches/capturas/area-alumno.webp
assets/como-encontrar-coches/capturas/busqueda-real.webp
assets/como-encontrar-coches/capturas/caso-practico.webp
Al configurar las rutas, el hero usa composición con ligera rotación y anotaciones; las lecciones ocupan espacios distintos. En móvil las imágenes se muestran sin superposiciones.
El proceso del hero mientras faltan imágenes es un gráfico tipográfico, sin interfaces ni anuncios simulados.

QA: npm run check y scripts/qa-revender-landing.mjs sobre dist a 320, 360, 390, 430, 768, 1024 y 1440.
Las capturas incluyen hero, proceso, mercado, casos, cierre y página completa.
