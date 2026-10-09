import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderRevenderLanding } from "./render-revender-landing.mjs";

export async function buildRevenderLanding(root = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
  const directory = join(root, "como-encontrar-coches-para-revender");
  await mkdir(directory, { recursive: true });
  // Copia byte a byte los assets definitivos a las rutas públicas de la referencia, incluidas OG y favicons.
  await cp(join(root, "docs/landing-final/assets"), join(root, "assets"), { recursive: true });
  await writeFile(join(directory, "index.html"), renderRevenderLanding(), "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildRevenderLanding();
