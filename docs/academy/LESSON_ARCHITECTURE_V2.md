# Arquitectura de lección v2

## Fuente privada

La fuente editorial reside en `private-products/academy/v2/` y está excluida de Git. El ensamblador `build-program-v2.mjs` valida y crea `dist/program-v2.json`. No genera prosa.

```text
private-products/academy/v2/
  program.json
  stages/stage-00.json … stage-12.json
  lessons/stage-00/*.json … lessons/stage-12/*.json
  concepts/concepts.json
  faqs/faqs.json
  glossary/glossary.json
  tools/tools.json
  resources/resources.json
  videos/videos.json
  sources/official-sources.json
  sources/content-facts.json
  mappings/legacy-lesson-map.json
  mappings/concept-map.json
  mappings/source-map.json
  build-program-v2.mjs
  dist/program-v2.json
```

## Identificadores

- Programa: `importa-tu-primer-coche`.
- Etapas: `stage-00` a `stage-12`.
- Lecciones: `lesson-SS-LL`, por ejemplo `lesson-06-04`.
- Conceptos: ID estable y semántico; el ancla es igual al ID.
- Los slugs de lección incorporan etapa, orden y título normalizado.

El ID del programa no incluye `v2`; los entitlements existentes dependen de su estabilidad. La versión se expresa en `schemaVersion` y `version`.

## Stage

Campos principales:

```json
{
  "schemaVersion": 2,
  "id": "stage-06",
  "slug": "hablar-documentar-y-negociar",
  "order": 6,
  "kind": "core",
  "countsTowardProgress": true,
  "title": "…",
  "shortTitle": "…",
  "subtitle": "…",
  "description": "…",
  "estimatedMinutes": 96,
  "sourcePages": [64, 65],
  "mapPosition": { "x": 61, "y": 29 },
  "lessonIds": ["lesson-06-01"],
  "checkpoint": { "title": "…", "description": "…" },
  "toolIds": [],
  "resourceIds": [],
  "completionMessage": "…"
}
```

Las etapas solo contienen `lessonIds`. No anidan cuerpos de lección.

## Lesson

Campos obligatorios:

```json
{
  "schemaVersion": 2,
  "id": "lesson-06-04",
  "slug": "06-04-…",
  "stageId": "stage-06",
  "order": 4,
  "lessonType": "VISUAL_DECODER",
  "editorialStatus": "reviewed",
  "title": "…",
  "oneSentence": "…",
  "simpleExplanation": "…",
  "objective": "…",
  "decision": "…",
  "actionNow": { "label": "…", "body": "…", "output": "…" },
  "commonMistake": { "title": "…", "body": "…" },
  "example": { "title": "…", "body": "…", "type": "source-example" },
  "checklist": [],
  "knowledgeCheck": { "question": "…", "answer": "…" },
  "sourcePages": [],
  "sections": [],
  "visual": { "type": "…", "title": "…", "purpose": "…", "sourcePages": [] },
  "legacyLessonIds": [],
  "conceptIds": [],
  "relations": { "previousLessonId": null, "nextLessonId": null, "relatedLessonIds": [] },
  "videoIds": [],
  "toolIds": [],
  "faqIds": [],
  "completion": { "kind": "learning", "doesNotAssertRealOperation": true }
}
```

Tipos admitidos:

- `NARRATIVE_ROUTE`
- `VISUAL_DECODER`
- `COMPARISON_LAB`
- `GUIDED_CALCULATION`
- `CONVERSATION_SIMULATOR`
- `INSPECTION_WORKBENCH`
- `PROCEDURE_TIMELINE`

## Concept

```json
{
  "id": "concept-6-20-k-europeo",
  "title": "Campo K europeo reconocible",
  "aliases": [],
  "shortAnswer": "…",
  "explanation": "…",
  "action": "…",
  "lessonId": "lesson-06-04",
  "anchor": "concept-6-20-k-europeo",
  "sourcePages": [72],
  "type": "practical",
  "glossaryTerms": [],
  "officialSourceIds": [],
  "relatedConceptIds": [],
  "legacyLessonId": "lesson-6-20"
}
```

Cada uno de los 317 conceptos conserva exactamente un `legacyLessonId`, una nueva lección y un ancla. La búsqueda navega a `lessonId#anchor`.

## Migración legacy

El formato canónico es:

```json
{
  "schemaVersion": 2,
  "mappings": [
    {
      "legacyLessonId": "lesson-6-20",
      "lessonId": "lesson-06-04",
      "lessonSlug": "06-04-…",
      "stageId": "stage-06",
      "conceptId": "concept-6-20-k-europeo",
      "anchor": "concept-6-20-k-europeo"
    }
  ],
  "legacyRouteAliases": {
    "lesson-6-20": {
      "lessonId": "lesson-06-04",
      "anchor": "concept-6-20-k-europeo"
    }
  }
}
```

El objeto completo también se incluye como `legacyLessonMap` en el JSON privado compilado. No se incluye en catálogo público.

## Contrato compilado

`dist/program-v2.json` expone, tras autenticación:

- metadatos de programa;
- `stages`, `lessons`, `concepts`;
- `tools`, `resources`, `videos`;
- `faqs` y alias `answers`;
- `glossary`, `officialSources`, `contentFacts`;
- `sourceMap`, `conceptMap`, `legacyLessonMap`;
- `searchIndex`.

El índice se deriva de contenido ya redactado. Indexar y normalizar texto es válido; crear explicación o acción en el build no lo es.
