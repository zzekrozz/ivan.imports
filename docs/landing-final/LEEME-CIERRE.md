# Landing "Cómo encontrar coches para revender": entrega final

Archivo: `como-encontrar-coches-para-revender.html` + carpeta `assets/`.

## Ya configurado
- Checkout: `https://pogrebnyakivan123.systeme.io/curso-encontrar` (constante `CHECKOUT_URL` y href de `#cta-hero`, `#cta-precio`, `#cta-final`). Si cambia, actualizar ambos.
- Vídeo YouTube `lcBzFPKjWyQ` con `youtube-nocookie.com`; el iframe se crea solo al pulsar Play. Toda la miniatura es clicable.
- `assets/video-thumb.webp` (1280x720) y `assets/og-landing-revender.jpg` (1200x630): salen de la misma imagen aprobada.
- Favicons en `assets/favicon/` (ico, 32, 192, 512, apple-touch-icon), enlazados en el `<head>`. Opcional: copiar `favicon.ico` también a la raíz del sitio.
- Canonical, OG y Twitter apuntan a `https://ivanimports.es/como-encontrar-coches-para-revender` y a `https://ivanimports.es/assets/og-landing-revender.jpg` (esa ruta pública debe existir en producción).
- Sin dark mode automático (`color-scheme: light`).
- Tracking: comentario en el `<head>` indica dónde integrar GTM y el consentimiento de cookies del sitio.

## Hay que comprobar en el sitio real
1. Que existan `/aviso-legal`, `/privacidad`, `/cookies` y `/condiciones-de-compra`.
2. Que los assets se sirvan en las rutas `/assets/...` (o ajustar las rutas del HTML y de las metas).
3. Que el vídeo se reproduce al pulsar Play.
4. La foto del hero y de las tarjetas es un GTI y el texto dice "Volkswagen Golf".

Nota: el enlace de acceso al curso (`/school/course/encuentra`) NO se usa en ningún CTA de venta; es solo para después de comprar.
