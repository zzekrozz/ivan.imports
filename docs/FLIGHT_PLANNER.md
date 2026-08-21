# Planificador de vuelos V1

La calculadora mantiene `Vuelo` como un importe manual. El planificador que aparece debajo solo convierte una localidad en aeropuertos comerciales cercanos y abre Skyscanner; nunca consulta ni introduce precios.

## Geocodificación

El endpoint server-side `api/flight-planner.js` usa por defecto la búsqueda pública de [Nominatim](https://nominatim.org/) sobre datos de OpenStreetMap. La búsqueda se ejecuta únicamente al enviar el formulario: no hay autocomplete remoto ni llamadas por pulsación.

La implementación cumple la política del servicio público para un volumen inicial moderado:

- proxy server-side e identificación mediante `User-Agent`;
- máximo de una petición externa por segundo dentro de cada instancia;
- caché en memoria durante 7 días (máximo 200 búsquedas);
- rate limit por IP de 8 búsquedas por minuto;
- atribución visible a OpenStreetMap;
- proveedor intercambiable mediante `NOMINATIM_BASE_URL`.

Nominatim público no ofrece SLA y limita el conjunto de la aplicación a 1 petición por segundo. Antes de un volumen sostenido debe configurarse una instancia propia o un proveedor Nominatim compatible. El estado de búsqueda y la localidad no se guardan en `localStorage`.

Variables opcionales:

- `NOMINATIM_BASE_URL`: endpoint HTTPS compatible con Nominatim. Por defecto `https://nominatim.openstreetmap.org`.
- `NOMINATIM_CONTACT_EMAIL`: contacto incluido en la petición y en el identificador de la aplicación. Recomendado al usar el servicio público.

## Aeropuertos

`api/_flight/airports-data.js` es un snapshot local generado de `airports.csv` y `countries.csv` de [OurAirports](https://ourairports.com/data/), publicados en el dominio público. Snapshot de origen: 12 de agosto de 2026; generación: 21 de agosto de 2026.

Solo se incluyen aeropuertos europeos que en el dataset:

- tienen código IATA de tres letras;
- declaran `scheduled_service=yes`;
- son de tipo `medium_airport` o `large_airport`.

Se calcula Haversine, se ordena por distancia y se devuelven los tres más cercanos dentro de 300 km. No se filtra por país, de modo que Aachen, Liège o Maastricht pueden devolver candidatos a ambos lados de una frontera. La distancia es geográfica, no por carretera.

Para actualizar el snapshot, se vuelven a descargar ambos CSV y se regenera el array plano de ocho campos conservando el filtro anterior. No se necesita una dependencia en tiempo de ejecución.

## Skyscanner

`api/_flight/skyscanner.js` encapsula `buildFlightSearchUrl`. Usa la [Affiliates Link API oficial de Skyscanner](https://developers.skyscanner.net/docs/referrals/quick-start-guide):

- con fecha: `flights/day-view`;
- sin fecha: `flights/calendar-month-view`;
- mercado `ES`, locale `es-ES`, moneda `EUR`, un adulto y clase económica.

La API oficial exige un identificador de partner de Impact:

- `SKYSCANNER_MEDIA_PARTNER_ID`: ID público `mediaPartnerId` asignado al aprobar la cuenta de afiliado.

Cuando no está configurado, la abstracción abre `https://www.skyscanner.es/` sin preseleccionar ruta ni fecha. Es una degradación intencionada: no se construyen URLs internas no documentadas, no se hace scraping y no se usan endpoints privados. Al obtener el ID no hay que cambiar la UI; basta con añadir la variable de entorno.

## Privacidad, seguridad y límites

- El navegador solo envía el texto de localidad al endpoint propio.
- Las coordenadas proceden del geocoder; el cliente no puede indicar una URL ni un host externo.
- Los redirects solo aceptan dos IATA validados y una fecha ISO opcional, y siempre terminan en un host de Skyscanner construido por servidor.
- Un fallo del geocoder no altera la partida manual ni el total de la calculadora.
- La selección de origen incluye aeropuertos españoles habituales y acepta cualquier código IATA válido, para poder ampliar el catálogo sin acoplar la lógica a Málaga.

Los eventos existentes de Google Tag Manager son `flight_planner_opened`, `vehicle_location_searched`, `nearby_airports_loaded` y `skyscanner_search_clicked`. No registran el texto de la localidad.
