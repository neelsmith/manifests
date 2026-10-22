#!/usr/bin/env node
// Build a single-page iiif-cite app for each project config in ../projects into ./dist.
//
//   npm run build                         all projects
//   npm run build -- herodotus            only projects/herodotus.json
//   npm run build -- --check-remote       also check that every manifest/URN-map URL responds
//   npm run build -- --refresh            re-download and rebuild iiif-cite
//
// iiif-cite (https://github.com/neelsmith/iiif-cite) is fetched at the pinned tag below into
// .cache/, built once with its own `npm ci && npm run build`, and reused on later runs.
// Set IIIF_CITE_DIR to use an existing local checkout of iiif-cite instead.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkLocalSources, configUrls, outputName, selectProjects } from "./lib/build-utils.mjs";

export const IIIF_CITE_TAG = "v0.2.0";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const PROJECTS = join(REPO, "projects");
const DIST = join(HERE, "dist");

const log = (...a) => console.log(...a);
const fail = (msg) => { console.error(`error: ${msg}`); process.exit(1); };

function run(cmd, args, cwd) {
  log(`  $ ${cmd} ${args.join(" ")}   (in ${relative(REPO, cwd) || "."})`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.error) fail(`could not run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} exited with status ${r.status}`);
}

/** Make sure a built iiif-cite exists; return the path to its `src` directory. */
function ensureIiifCite(refresh) {
  const override = process.env.IIIF_CITE_DIR;
  const root = override ? resolve(override) : join(HERE, ".cache", `iiif-cite-${IIIF_CITE_TAG}`);
  const src = join(root, "src");
  const stamp = join(root, ".built");
  const built = join(src, "dist", "iiif-cite.html");

  if (!override && (refresh || !existsSync(stamp)) && existsSync(root)) rmSync(root, { recursive: true, force: true });

  if (!override && !existsSync(root)) {
    log(`Fetching iiif-cite ${IIIF_CITE_TAG} ...`);
    const tmp = `${root}.partial`;
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const url = `https://codeload.github.com/neelsmith/iiif-cite/tar.gz/refs/tags/${IIIF_CITE_TAG}`;
    const dl = mkdtempSync(join(tmpdir(), "iiif-cite-"));
    const archive = join(dl, "src.tar.gz");
    try {
      run("curl", ["-fsSL", "-o", archive, url], HERE);
      run("tar", ["-xzf", archive, "-C", tmp, "--strip-components=1"], HERE);
    } finally { rmSync(dl, { recursive: true, force: true }); }
    renameSync(tmp, root);
  }
  if (!existsSync(join(src, "scripts", "package.mjs"))) fail(`${src} does not look like an iiif-cite checkout`);

  if (refresh || !existsSync(built) || (!override && !existsSync(stamp))) {
    log(`Building iiif-cite ...`);
    run("npm", ["ci", "--no-audit", "--no-fund"], src);
    run("npm", ["run", "build"], src);
    if (!existsSync(built)) fail(`iiif-cite build did not produce ${built}`);
    if (!override) writeFileSync(stamp, `${IIIF_CITE_TAG}\n`);
  }
  return src;
}

/** Check each URL responds (via curl, so proxy settings are honoured); return problems. */
function checkRemote(urls) {
  const problems = [];
  for (const u of new Set(urls)) {
    const r = spawnSync("curl", ["-sL", "-o", "/dev/null", "-r", "0-0", "-w", "%{http_code}", "--max-time", "30", u], { encoding: "utf8" });
    const code = Number(r.stdout);
    if (r.status !== 0) problems.push(`${u} → unreachable (curl exit ${r.status})`);
    else if (!(code >= 200 && code < 300)) problems.push(`${u} → HTTP ${code}`);
  }
  return problems;
}

async function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const names = argv.filter((a) => !a.startsWith("--"));
  for (const f of flags) if (!["--check-remote", "--refresh"].includes(f)) fail(`unknown option ${f}`);

  const { files, missing } = selectProjects(PROJECTS, names);
  if (missing.length) fail(`no such project(s) in projects/: ${missing.join(", ")}`);
  if (!files.length) fail("no project configs found in projects/");

  const src = ensureIiifCite(flags.has("--refresh"));
  const { packageHtml } = await import(pathToFileURL(join(src, "scripts", "package.mjs")).href);
  const { validateConfig } = await import(pathToFileURL(join(src, "lib", "project-config.mjs")).href);
  const template = readFileSync(join(src, "dist", "iiif-cite.html"), "utf8");

  mkdirSync(DIST, { recursive: true });
  let failed = 0;
  log(`\nPackaging ${files.length} project(s) with iiif-cite ${process.env.IIIF_CITE_DIR ? "(local)" : IIIF_CITE_TAG}:`);
  for (const file of files) {
    const name = relative(REPO, file);
    const problems = [];
    let config;
    try { config = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { problems.push(`not valid JSON: ${e.message}`); }
    if (config) {
      problems.push(...validateConfig(config).errors);
      problems.push(...checkLocalSources(config, REPO));
      if (flags.has("--check-remote")) problems.push(...checkRemote(configUrls(config)));
    }
    if (problems.length) {
      failed++;
      console.error(`  ✗ ${name}\n      - ${problems.join("\n      - ")}`);
      continue;
    }
    const out = join(DIST, outputName(file));
    const html = packageHtml(template, config);
    writeFileSync(out, html);
    log(`  ✓ ${name} → ${relative(REPO, out)} (${Math.round(html.length / 1024)} kB, ${config.collections.length} collection(s))`);
  }
  if (failed) { console.error(`\n${failed} of ${files.length} project(s) failed.`); process.exit(1); }
  log(`\nDone.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((e) => fail(e.stack ?? String(e)));
}
