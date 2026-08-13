# Refinado visual final · IvanImports

Fecha: 13 de agosto de 2026
Alcance: frontend público y presentación de IvanImports Academy.

## Dirección aplicada

- Lenguaje de producto premium, editorial y automovilístico.
- Jerarquía más contenida en titulares y mayor aire entre niveles.
- Azul noche, blanco frío, azul eléctrico, turquesa controlado y ámbar solo para PRO.
- Imagen raster original como capa artística; SVG/HTML reservado a rutas, nodos, estados, iconos y datos.
- Separación explícita entre `Academia gratis` y servicios aplicados `PRO`.

## Activos originales

Los seis activos se generaron con la herramienta de imágenes integrada y se optimizaron localmente a WebP. No usan fotografías, logos ni URLs de terceros.

| Archivo | Uso | Tamaño |
| --- | --- | ---: |
| `assets/visuals/control-center-hero-v1.webp` | Hero / Control Center | 100.832 B |
| `assets/visuals/europe-route-desktop-v1.webp` | Mapa desktop | 266.442 B |
| `assets/visuals/europe-route-mobile-v1.webp` | Mapa móvil | 153.460 B |
| `assets/visuals/stage-before-search-v1.webp` | Etapa Antes de buscar / servicios | 53.538 B |
| `assets/visuals/opportunity-inspection-v1.webp` | Oportunidades / caso educativo | 92.752 B |
| `assets/visuals/directos-studio-v1.webp` | Directos | 62.586 B |

Peso total servido: 729.610 B.

## Resumen de prompts

1. Control Center claro con vehículos sin marca, ruta europea, tarjetas de análisis y amplia zona segura.
2. Cartografía topográfica limpia de Europa occidental, sin texto, rutas ni nodos, en formatos horizontal y vertical.
3. Mesa de preparación de una importación con llave, mapa, calculadora, documentación y contexto de carretera.
4. Vehículo familiar AWD sin marca en inspección europea, tono analítico y espacio editorial para texto.
5. Estudio sobrio de directos con analista, micrófono, monitores abstractos, mapa y vehículo sin logos.

Todos los prompts pidieron expresamente: sin texto legible, sin marcas, sin watermark, sin rojo dominante, sin collage, sin clipart, sin 3D cartoon y con margen para recorte responsive.

## Sistema de fallback

- Los visuales decorativos tienen dimensiones intrínsecas para evitar saltos de layout.
- El mapa conserva geografía vectorial tenue, ruta, coche, 12 nodos y alternativa textual aunque falle el fondo raster.
- Las etapas sin una imagen editorial dedicada usan un fondo de marca sobrio con numeración, no una ilustración genérica.
- Desktop y móvil cargan su cartografía específica mediante `picture`.

## Zonas no modificadas

No se modificaron Stripe, Redis, Blob, Resend, Production, seguridad, acceso privado, sesiones, entitlements, pagos, precios, catálogo ni inventario 13/72/317/17.
