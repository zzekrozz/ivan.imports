# Guía de estilo editorial · Academia v2

## Voz

Escribe en español claro, directo y adulto. Explica para una persona que nunca ha importado sin infantilizarla. Cada párrafo debe ayudar a comprender una decisión, interpretar una evidencia o ejecutar un siguiente paso.

Prefiere verbos concretos: comprobar, comparar, registrar, pedir, recalcular, detener, consultar. Evita frases que solo anuncian el tema o describen que “la guía habla de” algo.

## Regla de autoría

Toda lección se redacta explícitamente. El ensamblador puede leer, validar, relacionar e indexar; no puede fabricar explicación, error, ejemplo, acción, checklist ni respuesta desde el título, la etapa o un extracto automático.

No utilizar:

- “La guía centra…”
- “Resolver X evita errores…”
- “Registra en tu operación el resultado…”
- “Puedo explicar qué resuelve…”
- “He registrado el resultado o siguiente acción…”
- checklists idénticas con el título sustituido.

## Unidad mínima de una lección

Cada lección incluye:

- una frase que fija la idea;
- una explicación sencilla redactada para ese tema;
- una decisión concreta;
- un ejemplo práctico específico y etiquetado;
- un error específico;
- una acción ejecutable con resultado esperado;
- al menos tres comprobaciones propias;
- una pregunta de conocimiento con respuesta;
- páginas fuente;
- un visual con propósito;
- relaciones con conceptos y lecciones.

La composición visual puede variar según el tipo de lección. No todas deben mostrarse como cuatro tarjetas iguales.

## Tipos de evidencia

### Experiencia

Describe lo vivido u observado por el autor. Utiliza primera persona solo cuando la fuente realmente la sostiene. No generalices una experiencia como obligación, tarifa o resultado universal.

### Oficial

Explica un requisito, procedimiento o dato sostenido por una autoridad. Incluye `sourceId`, fecha de revisión y advertencia de mutabilidad cuando corresponda. No escribas “oficial” sobre una recomendación editorial.

### Recomendación

Propone una forma prudente de actuar. Debe decir qué riesgo protege y permitir que el alumno la adapte al caso.

### Cálculo

Muestra fórmula, unidades, orden de operaciones y un ejemplo reproducible. Declara si es didáctico, estimativo o sujeto a verificación. No presenta una aproximación como liquidación fiscal.

## Ejemplos

Etiqueta el origen:

- `didactic`: escenario construido sin afirmar que ocurrió;
- `source-example`: ejemplo presente en el PDF;
- `source-calculation`: cálculo reproducido de la fuente;
- `source-experience`: experiencia narrada expresamente en la fuente.

No inventes compradores, vendedores, averías, resultados, precios o anécdotas. Un ejemplo didáctico puede describir una decisión sin atribuirla a una persona real.

## Respuestas de conceptos

Cada concepto conserva tres piezas distintas:

- `shortAnswer`: respuesta directa, específica y de hasta 180 caracteres;
- `explanation`: contexto trazado a la fuente, nunca una copia de la respuesta breve;
- `action`: comprobación ejecutable, no una plantilla que inserta el título entre comillas.

No cortes una respuesta con puntos suspensivos. Si la extracción del PDF mezcla columnas o incorpora el siguiente epígrafe, vuelve a la página visual y redacta de nuevo. Los términos procedentes de tablas deben conservar su fila, columna y escenario propios.

## Números y normativa

- Mantén unidades y monedas en cada cifra.
- Conserva filas y columnas de las tablas visuales.
- No concatentes pares de ejemplos.
- Los importes mutables usan `status: verify-before-use` y `lastReviewed`.
- No uses una cifra experiencial como valor por defecto jurídico.
- Las fuentes oficiales deben proceder del catálogo verificado; no inventes enlaces.

Los casos críticos se redactan siempre por separado:

- Motorschaden: motor.
- Getriebeschaden: caja de cambios.
- Campo K europeo reconocible.
- Campo K nacional o distinto.
- Campo K vacío.
- V.7 con 118 g/km.
- V.7 con 165 g/km.
- V.7 vacío.

## Visuales

Un visual existe para aclarar una relación difícil de entender solo con texto. Su especificación debe incluir `type`, `title`, `purpose` y `sourcePages`. Los datos estructurados deben reflejar exactamente la fuente.

No reutilices una fotografía del PDF sin validar créditos y licencia. Si el propósito puede resolverse mejor con un componente propio, reconstruye tabla, flujo, mapa o diagrama sin copiar el diseño editorial.

## Revisión

`editorialStatus: authored` indica redacción explícita con fuente y estructura completas. `reviewed` indica además comprobación visual o técnica de un asunto crítico. Cambiar a `reviewed` requiere verificar páginas, datos estructurados y clasificación de evidencia.
