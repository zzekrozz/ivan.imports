import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  academyBlobAccessFromEnv,
  academyBlobSdkOptions,
  academyPrivateBlobOptions,
  assertAcademyBlobPath,
} from "../api/_academy/blob.js";
import { privateProgram } from "../api/_academy/content.js";

const previewEnv = Object.freeze({
  VERCEL_ENV: "preview",
  VERCEL_OIDC_TOKEN: "opaque-oidc-preview-test-value",
  ACADEMY_PREVIEW_BLOB_STORE_ID: "store-preview",
  ACADEMY_PRODUCTION_BLOB_STORE_ID: "store-production",
  ACADEMY_PREVIEW_BLOB_READ_WRITE_TOKEN: "opaque-static-preview-test-value",
  BLOB_STORE_ID: "generic-store-must-not-be-used",
  BLOB_READ_WRITE_TOKEN: "generic-token-must-not-be-used",
});

test("Blob Preview selecciona exclusivamente store Preview y OIDC", () => {
  const access = academyBlobAccessFromEnv(previewEnv, { required: true });
  assert.deepEqual(access, {
    blobEnvironment: "preview",
    blobPrefix: "academy/preview/",
    blobStoreId: "store-preview",
    blobOidcToken: "opaque-oidc-preview-test-value",
    blobAutomaticOidc: false,
    blobToken: "",
    blobAuthMode: "oidc",
  });
  const options = academyPrivateBlobOptions(access, "academy/preview/program-v2.json");
  assert.equal(options.storeId, "store-preview");
  assert.equal(options.oidcToken, "opaque-oidc-preview-test-value");
  assert.equal(Object.hasOwn(options, "token"), false);
});

test("Blob Production selecciona exclusivamente store Production y OIDC", () => {
  const access = academyBlobAccessFromEnv({ ...previewEnv, VERCEL_ENV: "production" }, { required: true });
  assert.equal(access.blobEnvironment, "production");
  assert.equal(access.blobStoreId, "store-production");
  assert.equal(access.blobAuthMode, "oidc");
});

test("Preview y Production rechazan pathnames del otro entorno", () => {
  assert.throws(() => assertAcademyBlobPath("academy/production/program-v2.json", "preview"), /does not belong to preview/);
  assert.throws(() => assertAcademyBlobPath("academy/preview/program-v2.json", "production"), /does not belong to production/);
});

test("falta storeId y falla antes de crear opciones de escritura", () => {
  assert.throws(
    () => academyBlobAccessFromEnv({ VERCEL_ENV: "preview", VERCEL_OIDC_TOKEN: "opaque" }, { required: true }),
    /preview store ID is not configured/,
  );
});

test("falta OIDC y no hay fallback autorizado", () => {
  assert.throws(
    () => academyBlobAccessFromEnv({
      VERCEL_ENV: "preview",
      ACADEMY_PREVIEW_BLOB_STORE_ID: "store-preview",
      ACADEMY_PREVIEW_BLOB_READ_WRITE_TOKEN: "opaque-static-value",
    }, { required: true }),
    /preview authentication is not configured/,
  );
});

test("una Function de Vercel delega al SDK la obtención OIDC del request context", () => {
  const access = academyBlobAccessFromEnv({
    VERCEL: "1",
    VERCEL_ENV: "preview",
    ACADEMY_PREVIEW_BLOB_STORE_ID: "store-preview",
  }, { required: true });
  const options = academyPrivateBlobOptions(access, "academy/preview/program-v2.json");
  assert.equal(access.blobAuthMode, "oidc");
  assert.equal(options.storeId, "store-preview");
  assert.equal(Object.hasOwn(options, "oidcToken"), false);
  assert.equal(Object.hasOwn(options, "token"), false);
});

test("el token estático solo funciona como fallback explícitamente autorizado", () => {
  const access = academyBlobAccessFromEnv({
    VERCEL_ENV: "preview",
    ACADEMY_PREVIEW_BLOB_STORE_ID: "store-preview",
    ACADEMY_PREVIEW_BLOB_READ_WRITE_TOKEN: "opaque-static-value",
    ACADEMY_BLOB_ALLOW_STATIC_TOKEN_FALLBACK: "true",
  }, { required: true });
  assert.equal(access.blobAuthMode, "static-token-fallback");
  const options = academyPrivateBlobOptions(access, "academy/preview/program-v2.json");
  assert.equal(options.token, "opaque-static-value");
  assert.equal(Object.hasOwn(options, "oidcToken"), false);
});

test("OIDC tiene prioridad y nunca se envía junto al fallback estático", () => {
  const access = academyBlobAccessFromEnv({
    ...previewEnv,
    ACADEMY_BLOB_ALLOW_STATIC_TOKEN_FALLBACK: "true",
  }, { required: true });
  const options = academyPrivateBlobOptions(access, "academy/preview/program-v2.json");
  assert.equal(options.oidcToken, previewEnv.VERCEL_OIDC_TOKEN);
  assert.equal(Object.hasOwn(options, "token"), false);
});

test("las credenciales son opacas y el código no intenta interpretar su formato", async () => {
  const source = await readFile(new URL("../api/_academy/blob.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /split\s*\(/);
  assert.doesNotMatch(source, /atob\s*\(/);
  assert.doesNotMatch(source, /Buffer\.from\s*\(/);
  assert.doesNotMatch(source, /parseStoreId|token does not belong/i);
});

test("OIDC y tokens estáticos nunca se imprimen", () => {
  const output = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values) => output.push(values.join(" "));
  console.error = (...values) => output.push(values.join(" "));
  try {
    const access = academyBlobAccessFromEnv(previewEnv, { required: true });
    academyPrivateBlobOptions(access, "academy/preview/program-v2.json");
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  const rendered = output.join("\n");
  assert.doesNotMatch(rendered, /opaque-oidc-preview-test-value|opaque-static-preview-test-value/);
});

test("get() recibe OIDC y store seleccionados", async () => {
  const config = {
    ...academyBlobAccessFromEnv(previewEnv, { required: true }),
    contentBlobPathname: "academy/preview/program-v2.json",
    vercelEnv: "preview",
  };
  const program = { id: "importa-tu-primer-coche", title: "Programa privado", stages: [], lessons: [], tools: [], resources: [], glossary: [] };
  let call;
  const loaded = await privateProgram({
    config,
    blobGet: async (pathname, options) => {
      call = { pathname, options };
      return { statusCode: 200, stream: new Blob([JSON.stringify(program)]).stream() };
    },
  });
  assert.equal(loaded.id, program.id);
  assert.deepEqual(call, {
    pathname: "academy/preview/program-v2.json",
    options: { access: "private", storeId: "store-preview", oidcToken: "opaque-oidc-preview-test-value" },
  });
});

test("put() recibe OIDC y store seleccionados", async () => {
  const access = academyBlobAccessFromEnv(previewEnv, { required: true });
  const selected = academyPrivateBlobOptions(access, "academy/preview/program-v2.json", { allowOverwrite: true });
  let call;
  const blobPut = async (pathname, body, options) => {
    call = { pathname, body, options };
    return { pathname };
  };
  await blobPut(selected.pathname, "{}", academyBlobSdkOptions(selected));
  assert.deepEqual(call, {
    pathname: "academy/preview/program-v2.json",
    body: "{}",
    options: { allowOverwrite: true, access: "private", storeId: "store-preview", oidcToken: "opaque-oidc-preview-test-value" },
  });
});
