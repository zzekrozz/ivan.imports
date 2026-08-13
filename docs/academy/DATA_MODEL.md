# Data model

## Content entities

### Program

`id`, `slug`, `title`, `descriptor`, `subtitle`, `version`, `lastReviewed`, `stages`, `lessons`, `tools`, `answers`, `faqs`, `glossary`, `resources`, `officialSources`, `contentFacts` y `searchIndex`.

El catálogo seguro puede contener títulos, slugs y páginas. Los bloques premium solo existen en el JSON privado.

### Stage

`id`, `slug`, `order`, `kind`, `countsTowardProgress`, `title`, `shortTitle`, `subtitle`, `description`, `estimatedMinutes`, `mapPosition`, `pageRange`, `lessonIds`, `checkpoint`, `tools`, `resources` y `completionMessage`.

La etapa 0 usa `kind: prologue` y `countsTowardProgress: false`. Las etapas no duplican objetos de lección; referencian `lessonIds`.

### Lesson

`id`, `slug`, `stageId`, `order`, `title`, `summary`, `learningObjective`, `estimatedMinutes`, `blocks`, `checklist`, `faqIds`, `glossaryTerms`, `toolLinks`, `resourceLinks`, `sourceLinks`, `sourcePageRange`, `lastReviewed`, `previousStep`, `nextStep` y `video`.

Un bloque tiene `type`, `title`, `body`, `sourceId` y `sourcePage`. Los tipos admitidos son `experiencia`, `oficial`, `recomendacion`, `calculo`, `error` y `accion`.

### ContentFact

`id`, `label`, `value`, `unit`, `jurisdiction`, `effectiveDate`, `lastReviewed`, `source`, `sourceId`, `page`, `status` y `notes`.

Los importes y procedimientos sensibles usan `status: verify-before-use`; no alimentan una conclusión legal por defecto.

## Identidad y entitlement

El email normalizado nunca se usa como clave directa. `emailHash()` genera un subject HMAC con `ACADEMY_DATA_SECRET`.

`Entitlement` contiene `status`, `programId`, `subject`, referencia de compra truncada, fechas, elegibilidad del bonus y vencimiento de soporte. La compra se vincula de forma idempotente mediante una clave HMAC de la sesión Stripe.

## Persistencia Redis

Prefijo: `academy:v1`.

| Clave lógica | Propósito |
|---|---|
| `entitlement:{subject}:{programId}` | Derecho de acceso activo |
| `purchase:{digest}` | Idempotencia y vínculo compra-identidad |
| `auth:active:{subject}` | Desafío activo |
| `auth:code:{subject}:{digest}` | Código de un solo uso |
| `auth:gate:{challengeId}` | Consumo único del desafío |
| `auth:attempts:{subject}` | Intentos de código |
| `rate:{scope}:{digest}` | Límites de solicitud/verificación |
| `session:{digest}` | Sesión opaca del navegador |
| `state:{subject}:{programId}` | Estado privado del alumno |

## Estado del alumno

El payload permitido se limita a:

- `version`;
- `progress`;
- `operation`;
- `candidates` (máximo 20);
- `tools`;
- `preferences`;
- `activeLessonId`.

`progress` puede incluir `completedLessonIds`, `completedStageIds`, etapa/paso actual y porcentaje derivado. El servidor valida forma, profundidad, cantidad de nodos, longitud de strings, IDs y tamaño total (256 KiB). No se guardan archivos en Redis.

## Concurrencia

El estado se devuelve con `revision`. La escritura debe enviar la revisión esperada; un conflicto evita sobrescribir cambios de otra pestaña. El cliente puede reintentar después de volver a leer.

## Aislamiento

El subject procede exclusivamente de la sesión verificada. Ningún `userId`, `operationId` o email del navegador decide qué clave se lee. Esto evita que cambiar un ID en la URL exponga datos ajenos.

## Ciclo de vida y minimización

El estado admite datos operativos, pero no archivos. La interfaz debe desalentar documentos, identidad de terceros y notas sensibles que no sean necesarias; los logs y la analítica no deben copiar el payload. Si se admite VIN, debe tratarse como dato de operación privado y no enviarse a búsqueda o telemetría.

Los TTL técnicos de autenticación y sesión se configuran por entorno. Para `entitlement`, `state`, referencias de compra, auditoría y tombstones se requiere una matriz de retención aprobada antes de producción. Debe cubrir acceso activo, revocación, cierre, exportación, supresión, copias y cualquier conservación legal. El borrado debe recorrer índices y sesiones asociados al subject, no solo la clave principal.

Los proveedores que almacenen o transporten estas entidades deben figurar en el inventario de tratamiento y en los DPA aplicables. Ningún plazo, base jurídica o identidad fiscal se deduce del modelo técnico.
