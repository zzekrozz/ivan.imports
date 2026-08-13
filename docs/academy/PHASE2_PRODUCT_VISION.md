# Academia IvanImports · Visión de producto Fase 2

## Resultado

La Academia debe sentirse como una ruta operativa europea con un destino claro, no como una biblioteca ni como una lista interminable. El alumno avanza desde su situación real hasta comprender cómo buscar, comprobar, comprar, traer y matricular un vehículo usado europeo en España.

La arquitectura editorial v2 reduce la navegación principal de 317 pasos a 72 lecciones. Los 317 temas anteriores permanecen como conceptos consultables y como destinos de búsqueda. No se pierde conocimiento ni continuidad de progreso.

## Promesa responsable

El programa enseña una secuencia y un método de decisión. No promete que toda importación termine en siete días ni que completar el contenido equivalga a haber matriculado un vehículo.

- Cierre académico: `HAS COMPLETADO LA RUTA.`
- Cierre operativo, únicamente con una matrícula española real registrada: `FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.`

El estado operativo nunca se infiere del progreso académico.

## Arquitectura del recorrido

La ruta contiene 13 etapas: un prólogo que no cuenta para el progreso principal y 12 etapas operativas. Cada etapa agrupa un número pequeño de lecciones principales y termina con un checkpoint comprensible.

La distribución canónica es:

| Etapa | Lecciones |
| --- | ---: |
| Prólogo | 3 |
| 1 | 5 |
| 2 | 7 |
| 3 | 6 |
| 4 | 5 |
| 5 | 7 |
| 6 | 8 |
| 7 | 5 |
| 8 | 7 |
| 9 | 4 |
| 10 | 4 |
| 11 | 7 |
| 12 | 4 |
| Total | 72 |

## Capas de producto

La experiencia combina cinco capas:

1. Ruta: 72 lecciones que ordenan el trabajo principal.
2. Consulta: 317 conceptos enlazables por ancla y encontrables desde búsqueda.
3. Operación: candidato, presupuesto, evidencias, documentos, decisiones y estado real.
4. Herramientas: 17 utilidades vinculadas a etapas y lecciones.
5. Fuentes: páginas del PDF, fuentes oficiales y hechos mutables con fecha de revisión.

Los 40 vídeos permanecen como planes editoriales sin URL. La ausencia de vídeo nunca bloquea el texto ni crea un hueco visual que simule contenido publicado.

## Principios de experiencia

- Una decisión presente por pantalla; el mapa conserva el contexto futuro.
- Profundidad progresiva: explicación sencilla, evidencia, ejemplo, error y acción.
- El alumno puede empezar sin candidato o incorporarse desde una operación ya avanzada.
- Una incógnita crítica se muestra como pendiente, nunca como cero ni como confirmada.
- Volver sin comprar es un resultado válido cuando el vehículo no supera los límites.
- La experiencia personal se etiqueta como experiencia; una norma se enlaza a su fuente.
- Las cifras mutables no se convierten en valores jurídicos concluyentes.

## Límite privado

Los cuerpos de lección, conceptos, checklists, ejemplos y mapas de migración viven en `private-products/academy/v2/`, fuera de Git y de la distribución pública. El catálogo versionado solo puede contener metadatos seguros. El JSON compilado se entrega únicamente por la API autenticada de Academia.

El identificador de programa permanece estable como `importa-tu-primer-coche` para conservar entitlements. La versión se distingue mediante `schemaVersion: 2` y `version: 2026.08-v2`.

## Métricas de aceptación

- 13 etapas y 72 lecciones exactas.
- 317 conceptos y 317 mapeos legacy exactos.
- 72 explicaciones, acciones, errores, ejemplos y visuales con propósito.
- Al menos 50 ejemplos prácticos específicos; la implementación actual contiene 72.
- Cero prosa generada por fallback a partir del título.
- Cero mezcla entre Motorschaden y Getriebeschaden.
- Tres casos separados de campo K y tres casos separados de V.7.
- Fórmulas de ROI, combustible y precio máximo comprobadas.
- Final académico y final operativo separados.
