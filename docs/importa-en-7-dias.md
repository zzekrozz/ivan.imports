# Landing `Importa tu coche en 7 días`

## Configuración del modo de venta

La landing está aislada en `/importa-en-7-dias/` y utiliza una configuración única en `assets/importa-7-dias/config.js`.

La landing puede desplegarse con `checkoutUrl` vacío. En ese estado, los CTA no salen de IvanImports, no realizan ningún cargo y muestran un mensaje público indicando que la compra online todavía no está disponible.

Antes de abrir la venta online, es obligatorio:

1. Añadir la URL HTTPS definitiva del checkout en `checkoutUrl`.
2. Configurar en el proveedor de pago la vuelta a `https://ivanimports.es/importa-en-7-dias/gracias/`.
3. Completar en `assets/site-config.js` los enlaces legales reales (aviso, privacidad, cookies y condiciones de compra). Los enlaces vacíos se ocultan; nunca se crean textos legales ficticios.
4. Verificar que el proveedor de pago envía por email la guía y el cuaderno. Los PDFs originales no forman parte de este repositorio ni deben publicarse.

La URL de vídeo es opcional. Si `videoUrl` está vacía, el bloque completo permanece oculto y no carga ningún reproductor.

## Contador y bonus

El lanzamiento termina en `2026-08-16T23:59:59+02:00`. El estado se calcula con la fecha real del dispositivo, sin `localStorage`. Al expirar se ocultan el contador, el bloque de acompañamiento y todas sus menciones; el producto continúa a 179 €.

## Analítica

Se reutilizan `dataLayer` y `gtag` existentes. La landing envía eventos de vista, profundidad, CTA, inicio de checkout, previews, FAQ, vídeo y expiración del contador. Los parámetros UTM y `ref` se transfieren al checkout.
