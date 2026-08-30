# IVI V1 · Imports Vehicle Intelligence

## Auditoría inicial

IvanImports es una aplicación multipágina estática desplegada en Vercel. Las páginas públicas son HTML generado, el frontend usa JavaScript ESM sin framework y las funciones de servidor viven en `api/`. No hay Supabase. La persistencia durable existente utiliza Upstash Redis; la Academia usa Vercel Blob para productos privados. Stripe está aislado en funciones server-side. Los tests usan `node:test` y el build copia una allowlist explícita a `dist/`.

Patrones reutilizados por IVI:

- handlers Web `Request`/`Response` adaptados a Vercel Node;
- proveedor externo aislado detrás de un adaptador;
- modelo interno separado de la respuesta del proveedor;
- `fieldSources`/provenance en el modelo de vehículos existente;
- Redis namespaced según Preview/Production;
- generación pública reproducible y build que impide publicar `api/`, secretos o productos privados.

## Arquitectura adoptada

```text
/ivi/ → POST /api/ivi/analyze
                  │
                  ├─ valida inputs y crea IVI-YYYY-XXXXXXXX
                  ├─ OneAutoProvider (server-side, sandbox por defecto)
                  │     ├─ VIN Decoder → identidad base
                  │     ├─ OE Build Sheet → configuración de fábrica
                  │     ├─ 200 → READY/PARTIAL
                  │     ├─ 202 → PROCESSING → callback firmado
                  │     ├─ 204 → NO_DATA
                  │     └─ error → FAILED
                  ├─ normaliza One Auto → IVIVehicle
                  ├─ aplica IVI Spain/findings engine
                  └─ persiste informe y raw por separado

GET /api/ivi/report → informe protegido por token opaco
GET /api/ivi/pdf    → IVI Vehicle Report multipágina
```

El acceso al informe usa un token aleatorio cuyo hash se guarda en servidor. El token no se añade a la URL. El callback de One Auto usa otro token firmado. El VIN no se envía a analytics ni se incluye en logs de error.

## One Auto API

El primer adaptador combina VIN Decoder y OE Build Sheet Europe from VIN. Ambas consultas se ejecutan en servidor y en paralelo; el decoder respalda marca/modelo cuando el build sheet no los incluye. Si solo existe identidad, el resultado es `PARTIAL`, no un falso `NO_DATA`.

Endpoints:

- live: `https://api.oneautoapi.com/oneauto/oebuildsheeteuropefromvin`;
- sandbox: `https://sandbox.oneautoapi.com/oneauto/oebuildsheeteuropefromvin`;
- live decoder: `https://api.oneautoapi.com/cartell/vindecoder`;
- sandbox decoder: `https://sandbox.oneautoapi.com/cartell/vindecoder`;
- autenticación server-side mediante `x-api-key`;
- parámetro `vehicle_identification_number`;
- callback asíncrono con `return_data_in_callback=true`;
- estados HTTP `200`, `202`, `204`, `206`, `400`, `403`, `429`, `500` y `503`.

Referencias verificadas el 17 de agosto de 2026:

- <https://www.oneautoapi.com/service/oe-build-sheet-data-europe-from-vin/>
- <https://www.oneautoapi.com/service/cartell-vin-decoder/>
- <https://swagger.oneautoapi.com/>
- <https://docs.oneautoapi.com/knowledgebase/documentation/>

Los fixtures están sanitizados. Ningún test llama a One Auto ni consume créditos.

## Modelo normalizado

`IVIVehicle` separa:

- `identity`;
- `factory`;
- `technical`;
- `emissions`;
- `homologation`;
- `equipment` agrupado;
- `sources`.

Cada punto relevante usa `{ value, source, confidence, status, retrievedAt }`. Los valores vacíos se convierten en `unknown`, no en `false`. Solo una negación explícita del build sheet produce `false`.

## Motor IVI

V1 incluye reglas para:

- homologación no confirmada;
- CO₂ no confirmado;
- bola declarada no confirmada de fábrica;
- llantas, suspensión, escape, GLP, camperización, iluminación, kit exterior y potencia modificados;
- formato VIN no estándar;
- identificación parcial;
- recomendación de revisión documental.

Las preguntas para el vendedor son deterministas y derivan de findings. No hay score arbitrario. El veredicto usa `Sin bloqueantes evidentes`, `Información pendiente`, `Revisar antes de comprar` o `Riesgo importante detectado`.

## Costes España

El precio de compra declarado queda confirmado. Transporte, ITV, IEDMT, DGT, IVTM y CoC/ficha reducida permanecen `pending` hasta disponer de los datos que permiten calcularlos sin falsa precisión. V1 no calcula IEDMT con CO₂ desconocido.

## PDF

El PDF se genera en servidor sin navegador ni dependencia pesada. Es un documento vectorial reproducible y multipágina con portada, resumen, identificación, fábrica, equipamiento, homologación, emisiones, findings, costes, pendientes, preguntas, fuentes y disclaimer. El VIN aparece protegido en portada.

## Persistencia y retención

- Informe normalizado: Redis, TTL por defecto de 365 días.
- Respuesta raw: clave separada, TTL por defecto de 30 días.
- Analytics: contadores agregados diarios sin VIN.
- Estados: `DRAFT`, `PROCESSING`, `READY`, `PARTIAL`, `NO_DATA`, `FAILED`.

Los TTL son configurables y no presuponen derechos de almacenamiento: deben ajustarse al contrato final con el proveedor.

## Variables de entorno

```text
IVI_ANALYSIS_ENABLED
IVI_BASE_URL
IVI_CALLBACK_SECRET
ONE_AUTO_API_KEY
ONE_AUTO_SANDBOX
ONE_AUTO_TIMEOUT_MS
IVI_REDIS_REST_URL
IVI_REDIS_REST_TOKEN
IVI_REPORT_TTL_SECONDS
IVI_RAW_TTL_SECONDS
```

`IVI_REDIS_*` puede omitirse para reutilizar `UPSTASH_*`/`KV_*`. El análisis está apagado por defecto. No se debe establecer `ONE_AUTO_SANDBOX=false` hasta validar credenciales, cobertura, licencia, retención y costes.

## Limitaciones actuales

- La documentación detallada y el Swagger completo de One Auto requieren cuenta; el normalizador tolera campos opcionales y se basa en el contrato público verificado.
- VIN Decoder y OE Build Sheet no garantizan cobertura, homologación o CO₂ para todos los VIN; cualquier ausencia permanece explícitamente desconocida.
- No existe proveedor AutoRef ni revisión documental automatizada en V1.
- No se ha activado checkout. El precio comercial se muestra como 24,99 €, pero no se reutiliza ningún flujo Stripe LIVE.
- No hay cálculo fiscal definitivo sin CO₂, base imponible y reglas vigentes confirmadas.
- Una prueba con VIN real requiere credenciales sandbox o autorizadas y almacenamiento durable configurado.

## Verificación

`npm run check` ejecuta lint, sintaxis, tests y build. En la implementación actual: 224 tests, 215 aprobados, 9 omitidos por fuentes editoriales privadas, 0 fallos. Los 28 tests específicos de IVI pasan. El build valida 0 enlaces internos rotos y no publica secretos, APIs ni respuestas raw.

## Próximo paso recomendado

1. Configurar One Auto sandbox y ejecutar una matriz controlada de VIN por fabricante.
2. Confirmar contrato, derechos de retención y forma exacta de callback.
3. Ajustar el normalizador con respuestas reales sanitizadas.
4. Incorporar un `HomologationProvider` (probablemente AutoRef) para WVTA/TVV, categoría, masas, neumáticos y CO₂.
5. Solo después, activar checkout específico de IVI y probar el flujo completo en Preview.
