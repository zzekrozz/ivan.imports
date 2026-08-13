# Design system

## Dirección visual

Centro de operaciones europeo claro: superficies blancas, azul profundo, azul de acción y ruta turquesa. La profundidad procede de bordes, sombras y capas; no de neón, negro/dorado o movimiento continuo.

## Tokens actuales

| Token | Valor | Uso |
|---|---|---|
| `--academy-bg` | `#f5f9fe` | Fondo general |
| `--academy-surface` | `#fff` | Tarjetas y paneles |
| `--academy-ink` | `#091a33` | Texto principal |
| `--academy-muted` | `#5e6f86` | Texto secundario |
| `--academy-primary` | `#1167e8` | Acción y etapa actual |
| `--academy-primary-deep` | `#0754c8` | Estados activos/hover |
| `--academy-navy` | `#0b274a` | Navegación y contraste |
| `--academy-cyan` | `#16c4d8` | Ruta y señalización |
| `--academy-teal` | `#13b9b1` | Progreso |
| `--academy-success` | `#20a870` | Completado |
| `--academy-amber` | `#e9a91d` | Pendiente/atención |
| `--academy-coral` | `#d94f62` | Error/riesgo |

Radios: 12/18/24 px. Sombras: pequeña para control, media para tarjeta, grande solo para modal o foco principal. Ancho máximo: 1480 px. Sidebar de escritorio: 252 px.

## Tipografía

Inter con fallback de sistema. Títulos cortos, peso alto y anchura controlada; párrafos con `line-height` cercano a 1.55. No se usa tamaño inferior a 16 px en contenido de lección. Números y estados deben conservar legibilidad en tablas estrechas.

## Estados de etapa

- Actual: azul + etiqueta textual “Etapa actual”.
- Completada: turquesa/verde + icono y texto.
- Disponible: superficie blanca con borde.
- Próxima: gris azulado, sin aparentar bloqueo irreversible.
- Riesgo o revisión: coral/ámbar con icono y mensaje, nunca solo color.

## Bloques pedagógicos

Cada bloque muestra tipo, título y contenido. `oficial` debe incorporar fuente/fecha; `experiencia` identifica a Iván; `calculo` indica que es orientativo; `error` explica el riesgo; `accion` termina en una conducta registrable.

## Responsive

- 360-430 px: una columna, navegación móvil, acciones primarias visibles y tablas con alternativa apilada.
- 768 px: dos columnas cuando el contenido lo permite.
- 1024 px: sidebar compacta o navegación adaptable.
- 1366 px o más: sidebar fija y contenido centrado.

No debe existir scroll horizontal de página. Los nodos del mapa necesitan alternativa de lista y objetivos táctiles mínimos de 44 × 44 px.

## Movimiento y accesibilidad

Duraciones entre 160 y 500 ms; entrada inicial inferior a 700 ms. Se permite progreso, halo suave o vehículo que avanza al cambiar de etapa. `prefers-reduced-motion` desactiva desplazamientos no esenciales. Focus visible de alto contraste, skip link, jerarquía de encabezados y diálogos con cierre por Escape y retorno de foco.
