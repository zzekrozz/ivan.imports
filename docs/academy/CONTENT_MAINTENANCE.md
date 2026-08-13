# Content maintenance

## Fuentes de verdad

1. PDF definitivo, edición agosto de 2026, 150 páginas.
2. Código y arquitectura de acceso actuales.
3. Especificación de producto.
4. Fuentes oficiales primarias para información mutable.

No mezclar silenciosamente borradores anteriores. El PDF se identifica por SHA-256 `07B2ECBBC28AD0FEF691534AF81CA78D19977D491DEDCBD17A2225DE3E5FECB8`.

## Dónde vive cada cosa

- `private-products/academy/catalog-source.json`: catálogo local auxiliar, ignorado por Git.
- `private-products/academy/generate-program.mjs`: generador editorial local, ignorado por Git.
- `private-products/academy/program-2026.json`: programa premium local, ignorado por Git.
- `docs/academy/content-source-map.json`: slugs, títulos y páginas; seguro para versionar.
- Blob privado configurado por `ACADEMY_CONTENT_BLOB_PATHNAME`: contenido de producción.

Nunca copiar cuerpos premium a componentes, documentación versionada, `dist/` o assets públicos.

## Actualizar un paso

1. Confirmar la página exacta del PDF.
2. Mantener el ID y slug si el significado sigue siendo el mismo.
3. Distinguir el tipo del bloque.
4. Añadir `sourceId` y `sourcePage`.
5. Marcar `needsEditorialReview` si la afirmación no está sustentada.
6. Regenerar el JSON privado.
7. Validar en dry-run: `node scripts/upload-academy-content.mjs`.
8. Revisar que siguen existiendo 13 etapas, 317 pasos y 40 vídeos planned sin URL.
9. Actualizar el source map solo con metadatos seguros.
10. Subir a Blob únicamente tras revisión y con confirmaciones explícitas.

## Datos oficiales

- Enlaces: solo fuentes primarias verificadas.
- Cada hecho incluye `lastReviewed`, `source`, `page` y `status`.
- Las cifras sensibles usan `verify-before-use` aunque el enlace se haya comprobado.
- No actualizar desde blogs, snippets o contenido comercial.
- Si una fuente cambia, conservar historial editorial y revisar todos los pasos que la referencian.

Fuentes verificadas el 11 de agosto de 2026: DGT (UE y matriculación), AEAT (Modelo 576 e instrucciones), BOE (Ley 38/1992) e Industria (vehículos). RDW, movilidad belga y administración alemana conservan referencia de dominio del PDF y estado `verify-before-use` hasta validar la URL exacta.

## Publicación privada

Dry-run por defecto:

```powershell
node scripts/upload-academy-content.mjs
```

Aplicación autorizada:

```powershell
node scripts/upload-academy-content.mjs --apply --confirm-private-upload
```

Producción requiere además `--confirm-production`. El token solo vive en `BLOB_READ_WRITE_TOKEN`. El script valida tamaño, relaciones, vídeos y fuentes oficiales antes de conectar.

## Revisión periódica

- Mensual durante lanzamiento: enlaces y tasas.
- Antes de cada campaña: precio/copy de venta frente al producto real.
- Trimestral: procedimientos DGT, AEAT, ITV, exportación y recursos.
- En cada cambio del PDF: hash, edición, source map y versión de programa.
