# Cómo encontrar coches para revender

## Integración
Landing estática en `/como-encontrar-coches-para-revender/`. Reutiliza `site.css`, `hub.css`, botones y componentes `site-header/site-footer`. Inter/Manrope con los fallbacks existentes, azul/turquesa y superficies claras del hub. No se instala un framework nuevo.

El generador `scripts/render-revender-landing.mjs` contiene componentes de sección, CTA, tarjetas, listas de beneficios, previews y FAQ. Se ejecuta desde `scripts/build-public-pages.mjs`; el build incluye la nueva carpeta en dist y registra la URL en el sitemap. El HTML está versionado para servidores estáticos y SEO sin depender de JavaScript.

## Checkout y precios
Editar únicamente `assets/como-encontrar-coches/config.js`:
- `CHECKOUT_URL`: sustituir `"#"` por la URL final de Systeme.io.
- `CURRENT_PRICE`, `FUTURE_PRICE`, `PRICE_CHANGE_DATE`, `PROMOTION_MONTH`, `UPDATE_MONTHS`.
- Ejecutar `npm run generate` y versionar el HTML generado antes de publicar.
- La fecha no cambia automáticamente el precio. Los cuatro CTA usan la misma configuración.
- El checkout pendiente `"#"` aún no permite comprar. La entrega y el acceso inmediato se configuran en Systeme.io.

## Material real pendiente
No hay capturas ni vídeos de esta formación en el repositorio. Los assets del producto antiguo proceden de PDFs y no se presentan como capturas de este curso.
Proporcionar:
1. Captura de una búsqueda real para el hero.
2. Miniatura/captura de una lección de búsqueda desde cero.
3. Miniatura/captura de análisis y casos prácticos.
4. Captura del área del alumno con varias lecciones.
5. Portada social real (recomendado 1200 × 630).
Asignar las rutas en `COURSE_PREVIEWS` y `OG_IMAGE`, luego ejecutar `npm run generate`. Mientras falten, aparecen placeholders etiquetados; Open Graph usa la imagen de marca ya existente.

## Tracking y móvil
Se conserva GTM-PRKZJFTT y el mecanismo `data-event` de site.js.
Evento: `revender_checkout_clicked`; `section` identifica `hero_cta`, `mid_cta`, `pricing_cta` y `sticky_mobile_cta`. Todos también tienen id y data-cta. No se envían datos personales.

El atributo `data-mobile-cta` evita la navegación fija inferior únicamente en esta página. El CTA móvil reserva espacio inferior más safe-area; se oculta cuando el CTA de precio está visible. Header y footer siguen siendo los compartidos. FAQ nativo con teclado y sin dependencia de JavaScript.

## Verificación
`npm run check` ejecuta lint, typecheck, tests y build.
El workflow de la rama ejecuta además Chromium a 320, 360, 390, 430, 768, 1024 y 1440 px: ruta, header/footer, ausencia de desbordamientos, FAQ, menú móvil, tracking, CTA y páginas existentes.
Las capturas completas y el informe se guardan como artifact `revender-responsive-qa`.
