# Migración segura del estado Academia v1 a v2

## Alcance

La versión 2 reorganiza los 317 pasos antiguos en 72 lecciones y 13 etapas. Esta migración cambia únicamente la representación del progreso y del punto de lectura. No modifica pagos, identidad, autenticación, entitlement, sesiones, recursos privados, operación, candidatos ni herramientas.

La implementación reutilizable para navegador está en `assets/academy/private/migration.js`. El estado persistido continúa siendo la única fuente de verdad; `localStorage` no participa en la decisión de acceso ni sustituye a Redis.

## Contrato congelado del mapa

La fuente editorial canónica es privada:

`private-products/academy/v2/mappings/legacy-lesson-map.json`

El mapa completo solo debe entregarse después de autenticar y comprobar el entitlement, como parte del programa privado o mediante otro canal privado equivalente. No debe copiarse al bundle público ni a HTML estático.

Formato:

```json
{
  "schemaVersion": 2,
  "mappings": [
    {
      "legacyLessonId": "lesson-3-03",
      "lessonId": "lesson-03-02",
      "lessonSlug": "leer-palabras-alemanas",
      "stageId": "stage-03",
      "conceptId": "concept-094",
      "anchor": "motorschaden"
    }
  ],
  "legacyRouteAliases": {
    "lesson-3-03": {
      "lessonId": "lesson-03-02",
      "anchor": "motorschaden"
    }
  }
}
```

Invariantes:

- `schemaVersion` es `2`.
- Hay exactamente 317 mappings, uno por ID v1.
- Los IDs de etapa son `stage-00` a `stage-12`.
- Los IDs de lección siguen `lesson-SS-LL`.
- `conceptId` y `anchor` son obligatorios y únicos dentro de su ámbito.
- Una lección nueva conserva el mismo `lessonSlug` y `stageId` en todos sus conceptos.
- `legacyRouteAliases` duplica la resolución de ruta, pero `mappings` es la fuente de verdad.

`normalizeLegacyLessonMap(map)` aplica estas comprobaciones estructurales y exige por defecto 317 filas, 72 lecciones y 13 etapas. Los fixtures pequeños deben pasar explícitamente `expectedMappingCount`, `expectedLessonCount` y `expectedStageCount`.

## Algoritmo determinista

`migrateAcademyStateV1ToV2(state, map)` aplica las reglas siguientes:

1. Si `state.schemaVersion >= 2`, devuelve una copia equivalente sin volver a migrar.
2. Agrupa cada ID completado v1 por su `lessonId` v2.
3. Si todos los IDs v1 asociados están completos, marca la lección v2 completa.
4. Si solo una parte está completa, marca la lección v2 empezada, nunca completa.
5. Traduce `progress.currentLessonId` —o el antiguo `activeLessonId` como respaldo— a `currentLessonId`, `currentStageId` y `currentAnchor` v2.
6. Recalcula `completedStageIds` y el porcentaje sobre las 72 lecciones.
7. Añade `schemaVersion: 2` y metadatos de migración.

El orden de los IDs resultantes sigue el orden canónico del mapa, por lo que dos clientes obtienen el mismo estado serializado.

La migración conserva en `migration.legacyState` las secciones v1 que transforma: `progress`, `version` y `activeLessonId`. `operation`, `candidates` y `tools` permanecen, sin transformación, en el estado canónico v2; duplicarlas dentro del snapshot aumentaría innecesariamente el tamaño y el riesgo de divergencia. Los IDs v1 no reconocidos quedan en las listas `unmapped*` para diagnóstico sin PII.

## Integración en el cliente

Orden obligatorio al arrancar la aplicación privada:

1. Obtener la sesión.
2. Obtener programa privado y estado, ya con sesión y entitlement válidos.
3. Normalizar el mapa con `normalizeLegacyLessonMap`.
4. Si el estado es v1, llamar a `migrateAcademyStateV1ToV2` antes de renderizar.
5. Persistir el estado migrado mediante `PUT state` con la `revision` recibida.
6. Ante `409 revision_conflict`, recargar estado y repetir; la idempotencia impide una doble transformación.
7. Renderizar solo el estado v2 confirmado o, si la escritura está temporalmente indisponible, la copia migrada en memoria sin afirmar que ya fue guardada.

Ejemplo:

```js
const map = normalizeLegacyLessonMap(program.legacyLessonMap);
const nextState = migrateAcademyStateV1ToV2(saved.state, map);

if (saved.state.schemaVersion !== 2) {
  await putAcademyState({ state: nextState, revision: saved.revision });
}
```

El servidor acepta ahora `schemaVersion` y `migration` como secciones controladas. Mantiene sus límites de tamaño, profundidad, claves seguras y arrays; la excepción de hasta 500 IDs se aplica solo a las rutas de progreso previstas, incluida la copia legacy.

## Deep links y aliases

No se debe responder 404 a un bookmark antiguo. Antes de resolver una ruta de lección, usar:

```js
const target = resolveLegacyDeepLink(location.pathname, program.legacyLessonMap);

if (target) {
  history.replaceState(null, "", target.href);
  // target.lessonId, target.stageId y target.anchor quedan disponibles.
}
```

Se aceptan IDs v1 y slugs internos antiguos. El resolver solo produce rutas relativas bajo `/paso`; rechaza URLs absolutas, protocol-relative, backslashes y bases no permitidas. Nunca debe interpolarse un alias en HTML sin el escape normal del frontend.

## Aprendizaje y operación real

Son logros independientes:

- `academy_learning_route_completed`: se emite al pasar de no tener a tener las 72 lecciones completas.
- `academy_real_operation_completed`: se emite solo cuando existe una operación, su estado es `matriculado` (o el valor interno `registered`) y están confirmados matrícula, carpeta final y cierre. Además de los nombres v2 `registrationAssigned`, `finalFolderCompleted` y `closureCompleted`, el lector acepta los aliases legacy explícitos `registrationConfirmed`, `tools.spain.finalFolderComplete` y `closureConfirmed`.

`completionTransitionEvents(previousState, nextState, map)` solo emite en el cambio de estado y devuelve propiedades mínimas (`programId`). Completar la ruta de aprendizaje nunca permite inferir que un vehículo fue matriculado.

## Recuperación y rollback

No ejecutar migraciones masivas directamente en producción. El despliegue seguro es lectura v1 + migración idempotente por usuario + escritura CAS.

Para investigar o reconstruir v1:

1. Conservar el registro Redis y su revisión antes de cualquier intervención manual.
2. Tomar `migration.legacyState.progress`, `version` y `activeLessonId`.
3. Combinar esas secciones con `operation`, `candidates` y `tools` actuales, que nunca fueron transformados.
4. No bajar `schemaVersion` automáticamente ni sobrescribir avances v2 sin una decisión operativa explícita.

Si aparecen IDs `unmapped*`, detener el guardado automático para ese caso, registrar únicamente contadores/IDs técnicos (sin email, IP, notas ni datos del vehículo) y corregir el mapa. Un mapa canónico completo debe dejar esos arrays vacíos.

## Regresión y zona roja

`tests/academy-v2-migration.test.js` cubre:

- contrato 317 → 72 → 13;
- completo, parcial, current lesson y anchor;
- idempotencia y no mutación;
- escala real y validación del estado persistido;
- aliases y rechazo de open redirects;
- separación de los dos eventos de finalización;
- validación Stripe previa al entitlement;
- entitlement persistente, revocación, sesión y descarga Blob privada;
- hashes SHA-256 normalizados de las APIs y scripts protegidos.

Ejecutar:

```powershell
node --test tests/academy-v2-migration.test.js
npm.cmd run check
```

Un cambio de hash en la zona roja debe revisarse como cambio de seguridad, no actualizarse mecánicamente. Esta fase no autoriza cambios en Stripe, webhooks, Resend, Redis, Blob, auth, rewrites o scripts operativos.
