# Product spec · Academia IvanImports

## Producto

- Marca: **Academia IvanImports**.
- Programa: **Importa tu primer coche**.
- Descriptor: **Desde cero, paso a paso**.
- Sistema final: **Método 7 días**; es planificación operativa, no garantía de plazo.
- Promesa: de la primera búsqueda a la matrícula española, el alumno sabe qué comprobar, qué hacer y cuál es el siguiente paso.
- Fuente editorial: PDF definitivo de agosto de 2026, 150 páginas, SHA-256 `07B2ECBBC28AD0FEF691534AF81CA78D19977D491DEDCBD17A2225DE3E5FECB8`.

## Usuario principal

La experiencia se diseña primero para una persona que nunca ha importado, no domina el idioma ni la terminología y teme cometer un error costoso. También debe servir a profesionales, personas con un candidato elegido, compradores que ya están en España y usuarios que solo necesitan validar números.

## Principios

1. Simple, pero no simplista.
2. Ruta, Etapa, Paso, Operación, Checkpoint, Herramienta y Recurso son los términos de interfaz.
3. Una duda urgente puede abrir cualquier paso; el orden pedagógico no bloquea el acceso.
4. Experiencia personal, recomendación, cálculo didáctico y regla oficial nunca se presentan como equivalentes.
5. Tasas y procedimientos mutables muestran fuente, revisión y `verify-before-use`.
6. El resultado correcto puede ser verificar o no comprar.
7. El PDF y el cuaderno siguen siendo recursos privados; la academia es la experiencia principal.

## Alcance implementado

- Prólogo más 12 etapas, 317 pasos y 17 herramientas relacionadas.
- Catálogo de 40 vídeos en estado `planned`, sin URL inventada y sin bloquear el texto.
- Búsqueda sobre pasos, respuestas, glosario y herramientas.
- Progreso, operación, candidatos y estado de herramientas persistidos por usuario.
- Acceso mediante entitlement y desafío por email.
- Guía y cuaderno servidos por endpoint privado.
- Contenido premium separado del repositorio público y cargado desde Blob privado.

## Fuera de alcance o no garantizado

- Homologaciones individuales, terceros países, reformas complejas o fiscalidad particular sin revisión profesional.
- Autoliquidación legal definitiva del Modelo 576.
- Diagnóstico mecánico profesional remoto.
- Traducciones jurídicas automáticas.
- Garantía de compra, matriculación o plazo de siete días.
- CMS visual o panel de administración público.

## Resultado esperado

El alumno puede explicar el recorrido, crear una operación, guardar candidatos, calcular un coste conservador, preparar preguntas y documentos, inspeccionar, organizar el viaje y cerrar la carpeta española. La finalización visual ocurre cuando existe matrícula española, no al terminar un vídeo.

## Métricas de producto

- Acceso válido frente a fallido, sin registrar PII en analítica.
- Onboarding y etapa actual.
- Pasos y etapas completados.
- Uso de herramientas y recursos.
- Consultas de búsqueda y búsquedas sin resultado, agregadas y sin VIN/email.
- Finalización del Método 7 días y del programa.

## Separación de contenido

`api/_academy/content.js` contiene el loader seguro y un catálogo público mínimo. Los cuerpos, checklists, fuentes completas y hechos viven en `private-products/academy/program-2026.json`, ignorado por Git. Producción debe cargarlo mediante `ACADEMY_CONTENT_BLOB_PATHNAME`; nunca se copia a `dist/` ni se entrega sin entitlement.
