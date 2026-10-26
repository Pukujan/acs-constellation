# ACS Constellation

The marketing site for **Agent Custom Setup** — one-click coordination between any
devices, any teams, any projects. Agents handle the coordination; the human keeps
every decision.

Live at **https://acs.design-bakery.com**

Three surfaces over one content model:

| Surface | Route | What it is |
|---|---|---|
| Marketing | `/` | The sales front page: hero constellation, problem/answer blocks, per-component research with charts |
| Universe | `/map` | The explorable 3D surface — grouped constellations, zoom/rotate/pan, select a node for detail |
| PRD | `/prd` | Technical deep-dive for engineers evaluating the stack: the same problem graph as prose, with citations |

A node in the graph is a **problem the stack solves**, not a repository. Selecting one
opens the problem, its human consequence, the component that answers it, and a link to
the exact file that answers it.

## Content is the source of truth

Every user-facing sentence lives in `content/`, and the build fails if prose appears in
`src/`. Editing copy means editing a JSON bundle, not a component.

```
content/
  problems.json   17 problem nodes + their evidence citations
  graph.json      layer table and edges between components
  copy.json       every marketing sentence, addressed by slot
  research.json   per-component figures and charts
  sources.md      the harvested sources
```

`src/lib/content.ts` is the only module that imports these bundles; components receive
their strings through it.

## Build gates

`pnpm build` runs four checks before Vite, and any failure fails the build:

| Gate | Enforces |
|---|---|
| `check-copy` | No prose-shaped literals in `src/`; every copy slot a component asks for exists; no banned words |
| `check-content-lock` | Each content bundle's digest matches its recorded value, so harvested evidence cannot drift silently |
| `check-tap-targets` | Minimum touch target sizes |
| `check-sky-behaviour` | The constellation scene's interaction contract |

Each gate appends to `.gate-report.jsonl`, which CI uploads as an artifact.

## Local development

Node 24 and pnpm 10.32.1 — the versions CI and the container image use.

```bash
pnpm install --frozen-lockfile
pnpm dev          # http://localhost:8080
```

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Deployment

The site runs on the Mac as the Docker container **`acs-web`** — Caddy serving the Vite
build, attached to the external `study-os_edge` network. The container name and that
network attachment are load-bearing: the Cloudflare tunnel reaches the site by container
name, so both compose files are always passed together.

Deploys are **pull-based**. The Mac is not publicly reachable, so there is no webhook:
the launchd agent `com.acs.autodeploy` polls `origin/main` every 300 seconds and runs
`deploy/gravebuster/autodeploy.sh`, which delegates to `deploy.sh`. That script fetches
the ref, builds a tagged image, swaps the container, smoke-tests it, and rolls back to
the previous image on failure. A commit that failed its smoke test is recorded as
`FAILED_SHA` and is not retried until a new commit lands.

Manual deploy, from the checkout on the Mac:

```bash
cd ~/apps/acs-constellation

deploy/gravebuster/deploy.sh                  # deploy origin/main
deploy/gravebuster/deploy.sh --ref <sha>      # deploy a specific commit
deploy/gravebuster/deploy.sh --no-pull        # deploy the local checkout as-is
deploy/gravebuster/deploy.sh --list           # list local acs-web image tags
deploy/gravebuster/rollback.sh                # return to the previous image
```

Build the image directly:

```bash
docker build -f deploy/gravebuster/Dockerfile -t acs-web:local .
```

### Tunnel routing

Two machines each run a cloudflared tunnel that can answer for this hostname, and each
has its own container named `acs-web`. **Which build is live is decided by the DNS
CNAME**, not by which deploy is current — a stale site can return 200 indefinitely.

Before blaming a deploy, compare the asset hash in the live HTML against the container's
own:

```bash
curl -sS https://acs.design-bakery.com/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
ssh mac-ts 'curl -sS http://127.0.0.1:8097/ | grep -oE "index-[A-Za-z0-9_-]+\.js"'
```

If they differ, DNS is pointing at the wrong tunnel. The live site resolves to the
`octo-mac` tunnel, whose ingress carries `acs.design-bakery.com → http://acs-web:80`.

## Layout

```
src/pages/            Index, MapPage, PRD, NotFound
src/components/       Constellation (three.js scene), HeroSky, Skies, sections
src/lib/              content loader, sky/blackhole/lensing scene modules
content/              the authored content bundles
tools/                the four build gates
deploy/gravebuster/   Dockerfile, Caddyfile, compose files, deploy/rollback/autodeploy
```
