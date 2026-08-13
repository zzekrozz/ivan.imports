# Licencias y procedencia visual · Academia v2

## Regla de publicación

Academia v2 no incorpora una imagen externa sin una procedencia verificable. Un recurso solo puede llegar a producción si pertenece a una de estas categorías: creación original para IvanImports, material aportado por IvanImports, derivado autorizado de los PDF del producto, o material de terceros con licencia y atribución documentadas.

El inventario privado por página vive en `private-products/academy/source-audit-2026.json`. Ese fichero no se publica ni se copia a `dist/`.

## Activos creados para v2

| Activo | Autoría / procedencia | Régimen de uso | Observaciones |
| --- | --- | --- | --- |
| `assets/academy/private/europe-map.js` | Ilustración SVG original creada para Academia IvanImports | Activo propio del proyecto | El mapa, la ruta, los hitos y el vehículo se dibujan con geometría SVG propia. No contiene teselas, capturas ni datos de Google Maps. |
| `assets/academy/private/icons.js` | Iconos SVG lineales originales creados para Academia IvanImports | Activo propio del proyecto | No carga fuentes de iconos ni sprites de terceros. |
| `assets/academy/private/lesson-visuals.js` | Diagramas SVG y HTML originales creados para Academia IvanImports | Activo propio del proyecto | Reconstruye conceptos didácticos; no recorta ni redistribuye imágenes del PDF. |
| Estilos y formas de `assets/academy-private.css` | Diseño original creado para Academia IvanImports | Activo propio del proyecto | Gradientes, rutas, tarjetas y estados se generan con CSS/SVG. |
| Preview europeo inline de `importa-en-7-dias/index.html` | Ilustración SVG original creada para la landing de IvanImports | Activo propio del proyecto | Representa ES, FR, BE, NL y DE, ruta y coche sin teselas, capturas ni datos de mapas de terceros. |
| Composiciones de `assets/importa-7-dias/landing.css` | Diseño CSS original creado para la Fase 2 | Activo propio del proyecto | Escenas, capas, tarjetas y estados se construyen con CSS; no incorporan nuevos binarios. |
| `assets/academy/map/europe-diorama-desktop.webp` | Generación original para IvanImports mediante la herramienta integrada de imagen, usando las referencias aportadas únicamente como dirección artística | Activo propio del proyecto | Fondo 2.5D sin textos, interfaz, nodos, ruta ni vehículo. WebP de 268 KB; la interacción se superpone con HTML/SVG real. |
| `assets/academy/map/europe-diorama-mobile.webp` | Adaptación original para IvanImports mediante la herramienta integrada de imagen | Activo propio del proyecto | Composición vertical coherente con desktop, sin interfaz incrustada. WebP de 237 KB. |

## Activos aportados o derivados del producto

| Activo | Procedencia | Uso autorizado en el proyecto |
| --- | --- | --- |
| `assets/importa-7-dias/previews/guide-cover.webp` | Portada del PDF definitivo aportado por el propietario | Vista reducida del producto; no permite reconstruir la guía. |
| `assets/importa-7-dias/previews/inspection.webp` | Página seleccionada del PDF definitivo aportado por el propietario | Vista reducida y contextual de la formación. |
| `assets/importa-7-dias/previews/workbook-cover.webp` | Portada del cuaderno aportado por el propietario | Vista reducida del producto. |
| `assets/importa-7-dias/previews/workbook-sheet.webp` | Página seleccionada del cuaderno aportado por el propietario | Vista reducida y contextual. |
| `assets/importa-7-dias/og-importa-7-dias.jpg` | Composición propia para IvanImports basada en la portada del producto | Open Graph y tarjetas sociales. |
| Logotipos y wordmarks IvanImports | Repositorio y material de marca IvanImports | Identidad de cabecera, acceso y pie. |

Los PDF premium completos permanecen fuera del build público y se entregan únicamente por el backend autorizado.

## Activos preexistentes que requieren conservar su expediente

`assets/importa-7-dias/hero-studio-car.webp` ya formaba parte de la landing antes de esta reconstrucción. No se ha descargado, sustituido ni atribuido a un tercero durante la Fase 2. Debe conservarse junto a su expediente interno de creación o autorización; si ese expediente no puede acreditarse antes de publicar una revisión comercial, se sustituirá por fotografía propia o por una composición original con procedencia registrada.

## Referencias visuales del PDF que no se copian al producto web

La página 149 del PDF declara cinco grupos de procedencia: capturas aportadas por IvanImports, fotografías propias, fotografías editoriales de Pexels bajo sus términos vigentes, una placa alemana de exportación procedente de Wikimedia Commons con atribución junto a la imagen, y gráficos editoriales creados para el curso.

La Fase 2 usa esas páginas como referencia pedagógica, pero no extrae ni publica fotografías editoriales, capturas de portales, fotografías de vehículos, mapas o la placa de exportación dentro del shell. Los conceptos se expresan con SVG propio, texto y componentes interactivos. Esta separación evita convertir una licencia válida para el PDF en una autorización automática para un soporte distinto.

## Condiciones para incorporar material futuro

Antes de añadir una fotografía o captura nueva se debe registrar:

1. nombre y ruta exacta del archivo;
2. autor o propietario;
3. URL de origen, si existe;
4. licencia y versión aplicable;
5. atribución exigida;
6. fecha de descarga o autorización;
7. transformaciones realizadas;
8. páginas o vistas en las que se utiliza;
9. confirmación de que matrículas, VIN y datos personales están anonimizados.

No se aceptan capturas de buscadores como fuente, imágenes sin autor identificable, logos de portales usados como decoración ni recursos marcados como “uso editorial” para una landing comercial.

## Comprobaciones de salida

- El build público no contiene el PDF premium ni el inventario privado.
- No existen URLs remotas de imagen en el shell de Academia v2.
- Los SVG de mapa, iconos y visuales son código local original.
- Las previews se limitan al contexto comercial ya documentado.
- Todo activo futuro de terceros debe añadirse a este registro antes de pasar a `reviewed`.
