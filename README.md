# ACS Constellation

The marketing site for **ACS (Agent Custom Setup)** — the operating system for
autonomous software studios. Live at **<https://acs.design-bakery.com>**.

The site sells one idea: agents coordinate your work autonomously across any devices,
teams and projects, while the human keeps every decision.

## Three surfaces, one content model

Every route renders the same authored content graph:

| Surface | Route | What it is |
|---|---|---|
| Marketing front page | `/` | The sales page — hero with the live constellation, problem/answer blocks, per-component research with charts. |
| The universe | `/map` | The explorable three.js surface: grouped constellations, zoom/rotate/pan, select a node for detail. |
| PRD deep-dive | `/prd` | The technical deep-dive for engineers evaluating the stack — the same problem graph as prose, with citations. |

A node in the graph is a **problem**, not a repository. Each one carries the human
consequence it answers, the component that answers it, and evidence pointing at the
exact file and commit revision.

## Content is the source of truth

`content/` holds the whole site's prose and data. Nothing user-facing is written in
`src/` — the build fails if it is.

```
content/
  problems.json   17 problem nodes + their evidence citations
  graph.json      the layer table and edges between components
  copy.json        every marketing sentence, by slot (~220 slots)
  research.json   per-component figures and charts
  sources.md      the harvested sources
```

Components read copy through slots, so changing the site's words means editing
`content/copy.json` — never a component.

## Build gates

`pnpm build` runs four gates before Vite, and each one fails the build rather than
warning:

- **`check-copy`** — rejects prose-shaped string literals in `src/`, copy slots that
  don't exist in `content/copy.json`, and banned words.
- **`check-content-lock`** — digests each content bundle and compares against the
  recorded value, so harvested evidence can't drift unnoticed.
- **`check-tap-targets`** — enforces minimum touch target sizes.
- **`check-sky-behaviour`** — guards the constellation scene's interaction contract.

Gate results are written to `.gate-report.jsonl` and uploaded as a CI artifact.

## Local development

Node 24 and pnpm 10.32.1 (the versions CI and the Docker image use):

```bash
pnpm install --frozen-lockfile
pnpm dev          # http://localhost:8080
```

```bash
pnpm lint
pnpm typecheck
pnpm build        # gates + production bundle
```

## Deployment

The site runs on the Mac as the Docker container **`acs-web`** (Caddy serving the
built bundle), attached to the `study-os_edge` network. The container name and that
network attachment are load-bearing — the Cloudflare tunnel reaches the container by
name.

Deploys are **pull-based**, because the Mac isn't publicly reachable: the launchd
agent `com.acs.autodeploy` polls `origin/main` every 300 seconds and runs
`deploy/gravebuster/autodeploy.sh`. That script delegates to `deploy.sh`, which
builds a tagged image, swaps the container, smoke-tests it, and rolls back to the
previous image if anything fails. A commit that failed its smoke test is recorded as
`FAILED_SHA` and is not retried until a new commit lands.

Manual deploy, on the Mac:

```bash
cd ~/apps/acs-constellation
deploy/gravebuster/deploy.sh                    # origin/main
deploy/gravebuster/deploy.sh --ref <sha>        # a specific commit
deploy/gravebuster/deploy.sh --list             # local image tags
deploy/gravebuster/rollback.sh                  # return to the previous image
```

Build the image directly:

```bash
docker build -f deploy/gravebuster/Dockerfile -t acs-web:local .
```

### Tunnel routing

Two machines each run a cloudflared tunnel that could answer for this hostname, and
both have a container named `acs-web`. **Which build is live is decided by the DNS
CNAME**, so a 200 response proves nothing about freshness.

Before blaming a deploy, compare the `/assets/*.js` hash in the live HTML against the
container's own:

```bash
curl -sS https://acs.design-bakery.com/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
ssh mac-ts 'curl -sS http://127.0.0.1:8097/ | grep -oE "index-[A-Za-z0-9_-]+\.js"'
```

If they differ, the DNS record is pointing at the wrong tunnel. The live site should
resolve to the `octo-mac` tunnel, whose ingress carries
`acs.design-bakery.com → http://acs-web:80`.

## Layout

```
src/pages/         Index (marketing), MapPage (universe), PRD
src/components/    Constellation, HeroSky, Skies, and the section components
src/lib/           content loader, three.js scene, black hole, lensing
content/           authored content — the source of truth
tools/             the build gates
deploy/gravebuster/  Dockerfile, Caddyfile, compose files, deploy and rollback scripts
```
