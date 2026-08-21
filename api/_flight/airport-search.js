import { AIRPORT_ROWS } from "./airports-data.js";

const EARTH_RADIUS_KM = 6_371;

export function haversineDistanceKm(from, to) {
  const latitude1 = Number(from?.latitude);
  const longitude1 = Number(from?.longitude);
  const latitude2 = Number(to?.latitude);
  const longitude2 = Number(to?.longitude);
  if (![latitude1, longitude1, latitude2, longitude2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function airportRowsToRecords(rows = AIRPORT_ROWS) {
  const airports = [];
  for (let index = 0; index + 7 < rows.length; index += 8) {
    const [name, iata, city, country, latitude, longitude, type, scheduledService] = rows.slice(index, index + 8);
    airports.push({ name, iata, city, country, latitude, longitude, type, scheduledService });
  }
  return airports;
}

export function isCommercialPassengerAirport(airport) {
  return /^[A-Z]{3}$/.test(String(airport?.iata || ""))
    && airport?.scheduledService === "yes"
    && ["medium_airport", "large_airport"].includes(airport?.type)
    && Number.isFinite(Number(airport?.latitude))
    && Number.isFinite(Number(airport?.longitude));
}

export function findNearbyAirports(location, {
  airports = airportRowsToRecords(),
  limit = 3,
  maximumDistanceKm = 300,
} = {}) {
  return airports
    .filter(isCommercialPassengerAirport)
    .map((airport) => ({
      name: String(airport.name),
      iata: String(airport.iata).toUpperCase(),
      city: String(airport.city || ""),
      country: String(airport.country || ""),
      latitude: Number(airport.latitude),
      longitude: Number(airport.longitude),
      distanceKm: haversineDistanceKm(location, airport),
    }))
    .filter((airport) => Number.isFinite(airport.distanceKm) && airport.distanceKm <= maximumDistanceKm)
    .sort((left, right) => left.distanceKm - right.distanceKm || left.iata.localeCompare(right.iata))
    .slice(0, Math.max(1, Math.min(10, Number(limit) || 3)))
    .map((airport) => ({ ...airport, distanceKm: Math.round(airport.distanceKm) }));
}
