# Information architecture

## Superficies

| Superficie | Ruta | Acceso |
|---|---|---|
| Biblioteca pública | `/academia/` | Pública; no contiene el programa premium |
| Recuperar acceso | `/academia/acceso/` | Pública, noindex, desafío por email |
| Inicio privado | `/academia/importa-tu-primer-coche/` | Entitlement + sesión |
| Ruta visual | `/ruta` | Privada |
| Etapa | `/etapa/:slug` | Privada |
| Paso | `/paso/:slug` | Privada |
| Mi operación | `/mi-operacion` | Privada |
| Candidatos | `/candidatos` | Privada |
| Herramientas | `/herramientas` y `/herramientas/:tool` | Privada |
| Centro de respuestas | `/respuestas` | Privada |
| Recursos | `/recursos` | Privada |
| Soporte | `/soporte` | Privada y dependiente del entitlement |
| Cuenta | `/academia/cuenta` | Privada |

Vercel reescribe las rutas privadas al handler `/api/academy?action=page`; el servidor verifica sesión y entitlement antes de devolver el shell.

## API privada

| Endpoint | Función |
|---|---|
| `POST /api/academy/auth/request` | Solicitar código y enlace de acceso |
| `POST /api/academy/auth/verify` | Verificar código de seis cifras |
| `GET /api/academy/session` | Resolver sesión y entitlement |
| `GET /api/academy/program` | Entregar programa privado autorizado |
| `GET/PUT /api/academy/state` | Leer o guardar progreso/operación |
| `POST /api/academy/logout` | Revocar la sesión actual |
| `GET /api/academy/resource?file=guide|workbook` | Servir recurso privado permitido |

## Navegación principal

1. Tu ruta de importación.
2. Continuar por donde lo dejaste.
3. Mi operación.
4. Candidatos.
5. Herramientas.
6. Resolver una duda.
7. Recursos.
8. Cuenta/salir.

En móvil, la navegación prioriza continuar, ruta, operación y búsqueda. La alternativa textual del mapa siempre debe indicar, por ejemplo, “Etapa 3 de 12: Leer el anuncio”.

## Modelo mental

- **Ruta:** programa completo.
- **Etapa:** gran bloque del proceso.
- **Paso:** lección concreta.
- **Operación:** expediente real del alumno.
- **Checkpoint:** validación práctica de una etapa.
- **Herramienta:** estado interactivo guardable.
- **Recurso:** archivo, plantilla, vídeo, glosario o fuente.

La Etapa 0 es prólogo y no cuenta en el porcentaje central. Las etapas 1 a 12 sí. No se exige completar una etapa para consultar otra.

## Búsqueda

El índice privado reúne 317 pasos, respuestas frecuentes, glosario y herramientas. Un resultado enlaza a la entidad concreta. Si no hay una respuesta sustentada, se muestra: “No quiero inventarte una respuesta para una operación real”, seguido de pasos relacionados y soporte.

No se envían a analítica VIN, email, nombre, teléfono, dirección, precio personal, documentos ni el texto íntegro de una consulta.
