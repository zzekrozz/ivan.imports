import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../assets/control/app.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../assets/control/app.css", import.meta.url), "utf8");

test("Quick Add defaults new missions to an unscheduled state", () => {
  assert.match(appSource, /scheduledDate = data\.scheduled_date \|\| null/);
  assert.match(appSource, /form\.elements\.scheduled_date\.value = ""/);
  assert.doesNotMatch(appSource, /scheduled_date: data\.scheduled_date \|\| dateKey\(\)/);
  assert.match(appSource, /Misión guardada en Sin fecha/);
});

test("planning navigation exposes Projects and Unscheduled as first-class routes", () => {
  assert.match(appSource, /path === "\/control\/projects"/);
  assert.match(appSource, /path === "\/control\/unscheduled"/);
  assert.match(appSource, />Proyectos<\/span>/);
  assert.match(appSource, />Sin fecha<\/span>/);
});

test("Mission Control uses the calm light palette", () => {
  assert.match(cssSource, /color-scheme: light/);
  assert.match(cssSource, /--bg: #f6f8fb/);
  assert.match(cssSource, /--surface: #ffffff/);
  assert.match(cssSource, /--gold: #5b8def/);
  assert.doesNotMatch(cssSource, /--bg: #15140f/);
});
