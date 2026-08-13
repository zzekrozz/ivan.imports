const BLOB_ENVIRONMENTS = Object.freeze({
  preview: Object.freeze({
    prefix: "academy/preview/",
    storeVariable: "ACADEMY_PREVIEW_BLOB_STORE_ID",
    fallbackTokenVariable: "ACADEMY_PREVIEW_BLOB_READ_WRITE_TOKEN",
  }),
  production: Object.freeze({
    prefix: "academy/production/",
    storeVariable: "ACADEMY_PRODUCTION_BLOB_STORE_ID",
    fallbackTokenVariable: "ACADEMY_PRODUCTION_BLOB_READ_WRITE_TOKEN",
  }),
});

export function academyBlobEnvironment(env = process.env) {
  const name = String(env.VERCEL_ENV || "").trim().toLowerCase();
  return Object.hasOwn(BLOB_ENVIRONMENTS, name) ? name : "";
}

export function academyBlobAccessFromEnv(env = process.env, { required = false } = {}) {
  const environment = academyBlobEnvironment(env);
  if (!environment) {
    if (required) throw new Error("Academy Blob writes require VERCEL_ENV=preview or production");
    return {
      blobEnvironment: "",
      blobPrefix: "",
      blobStoreId: "",
      blobOidcToken: "",
      blobAutomaticOidc: false,
      blobToken: "",
      blobAuthMode: "",
    };
  }

  const definition = BLOB_ENVIRONMENTS[environment];
  const blobStoreId = String(env[definition.storeVariable] || "").trim();
  const blobOidcToken = String(env.VERCEL_OIDC_TOKEN || "").trim();
  const blobAutomaticOidc = String(env.VERCEL || "").trim() === "1";
  const staticFallbackAllowed = String(env.ACADEMY_BLOB_ALLOW_STATIC_TOKEN_FALLBACK || "").trim().toLowerCase() === "true";
  const blobToken = staticFallbackAllowed ? String(env[definition.fallbackTokenVariable] || "").trim() : "";

  if (required && !blobStoreId) throw new Error(`Academy Blob ${environment} store ID is not configured`);
  if (required && !blobOidcToken && !blobAutomaticOidc && !blobToken) {
    throw new Error(`Academy Blob ${environment} authentication is not configured`);
  }

  const otherEnvironment = environment === "preview" ? "production" : "preview";
  const otherStoreId = String(env[BLOB_ENVIRONMENTS[otherEnvironment].storeVariable] || "").trim();
  if (blobStoreId && otherStoreId && blobStoreId === otherStoreId) {
    throw new Error("Academy Blob Preview and Production stores must be distinct");
  }

  return {
    blobEnvironment: environment,
    blobPrefix: definition.prefix,
    blobStoreId,
    blobOidcToken,
    blobAutomaticOidc,
    blobToken: blobOidcToken ? "" : blobToken,
    blobAuthMode: blobOidcToken || blobAutomaticOidc ? "oidc" : blobToken ? "static-token-fallback" : "",
  };
}

export function assertAcademyBlobPath(pathname, blobEnvironment) {
  const value = String(pathname || "").trim().replace(/^\/+/, "");
  const definition = BLOB_ENVIRONMENTS[blobEnvironment];
  if (!definition) throw new Error("Academy Blob environment is not selected");
  if (!value.startsWith(definition.prefix)) {
    throw new Error(`Academy Blob pathname does not belong to ${blobEnvironment}`);
  }
  return value;
}

export function academyPrivateBlobOptions(config, pathname, extra = {}) {
  const isolatedPathname = assertAcademyBlobPath(pathname, config?.blobEnvironment);
  if (!config?.blobStoreId) {
    throw new Error(`Academy Blob ${config?.blobEnvironment || "environment"} store ID is not configured`);
  }
  const authentication = config.blobOidcToken
    ? { oidcToken: config.blobOidcToken }
    : config.blobToken
      ? { token: config.blobToken }
      : null;
  if (!authentication && !config.blobAutomaticOidc) {
    throw new Error(`Academy Blob ${config?.blobEnvironment || "environment"} authentication is not configured`);
  }
  return {
    ...extra,
    access: "private",
    storeId: config.blobStoreId,
    ...(authentication || {}),
    pathname: isolatedPathname,
  };
}

export function academyBlobSdkOptions(selectedOptions) {
  const { pathname: _pathname, ...sdkOptions } = selectedOptions;
  return sdkOptions;
}
