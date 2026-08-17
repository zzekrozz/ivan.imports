import { mobileDeProvider } from "./mobile-de.js";

export const vehicleProviders = Object.freeze([mobileDeProvider]);

export function providerForUrl(url) {
  return vehicleProviders.find((provider) => provider.canHandle(url)) || null;
}
