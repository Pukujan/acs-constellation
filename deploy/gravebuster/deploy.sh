#!/usr/bin/env bash
#
# Deploy the ACS constellation site. Runs on the Mac host.
#
# Fetches a git ref into the deploy checkout, builds a tagged image, swaps the
# `acs-web` container, smoke-checks the running site, and records the previous
# image tag so rollback.sh can put it back. Auto-rolls-back if the smoke test
# fails. Nothing here touches the Cloudflare Tunnel or the study-os stack.
#
# The `acs-web` name and the `study-os_edge` attachment are load-bearing: the
# tunnel routes acs.design-bakery.com -> http://acs-web:80 by container name, so
# BOTH compose files are always passed. A deploy without the edge overlay drops
# the container off that network and the tunnel 502s.
#
# Usage (from the deploy checkout, e.g. ~/apps/acs-constellation):
#   deploy/gravebuster/deploy.sh                    # deploy origin/main
#   deploy/gravebuster/deploy.sh --ref <sha|branch> # deploy something else
#   deploy/gravebuster/deploy.sh --no-pull          # use the local checkout as-is
#   deploy/gravebuster/deploy.sh --no-rollback      # do not auto-rollback on smoke failure
#   deploy/gravebuster/deploy.sh --list             # list local acs-web image tags
#
# Only one deploy or rollback runs at a time: each takes an exclusive lock
# DIRECTORY (deploy/gravebuster/.deploy.lock) and exits at once if another holds it.
#
# Config comes from deploy/gravebuster/.env (optional, non-secret knobs) and/or
# the environment.
set -euo pipefail

# Docker Desktop on macOS installs the CLI in /usr/local/bin, which is NOT on the
# default non-interactive SSH PATH (a login shell has it, `ssh host <script>` does
# not). The Mac host runs this over plain SSH.
PATH="/usr/local/bin:$PATH"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SELF="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
REPO_DIR=${DEPLOY_REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
EDGE_OVERLAY="$SCRIPT_DIR/docker-compose.edge.yml"
STATE_FILE=${DEPLOY_STATE_FILE:-$SCRIPT_DIR/.deploy-state}
LOG_FILE=${DEPLOY_LOG_FILE:-$SCRIPT_DIR/deploy.log}
# The lock is a DIRECTORY (see acquire_lock below) — macOS has no flock(1).
LOCK_DIR=${DEPLOY_LOCK_DIR:-$SCRIPT_DIR/.deploy.lock}
STALE_LOCK_MINUTES=${STALE_LOCK_MINUTES:-60}
STALE_LOCK_MAX_MINUTES=${STALE_LOCK_MAX_MINUTES:-1440}
IMAGE_REPO=${ACS_WEB_IMAGE_REPO:-acs-web}
CONTAINER=${ACS_WEB_CONTAINER:-acs-web}
EDGE_NETWORK=${EDGE_NETWORK:-study-os_edge}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-90}
HEALTH_PATH=${HEALTH_PATH:-/healthz}

REF=origin/main
DO_PULL=1
AUTO_ROLLBACK=1
LIST=0

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

usage() {
	sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
	exit "${1:-0}"
}

while [ $# -gt 0 ]; do
	case "$1" in
		--ref) REF=${2:?--ref needs a value}; shift 2 ;;
		--no-pull) DO_PULL=0; shift ;;
		--no-rollback) AUTO_ROLLBACK=0; shift ;;
		--list) LIST=1; shift ;;
		-h|--help) usage 0 ;;
		*) die "unknown argument: $1 (try --help)" ;;
	esac
done

# .env is optional; it only ever holds non-secret deployment knobs. It is
# git-ignored and never copied into the image.
if [ -f "$SCRIPT_DIR/.env" ]; then
	set -a
	# shellcheck disable=SC1091
	. "$SCRIPT_DIR/.env"
	set +a
fi
WEB_HOST_PORT=${WEB_HOST_PORT:-8097}

# Both compose files, always. See the header.
COMPOSE=(docker compose -f "$COMPOSE_FILE" -f "$EDGE_OVERLAY")
compose() { "${COMPOSE[@]}" "$@"; }

if [ "$LIST" = "1" ]; then
	docker images "$IMAGE_REPO" --format '{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}'
	exit 0
fi

[ -d "$REPO_DIR/.git" ] || die "no git checkout at $REPO_DIR"
command -v docker >/dev/null || die "docker not found"
command -v curl >/dev/null || die "curl not found"

# One deploy at a time. Two overlapping runs interleave their container swaps.
# Non-blocking on purpose: the second caller fails fast and the autodeploy timer
# retries on its next tick rather than queueing behind a long deploy.
#
# Portable lock: an exclusive mkdir on a lock DIRECTORY (atomic on Linux and
# macOS), released by rm on EXIT. macOS has no flock(1). The holder writes its
# pid; a live pid means busy, a dead pid means the holder crashed and the lock is
# taken over. A lock whose pid file is not yet written is only taken over once it
# is older than STALE_LOCK_MINUTES (the mkdir->write-pid window); a live-looking
# pid still loses after STALE_LOCK_MAX_MINUTES (pid-reuse safety valve).
acquire_lock() {
	# Guard the rm -rf below against a pathological LOCK_DIR.
	[ -n "$LOCK_DIR" ] && [ "/" != "$LOCK_DIR" ] && [ "$PWD" != "$LOCK_DIR" ] \
		|| die "refusing to lock at unsafe path: '$LOCK_DIR'"
	if [ -d "$LOCK_DIR" ]; then
		if [ -f "$LOCK_DIR/pid" ]; then
			local lock_pid
			lock_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
			case "$lock_pid" in
				''|*[!0-9]*)
					log "removing unreadable lock at $LOCK_DIR (pid file is not a pid)"
					rm -rf "$LOCK_DIR" ;;
				*)
					if kill -0 "$lock_pid" 2>/dev/null \
						&& [ -z "$(find "$LOCK_DIR" -maxdepth 0 -mmin +"$STALE_LOCK_MAX_MINUTES" 2>/dev/null)" ]; then
						die "another deploy or rollback is running (lock: $LOCK_DIR, pid $lock_pid)"
					fi
					log "removing stale lock at $LOCK_DIR (pid $lock_pid not running, or lock older than ${STALE_LOCK_MAX_MINUTES}m)"
					rm -rf "$LOCK_DIR" ;;
			esac
		else
			if [ -z "$(find "$LOCK_DIR" -maxdepth 0 -mmin +"$STALE_LOCK_MINUTES" 2>/dev/null)" ]; then
				die "another deploy or rollback is starting (lock: $LOCK_DIR, pid not yet written)"
			fi
			log "removing stale lock at $LOCK_DIR (no pid, older than ${STALE_LOCK_MINUTES}m)"
			rm -rf "$LOCK_DIR"
		fi
	fi
	mkdir "$LOCK_DIR" 2>/dev/null || die "another deploy or rollback is running (lock: $LOCK_DIR)"
	if ! printf '%s\n' "$$" >"$LOCK_DIR/pid" 2>/dev/null; then
		rm -rf "$LOCK_DIR" 2>/dev/null || true
		die "could not write lock pid at $LOCK_DIR"
	fi
	# rm -rf, not rmdir: the lock dir holds the pid file, and rmdir only removes
	# empty directories — it would silently leave the lock behind on every run.
	trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT
}

# Take the deploy lock, unless this run is a re-exec (below) of the freshly
# checked-out script: `exec` keeps our pid, so the lock the first pass took is
# still ours. `exec` also clears the EXIT trap, so re-arm it here.
if [ "${DEPLOY_REEXEC:-0}" = "1" ]; then
	[ -d "$LOCK_DIR" ] || die "re-exec lost the deploy lock at $LOCK_DIR"
	trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT
else
	acquire_lock
fi

state_get() {
	[ -f "$STATE_FILE" ] || return 0
	sed -n "s/^$1=//p" "$STATE_FILE" | tail -1
}

state_write() { # <sha> <current_image> <previous_image> <failed_sha>
	local tmp="$STATE_FILE.tmp"
	{
		echo "SHA=$1"
		echo "CURRENT_IMAGE=$2"
		echo "PREVIOUS_IMAGE=$3"
		echo "FAILED_SHA=$4"
		echo "DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$tmp"
	mv "$tmp" "$STATE_FILE"
}

state_set_failed() { # <sha>
	local tmp="$STATE_FILE.tmp"
	{
		echo "SHA=$(state_get SHA)"
		echo "CURRENT_IMAGE=$(state_get CURRENT_IMAGE)"
		echo "PREVIOUS_IMAGE=$(state_get PREVIOUS_IMAGE)"
		echo "FAILED_SHA=$1"
		echo "DEPLOYED_AT=$(state_get DEPLOYED_AT)"
		echo "FAILED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$tmp"
	mv "$tmp" "$STATE_FILE"
}

http_code() {
	curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$1" 2>/dev/null || echo "000"
}

running_image() {
	docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true
}

# The container's attachment to the tunnel network is what makes the public site
# resolve. Assert it rather than trusting compose.
assert_edge_network() {
	if docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER" 2>/dev/null \
		| grep -qw -- "$EDGE_NETWORK"; then
		log "  ok   $CONTAINER is on $EDGE_NETWORK"
	else
		log "  FAIL $CONTAINER is NOT on $EDGE_NETWORK — the tunnel will 502"
		return 1
	fi
}

wait_healthy() {
	local deadline=$((SECONDS + HEALTH_TIMEOUT))
	while [ "$SECONDS" -lt "$deadline" ]; do
		local status
		status=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)
		case "$status" in
			healthy) log "  ok   container healthy"; return 0 ;;
			unhealthy) log "  FAIL container reported unhealthy"; return 1 ;;
		esac
		sleep 2
	done
	log "  FAIL container did not become healthy within ${HEALTH_TIMEOUT}s"
	return 1
}

# Smoke test against the loopback port. /, /prd and /map are all served the same
# shell by Caddy's SPA fallback, so a status code cannot tell them apart — the
# needle check on / is what proves the right document is being served.
smoke() {
	local base="http://127.0.0.1:$WEB_HOST_PORT"
	local failures=0
	check() { # <expected> <path>
		local got
		got=$(http_code "$base$2")
		if [ "$got" = "$1" ]; then
			log "  ok   $got $2"
		else
			log "  FAIL expected $1, got $got for $2"
			failures=$((failures + 1))
		fi
	}
	# ASCII-only needle on purpose: the title carries an em dash and the deploy
	# host's locale is not guaranteed UTF-8.
	body_has() { # <path> <needle>
		if curl -sS --max-time 10 "$base$1" 2>/dev/null | grep -qF -- "$2"; then
			log "  ok   body has \"$2\" at $1"
		else
			log "  FAIL body missing \"$2\" at $1"
			failures=$((failures + 1))
		fi
	}
	check 200 "$HEALTH_PATH"
	body_has "$HEALTH_PATH" "ok"
	check 200 /
	body_has / "Agent Custom Setup"
	check 200 /prd
	check 200 /map
	check 200 /robots.txt

	# The first built asset referenced by the served shell must exist — this proves
	# the bundle resolved, not just the HTML.
	local asset
	asset=$(curl -sS --max-time 10 "$base/" 2>/dev/null \
		| grep -oE '/assets/[A-Za-z0-9._-]+\.js' | head -1 || true)
	if [ -n "$asset" ]; then
		check 200 "$asset"
	else
		log "  FAIL no /assets/*.js reference found in the served shell"
		failures=$((failures + 1))
	fi

	# The container's own document must be the one the loopback serves.
	local c_hash s_hash
	c_hash=$(docker exec "$CONTAINER" sha256sum /srv/index.html 2>/dev/null | awk '{print $1}' || true)
	s_hash=$(curl -sS --max-time 10 "$base/" 2>/dev/null | shasum -a 256 | awk '{print $1}' || true)
	if [ -n "$c_hash" ] && [ "$c_hash" = "$s_hash" ]; then
		log "  ok   served document matches the image's /srv/index.html"
	else
		log "  FAIL served document ($s_hash) does not match the image ($c_hash)"
		failures=$((failures + 1))
	fi

	# A stale checkout builds and serves perfectly — it is just the wrong code. The
	# build stamp is the only assertion that catches a deploy shipping the wrong
	# tree. Checked only for the image this run built: a rollback deliberately runs
	# an older one.
	local running
	running=$(running_image)
	if [ -n "${NEW_IMAGE:-}" ] && [ "$running" = "$NEW_IMAGE" ]; then
		local built
		built=$(docker inspect -f '{{index .Config.Labels "acs.build.sha"}}' "$CONTAINER" 2>/dev/null || true)
		if [ "$built" = "$SHA" ]; then
			log "  ok   image built from $SHORT"
		else
			log "  FAIL image built from ${built:-<no label>}, expected $SHORT"
			failures=$((failures + 1))
		fi
	fi

	assert_edge_network || failures=$((failures + 1))

	# Public reachability is reported, never fatal: a Cloudflare-side blip must not
	# roll back an otherwise-good image.
	local pub
	pub=$(http_code "https://acs.design-bakery.com$HEALTH_PATH")
	if [ "$pub" = "200" ]; then
		log "  ok   200 public $HEALTH_PATH"
	else
		log "  warn public $HEALTH_PATH returned $pub (not fatal)"
	fi

	return "$failures"
}

# Shared failure path for a bad build result: roll back to the previous image if we
# can, and record the offending SHA so autodeploy stops retrying it every tick.
handle_failure() { # <reason>
	local prev_sha
	prev_sha=$(state_get SHA)
	log "SMOKE FAILED for $SHORT ($1)"

	if [ "$AUTO_ROLLBACK" != "1" ] || [ -z "$PREV_IMAGE" ] || [ "$PREV_IMAGE" = "$NEW_IMAGE" ]; then
		log "not rolling back (auto-rollback off, or no previous image to return to)"
		state_set_failed "$SHA"
		exit 1
	fi

	log "rolling back to $PREV_IMAGE"
	if ACS_WEB_IMAGE="$PREV_IMAGE" compose up -d --no-deps web && wait_healthy && smoke; then
		state_write "$prev_sha" "$PREV_IMAGE" "$NEW_IMAGE" "$SHA"
		log "rolled back to $PREV_IMAGE; $SHORT recorded as FAILED_SHA"
	else
		log "ERROR: rollback itself failed smoke — the site may be down; investigate by hand"
		state_set_failed "$SHA"
	fi
	exit 1
}

# ------------------------------------------------------------------ main

if [ "$DO_PULL" = "1" ]; then
	git -C "$REPO_DIR" fetch --prune origin || die "git fetch failed"
fi

SHA=$(git -C "$REPO_DIR" rev-parse "$REF^{commit}") || die "cannot resolve $REF"
SHORT=$(git -C "$REPO_DIR" rev-parse --short=12 "$SHA")

# What is running now, so a failure has something to go back to. A fresh clone has
# no state file, so fall back to the live container's image.
PREV_IMAGE=$(state_get CURRENT_IMAGE)
[ -n "$PREV_IMAGE" ] || PREV_IMAGE=$(running_image)

NEW_IMAGE="$IMAGE_REPO:$SHORT-$(date -u +%Y%m%dT%H%M%SZ)"

log "deploying $REF at $SHORT (image $NEW_IMAGE)"

# Always check out the requested commit. --no-pull skips the network fetch, not
# the checkout: autodeploy.sh passes --no-pull because it has just fetched, and
# when the checkout lived inside the DO_PULL branch that flag made every deploy
# build whatever the working tree happened to hold while recording the new SHA
# as deployed — the site then reported "up to date" and never shipped again.
git -C "$REPO_DIR" checkout --force --detach "$SHA" || die "git checkout failed"

# The build must compile the commit we resolved, not a tree that drifted.
BUILT_SHA=$(git -C "$REPO_DIR" rev-parse HEAD)
[ "$BUILT_SHA" = "$SHA" ] || die "checkout is at $BUILT_SHA, expected $SHA"

# Re-exec the just-checked-out script so a fix to this file ships itself. `exec`
# keeps the pid, so the lock stays ours.
if [ "${DEPLOY_REEXEC:-0}" != "1" ]; then
	REEXEC_ARGS=(--no-pull --ref "$SHA")
	[ "$AUTO_ROLLBACK" = "1" ] || REEXEC_ARGS+=(--no-rollback)
	DEPLOY_REEXEC=1 exec "$SELF" "${REEXEC_ARGS[@]}"
fi

# Build first, swap second: a failed build must leave the running site untouched.
log "building image"
ACS_WEB_IMAGE="$NEW_IMAGE" ACS_BUILD_SHA="$SHA" compose build web || die "docker compose build failed"

log "swapping container"
ACS_WEB_IMAGE="$NEW_IMAGE" compose up -d --no-deps web || die "docker compose up failed"

# A container that never reports healthy is a failed deploy just as much as a bad
# smoke test; fall through to the same rollback path.
if ! wait_healthy; then
	handle_failure "container never became healthy"
fi

if smoke; then
	state_write "$SHA" "$NEW_IMAGE" "$PREV_IMAGE" ""
	log "deployed $SHORT ($NEW_IMAGE)"
	exit 0
fi

handle_failure "smoke assertions failed"
