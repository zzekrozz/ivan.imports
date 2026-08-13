# QA de contenido v2

## Comandos

Desde la raíz del repositorio:

```powershell
node .\private-products\academy\v2\build-program-v2.mjs
node .\scripts\academy-content-qa-v2.mjs
```

El primer comando ensambla e indexa. El segundo valida fuentes y salida compilada. Ninguno sube contenido, modifica Blob, despliega ni cambia compradores.

## Puertas estructurales

El QA falla si no encuentra:

- ID estable `importa-tu-primer-coche`;
- `schemaVersion: 2`;
- 13 etapas con IDs `stage-00` a `stage-12`;
- distribución exacta `3,5,7,6,5,7,8,5,7,4,4,7,4`;
- 72 lecciones únicas;
- 317 conceptos únicos;
- 317 mappings legacy y aliases consistentes;
- 17 herramientas;
- 40 vídeos planificados sin URL inventada;
- etapas sin cuerpos duplicados.

## Puertas editoriales

Cada lección debe tener:

- estado `authored` o `reviewed`;
- frase central;
- explicación propia;
- acción y resultado;
- error específico;
- ejemplo específico;
- tres comprobaciones;
- pregunta y respuesta;
- páginas fuente válidas;
- visual con propósito;
- conceptos y IDs legacy;
- cierre de aprendizaje que no afirma una operación real.

El QA rechaza los prefijos y fallbacks genéricos definidos en la guía editorial. Exige al menos 50 ejemplos prácticos; la fuente actual contiene 72.

Para los 317 conceptos también exige:

- `shortAnswer` único, distinto de `explanation` y con un máximo de 180 caracteres;
- ausencia de puntos suspensivos o fragmentos truncados;
- ausencia de residuos de columnas y epígrafes contiguos detectados en el PDF;
- acción concreta sin las antiguas plantillas que insertaban el título;
- páginas fuente y ancla estable.

## Regresiones críticas

Hay aserciones explícitas para:

- Motorschaden = motor y no caja.
- Getriebeschaden = caja de cambios y no motor.
- K vacío, K europeo y K nacional/distinto como tres conceptos independientes.
- V.7 con 118, 165 y vacío como tres ramas independientes.
- ocho filas exactas de la tabla de falsos mínimos y dos outliers.
- precio máximo europeo del ejemplo: 10.520 €.
- ROI: fórmula y ejemplos de 37,5 %, 30 % y 10 %.
- combustible: kilómetros × consumo / 100 × precio por litro.
- cuatro ejemplos didácticos del 576 y estado `verify-before-use`.
- tasa DGT de referencia marcada `verify-before-use`.
- textos canónicos y condiciones distintas para cierre académico y operativo.

## Auditoría del PDF

Si existe `private-products/academy/source-audit-2026.json`, el QA exige:

- SHA-256 esperado;
- 150 páginas exactas y numeración única;
- campos `number`, `title`, `sections`, `visualElements`, `tables`, `images`, `credits`, `concepts`, `relatedLessonIds`;
- relaciones únicamente a IDs de lección v2 válidos.

La auditoría registra inventario y relaciones. No autoriza automáticamente reutilizar imágenes: los créditos y licencias siguen necesitando revisión.

## Interpretar un fallo

1. Corrige el archivo fuente de etapa, lección, concepto o mapping.
2. No parches solo `dist/program-v2.json`; se regenerará.
3. Ejecuta de nuevo el build.
4. Ejecuta el QA de contenido.
5. Ejecuta después el QA general del repositorio en proporción al cambio.

## Seguridad

- No copies cuerpos privados a `api/_academy/content.js`, documentación pública o catálogo.
- No añadas el PDF al repositorio.
- No inventes URL de vídeo o fuente oficial.
- No ejecutes el uploader como parte del QA.
- No incluyas pathname de Blob ni secretos en el JSON entregado al cliente.
- El mapa legacy viaja solo dentro del programa autenticado.
