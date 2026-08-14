import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv.find((value) => value.startsWith("--port="))?.split("=")[1] || 4173);
const types = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".xml": "application/xml; charset=utf-8" };

createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  let target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
  if ((!existsSync(target) || !statSync(target).isFile()) && pathname.startsWith("/academia/")) target = join(root, "academia", "index.html");
  const missing = !existsSync(target) || !statSync(target).isFile();
  if (missing) target = join(root, "404.html");
  if (!existsSync(target) || !statSync(target).isFile()) { response.writeHead(404).end("Not found"); return; }
  response.writeHead(missing ? 404 : 200, { "Content-Type": types[extname(target).toLowerCase()] || "application/octet-stream" });
  createReadStream(target).pipe(response);
}).listen(port, "0.0.0.0", () => console.log(`Static QA: http://127.0.0.1:${port}`));
