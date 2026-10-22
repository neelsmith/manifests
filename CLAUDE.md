`manifests` project

## Overview

This repo collects a number of openly published IIIF manifests and pairs them with URN maps so build image collections citable by CITE2 URN.


## Functionality

The project should include a build process that automates constructing single-page web apps from the configuration data in `projects` using the  `package` command from the npm tools in https://github.com/neelsmith/iiif-cite

## Architecture & Directory Structure

- `quarto`, `docs`, `README.md` and `releases.md` are all user-readable content owned by me; Claude should not touch them.
- `manifests` and `urnmaps` contain the data files I manually maintain; Claude should not touch those.
- `projects` contains JSON configuration files to build image viewer and citation tools using my `iiif-cite` package (https://github.com/neelsmith/iiif-cite)
- `notes` is for documentation and notes that Claude writes, includes session summaries so I can reliably pick up working with Claude from different machines
- `src` is for source code



## Testing Guidelines

- Write unit tests for utility functions and integration/component tests for critical UI flows.
- Run relevant tests before proposing significant refactors.