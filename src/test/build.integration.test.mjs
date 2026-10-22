// End-to-end: runs build.mjs for every project and checks the packaged pages.
// Needs a built iiif-cite (run `npm run build` once first); skipped otherwise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IIIF_CITE_TAG } from "../build.mjs";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const iiifRoot = process.env.IIIF_CITE_DIR ?? join(SRC, ".cache", `iiif-cite-${IIIF_CITE_TAG}`);
const ready = existsSync(join(iiifRoot, "src", "dist", "iiif-cite.html"));
const projects = readdirSync(join(SRC, "..", "projects")).filter((f) => f.endsWith(".json"));

test("every project packages into a self-contained page with its config and title", { skip: !ready && "iiif-cite not built yet: run `npm run build` once" }, () => {
  const r = spawnSync(process.execPath, [join(SRC, "build.mjs")], { cwd: SRC, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of projects) {
    const config = JSON.parse(readFileSync(join(SRC, "..", "projects", f), "utf8"));
    const html = readFileSync(join(SRC, "dist", f.replace(/\.json$/, ".html")), "utf8");
    assert.ok(html.includes(`<title>${config.title.trim()}</title>`), `${f}: page title`);
    const block = html.match(/<script type="application\/json" id="iiif-cite-config">([\s\S]*?)<\/script>/);
    assert.ok(block, `${f}: config block`);
    assert.deepEqual(JSON.parse(block[1].replace(/<\\\//g, "</")), config, `${f}: embedded config`);
    assert.ok(!/<script[^>]+src=/.test(html), `${f}: no external scripts`);
  }
});

test("an unknown project name fails cleanly", () => {
  const r = spawnSync(process.execPath, [join(SRC, "build.mjs"), "no-such-project"], { cwd: SRC, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no such project/);
});
