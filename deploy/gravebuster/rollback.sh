#!/usr/bin/env bash
#
# Roll the ACS constellation site back to the previously deployed image.
#
# Swaps the `acs-web` container to the image recorded as PREVIOUS_IMAGE by the last
# deploy (or one named with --image), smoke-checks it, and swaps the state file's
# current/previous so a second rollback goes forward again. No rebuild.
#
# Usage:
#   deploy/gravebuster/rollback.sh                 # back to PREVIOUS_IMAGE
#   deploy/gravebuster/rollback.sh --image acs-web:<sha12>-<utc>
#   deploy/gravebuster/rollback.sh --list          # list local acs-web image tags
#
# Takes the same exclusive lock as deploy.sh, so the two never overlap.
set -euo pipefail

PATH="/usr/local/bin:$PATH"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=${DEPLOY_REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
EDGE_OVERLAY="$SCRIPT_DIR/docker-compose.edge.yml"
STATE_FILE=${DEPLOY_STATE_FILE:-$SCRIPT_DIR/.deploy-state}
LOG_FILE=${DEPLOY_LOG_FILE:-$SCRIPT_DIR/rollback.log}
LOCK_DIR=${DEPLOY_LOCK_DIR:-$SCRIPT_DIR/.deploy.lock}
STALE_LOCK_MINUTES=${STALE_LOCK_MINUTES:-60}
STALE_LOCK_MAX_MINUTES=${STALE_LOCK_MAX_MINUTES:-1440}
IMAGE_REPO=${ACS_WEB_IMAGE_REPO:-acs-web}
CONTAINER=${ACS_WEB_CONTAINER:-acs-web}
EDGE_NETWORK=${EDGE_NETWORK:-study-os_edge}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-90}
HEALTH_PATH=${HEALTH_PATH:-/healthz}

TARGET=""
LIST=0

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

while [ $# -gt 0 ]; do
	case "$1" in
		--image) TARGET=${2:?--image needs a value}; shift 2 ;;
		--list) LIST=1; shift ;;
		-h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) die "unknown argument: $1 (try --help)" ;;
	esac
done

if [ -f "$SCRIPT_DIR/.env" ]; then
	set -a
	# shellcheck disable=SC1091
	. "$SCRIPT_DIR/.env"
	set +a
fi
WEB_HOST_PORT=${WEB_HOST_PORT:-8097}

COMPOSE=(docker compose -f "$COMPOSE_FILE" -f "$EDGE_OVERLAY")
compose() { "${COMPOSE[@]}" "$@"; }

if [ "$LIST" = "1" ]; then
	docker images "$IMAGE_REPO" --format '{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}'
	exit 0
fi

command -v docker >/dev/null || die "docker not found"

# Same portable lock as deploy.sh (see that file for the rationale).
acquire_lock() {
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
	trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT
}
acquire_lock

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
		echo "DEPLOYED_AT=$(state_get DEPLOYED_AT)"
		echo "ROLLED_BACK_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	} >"$tmp"
	mv "$tmp" "$STATE_FILE"
}

http_code() {
	curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$1" 2>/dev/null || echo "000"
}

running_image() {
	docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true
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

smoke() {
	local base="http://127.0.0.1:$WEB_HOST_PORT"
	local failures=0
	check() {
		local got
		got=$(http_code "$base$2")
		if [ "$got" = "$1" ]; then
			log "  ok   $got $2"
		else
			log "  FAIL expected $1, got $got for $2"
			failures=$((failures + 1))
		fi
	}
	check 200 "$HEALTH_PATH"
	check 200 /
	check 200 /prd
	check 200 /map
	if curl -sS --max-time 10 "$base/" 2>/dev/null | grep -qF -- "Agent Custom Setup"; then
		log "  ok   body has \"Agent Custom Setup\" at /"
	else
		log "  FAIL body missing \"Agent Custom Setup\" at /"
		failures=$((failures + 1))
	fi
	if docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER" 2>/dev/null \
		| grep -qw -- "$EDGE_NETWORK"; then
		log "  ok   $CONTAINER is on $EDGE_NETWORK"
	else
		log "  FAIL $CONTAINER is NOT on $EDGE_NETWORK — the tunnel will 502"
		failures=$((failures + 1))
	fi
	return "$failures"
}

# ------------------------------------------------------------------ main

CURRENT=$(running_image)
if [ -z "$TARGET" ]; then
	TARGET=$(state_get PREVIOUS_IMAGE)
	[ -n "$TARGET" ] || die "no PREVIOUS_IMAGE in $STATE_FILE and no --image given"
fi

[ "$TARGET" != "$CURRENT" ] || die "target $TARGET is already running"
docker image inspect "$TARGET" >/dev/null 2>&1 || die "image $TARGET is not present on this host"

PREV_SHA=$(state_get SHA)
log "rolling back $CURRENT -> $TARGET"

ACS_WEB_IMAGE="$TARGET" compose up -d --no-deps web || die "docker compose up failed"
wait_healthy || die "rolled-back container did not become healthy"
smoke || die "rolled-back container failed smoke — the site may be down"

# Swap current/previous so a second rollback goes forward again.
state_write "$PREV_SHA" "$TARGET" "$CURRENT" ""
log "rolled back to $TARGET"
