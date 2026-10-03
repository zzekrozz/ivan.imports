import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LEGAL_ROUTES, renderLegalPage } from "./render-legal-pages.mjs";
export async function buildLegalPages(root) {
  for (const route of LEGAL_ROUTES) {
    await mkdir(join(root, route), { recursive: true });
    await writeFile(join(root, route, "index.html"), renderLegalPage(route), "utf8");
  }
}
