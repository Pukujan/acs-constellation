# syntax=docker/dockerfile:1
#
# The ACS constellation site: build the Vite SPA, then serve the static bundle
# with Caddy. Two stages so the runtime image carries no node_modules and no
# toolchain.
#
# Build from the app root:
#   docker build -f deploy/gravebuster/Dockerfile -t acs-web:local .

ARG NODE_IMAGE=node:24-bookworm-slim
ARG PNPM_VERSION=10.32.1

# ------------------------------------------------------------------ build
FROM ${NODE_IMAGE} AS build

# Re-declare: an ARG set before FROM is not visible inside the stage, so without
# this ${PNPM_VERSION} expands to empty and pnpm resolves to "latest" — a version
# that rejects this lockfile's unapproved build scripts.
ARG PNPM_VERSION

ENV CI=1

RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

# Manifests first so the dependency layer survives source edits.
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm build

# ------------------------------------------------------------------ runtime
FROM caddy:2-alpine AS runtime

COPY --from=build /app/dist /srv
COPY deploy/gravebuster/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
