# Building the viewer apps

The build turns each `projects/*.json` config into a self-contained, single-page
[iiif-cite](https://github.com/neelsmith/iiif-cite) app in `src/dist/<project>.html`.

## Usage

Requires Node 20+, npm, `curl` and `tar`. Run from `src/`:

```
npm run build                    # every project in ../projects
npm run build -- herodotus       # just projects/herodotus.json (several names allowed)
npm run build:check              # also confirm every manifest / URN-map URL responds
npm run build -- --refresh       # re-download and rebuild iiif-cite
npm test                         # unit tests + end-to-end packaging test
```

The first run downloads iiif-cite at the tag pinned in `src/build.mjs` (`IIIF_CITE_TAG`, now
`v0.2.0`) into `src/.cache/`, and runs its `npm ci && npm run build`. Later runs reuse
that build, so they take well under a second. To use a newer iiif-cite, change the tag; it
builds into a new cache folder. To use a local checkout of iiif-cite you're working on, set
`IIIF_CITE_DIR=/path/to/iiif-cite`.

## What a build checks for each project

1. The file is valid JSON and passes iiif-cite's own `validateConfig` (title, unique labels,
   http(s) URLs, `default` naming a real collection label, no unknown keys).
2. Every manifest / URN-map URL that points into this repo
   (`raw.githubusercontent.com/neelsmith/manifests/...`) names a file that exists locally.
3. With `--check-remote`: every URL actually responds over HTTP (catches files not pushed yet).

A failing project is reported and skipped; the others still build, and the command exits 1.

## Files

- `src/build.mjs`: build driver (fetch/build iiif-cite, validate, package)
- `src/lib/build-utils.mjs`: pure helpers (URL→repo path, local checks, project selection)
- `src/test/`: `node:test` tests (no dependencies to install)
- `src/.gitignore`: ignores `.cache/`, `node_modules/`, `dist/`

Packaging calls iiif-cite's exported `packageHtml()` from `scripts/package.mjs`, so the output
is identical to running its `npm run package -- <config> -o <out>`.
