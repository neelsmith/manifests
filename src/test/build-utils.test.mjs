import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLocalSources, configUrls, outputName, repoPathForUrl, selectProjects } from "../lib/build-utils.mjs";

const RAW = "https://raw.githubusercontent.com/neelsmith/manifests/refs/heads/main/";

test("repoPathForUrl maps this repo's raw URLs to repo paths", () => {
  assert.equal(repoPathForUrl(RAW + "manifests/a.json"), "manifests/a.json");
  assert.equal(repoPathForUrl("https://raw.githubusercontent.com/neelsmith/manifests/main/urnmaps/b.cex"), "urnmaps/b.cex");
  assert.equal(repoPathForUrl(RAW + "urnmaps/b%20c.cex?x=1"), "urnmaps/b c.cex");
});

test("repoPathForUrl ignores other hosts, other repos and path traversal", () => {
  assert.equal(repoPathForUrl("https://iiif.bodleian.ox.ac.uk/iiif/manifest/x.json"), null);
  assert.equal(repoPathForUrl("https://raw.githubusercontent.com/neelsmith/other/refs/heads/main/a.json"), null);
  assert.equal(repoPathForUrl(RAW + "../secret"), null);
  assert.equal(repoPathForUrl(undefined), null);
});

function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), "manifests-test-"));
  mkdirSync(join(root, "manifests")); mkdirSync(join(root, "urnmaps")); mkdirSync(join(root, "projects"));
  writeFileSync(join(root, "manifests", "m.json"), "{}");
  writeFileSync(join(root, "urnmaps", "u.cex"), "");
  return root;
}

test("checkLocalSources passes when referenced repo files exist, and ignores external URLs", () => {
  const root = fakeRepo();
  const config = { collections: [
    { label: "A", manifest: RAW + "manifests/m.json", urns: RAW + "urnmaps/u.cex" },
    { label: "B", manifest: "https://example.org/manifest.json" },
  ] };
  assert.deepEqual(checkLocalSources(config, root), []);
});

test("checkLocalSources reports missing manifest and URN map", () => {
  const root = fakeRepo();
  const problems = checkLocalSources({ collections: [
    { label: "A", manifest: RAW + "manifests/nope.json", urns: RAW + "urnmaps/nope.cex" },
  ] }, root);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /manifest points to manifests\/nope\.json/);
  assert.match(problems[1], /urns points to urnmaps\/nope\.cex/);
});

test("selectProjects lists all configs, or only named ones, and reports unknown names", () => {
  const root = fakeRepo();
  const dir = join(root, "projects");
  for (const f of ["b.json", "a.json", "notes.txt"]) writeFileSync(join(dir, f), "{}");
  assert.deepEqual(selectProjects(dir).files, [join(dir, "a.json"), join(dir, "b.json")]);
  assert.deepEqual(selectProjects(dir, ["b"]).files, [join(dir, "b.json")]);
  assert.deepEqual(selectProjects(dir, ["b.json", "zzz"]).missing, ["zzz.json"]);
});

test("outputName and configUrls", () => {
  assert.equal(outputName("/x/projects/herodotus.json"), "herodotus.html");
  assert.deepEqual(configUrls({ collections: [{ manifest: "m1", urns: "u1" }, { manifest: "m2", urns: null }] }), ["m1", "u1", "m2"]);
});
