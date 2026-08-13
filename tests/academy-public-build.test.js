import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { publishAcademyPublic } from "../scripts/publish-academy-public.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicCatalogPath = resolve(root, "assets/academy/program-v2.json");
const privateCatalogPath = resolve(root, "private-products/academy/v2/dist/program-v2.json");

async function fixture({ publicCatalog = true, privateCatalog = false } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "ivan-academy-build-"));
  if (publicCatalog) {
    await mkdir(resolve(directory, "assets/academy"), { recursive: true });
    await cp(publicCatalogPath, resolve(directory, "assets/academy/program-v2.json"));
  }
  if (privateCatalog) {
    await mkdir(resolve(directory, "private-products/academy/v2/dist"), { recursive: true });
    await cp(privateCatalogPath, resolve(directory, "private-products/academy/v2/dist/program-v2.json"));
  }
  return directory;
}

test("un checkout limpio reutiliza y valida el catálogo público versionado", async (t) => {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = await publishAcademyPublic({ root: directory });
  assert.equal(result.mode, "reused");
  assert.deepEqual(
    [result.program.stages.length, result.program.lessons.length, result.program.concepts.length, result.program.tools.length],
    [13, 72, 317, 17],
  );
});

test("sin fuente editorial ni catálogo público el build falla claramente", async (t) => {
  const directory = await fixture({ publicCatalog: false });
  t.after(() => rm(directory, { recursive: true, force: true }));

  await assert.rejects(
    publishAcademyPublic({ root: directory }),
    /neither editorial source nor versioned public catalog is available/,
  );
});

test("una fuente editorial presente y corrupta falla sin reutilizar el público", async (t) => {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const privatePath = resolve(directory, "private-products/academy/v2/dist/program-v2.json");
  await mkdir(dirname(privatePath), { recursive: true });
  await writeFile(privatePath, "{\"schemaVersion\":2,\"stages\":[]}", "utf8");
  const before = await readFile(resolve(directory, "assets/academy/program-v2.json"), "utf8");

  await assert.rejects(publishAcademyPublic({ root: directory }), /catálogo fuente no conserva/);
  assert.equal(await readFile(resolve(directory, "assets/academy/program-v2.json"), "utf8"), before);
});

test("un catálogo público corrupto también bloquea el checkout limpio", async (t) => {
  const directory = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = resolve(directory, "assets/academy/program-v2.json");
  const catalog = JSON.parse(await readFile(path, "utf8"));
  catalog.lessons.pop();
  await writeFile(path, JSON.stringify(catalog), "utf8");

  await assert.rejects(publishAcademyPublic({ root: directory }), /lessons must contain 72 entries/);
});
