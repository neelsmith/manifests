// Pure helpers for build.mjs (kept separate so they can be unit-tested without network or iiif-cite).
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

/** Prefixes under which this repo's own files are published on raw.githubusercontent.com. */
export const REPO_RAW_PREFIXES = [
  "https://raw.githubusercontent.com/neelsmith/manifests/refs/heads/main/",
  "https://raw.githubusercontent.com/neelsmith/manifests/main/",
];

/**
 * If `url` points at a file in this repo, return its repo-relative path; otherwise null.
 * @param {string} url
 * @returns {string | null}
 */
export function repoPathForUrl(url) {
  if (typeof url !== "string") return null;
  for (const p of REPO_RAW_PREFIXES) {
    if (url.startsWith(p)) {
      const rel = decodeURIComponent(url.slice(p.length).split(/[?#]/)[0]);
      return rel && !rel.split("/").includes("..") ? rel : null;
    }
  }
  return null;
}

/**
 * Check that every manifest/URN-map URL that points into this repo names a file that exists locally.
 * (A file that isn't committed and pushed yet would otherwise only fail in the browser.)
 * @param {{ collections?: Array<{ label?: string, manifest?: string, urns?: string | null }> }} config
 * @param {string} repoRoot
 * @returns {string[]} problems, empty if none
 */
export function checkLocalSources(config, repoRoot) {
  const problems = [];
  for (const c of config?.collections ?? []) {
    for (const key of ["manifest", "urns"]) {
      const url = c?.[key];
      if (!url) continue;
      const rel = repoPathForUrl(url);
      if (rel !== null && !existsSync(join(repoRoot, rel))) {
        problems.push(`collection "${c.label}": ${key} points to ${rel}, which does not exist in this repo`);
      }
    }
  }
  return problems;
}

/**
 * Project files to build: all *.json in `dir`, or only those named (with or without .json).
 * @param {string} dir
 * @param {string[]} [names]
 * @returns {{ files: string[], missing: string[] }} absolute paths, sorted; names not found
 */
export function selectProjects(dir, names = []) {
  const all = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json")).sort();
  if (!names.length) return { files: all.map((f) => join(dir, f)), missing: [] };
  const wanted = names.map((n) => basename(n).replace(/\.json$/i, "") + ".json");
  return {
    files: all.filter((f) => wanted.includes(f)).map((f) => join(dir, f)),
    missing: wanted.filter((w) => !all.includes(w)),
  };
}

/** Output file name for a project config path. @param {string} configPath */
export const outputName = (configPath) => basename(configPath).replace(/\.json$/i, "") + ".html";

/** All http(s) URLs a config references. @param {any} config @returns {string[]} */
export const configUrls = (config) =>
  (config?.collections ?? []).flatMap((c) => [c?.manifest, c?.urns]).filter((u) => typeof u === "string" && u);
