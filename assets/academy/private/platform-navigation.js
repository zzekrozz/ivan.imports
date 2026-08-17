export const PLATFORM_AREAS = Object.freeze([
  Object.freeze({ id: "home", label: "Inicio", path: "/", icon: "home", routeNames: [], sidebar: null, search: false }),
  Object.freeze({ id: "academy", label: "Academia", path: "/academia/", icon: "book", routeNames: ["dashboard", "stage", "lesson", "support", "account"], sidebar: "academy", search: true }),
  Object.freeze({ id: "tools", label: "Herramientas", path: "/herramientas/", icon: "tools", routeNames: ["tools", "tool"], sidebar: "tools", search: false }),
  Object.freeze({ id: "vehicles", label: "Mis vehículos", path: "/mis-vehiculos/", icon: "car", routeNames: ["vehicles", "vehicle", "candidates"], sidebar: "vehicles", search: false }),
  Object.freeze({ id: "resources", label: "Recursos", path: "/recursos/", icon: "route", routeNames: ["resources", "answers"], sidebar: "resources", search: false }),
]);

export const FUTURE_NAV_ITEM_DEFAULTS = Object.freeze({
  requiresPlan: null,
  locked: false,
  badge: null,
  comingSoon: false,
});

export function platformAreaForRoute(routeName) {
  return PLATFORM_AREAS.find((area) => area.routeNames.includes(routeName)) || PLATFORM_AREAS[1];
}

export function navigationItem(item) {
  return Object.freeze({ ...FUTURE_NAV_ITEM_DEFAULTS, ...item });
}
