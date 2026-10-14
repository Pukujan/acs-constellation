#!/usr/bin/env bash
#
# Pull-based auto-deploy for the ACS constellation site.
#
# The Mac is not publicly reachable, so there is no GitHub webhook: this script
# polls origin/main and deploys when the SHA moves. It runs from a launchd agent
# (deploy/gravebuster/launchd/com.acs.autodeploy.plist), which fires every 300s.
#
# All the deploy safety lives in deploy.sh — the exclusive lock, the tagged image,
# the container swap, the smoke test and the auto-rollback.
#
#   deploy/gravebuster/autodeploy.sh              # deploy if origin/main moved
#   deploy/gravebuster/autodeploy.sh --dry-run    # report what would happen
set -euo pipefail

# Docker Desktop on macOS installs the CLI in /usr/local/bin, which is NOT on the
# default non-interactive PATH. deploy.sh (exec'd below) needs it.
PATH="/usr/local/bin:$PATH"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=${DEPLOY_REPO_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}
STATE_FILE=${DEPLOY_STATE_FILE:-$SCRIPT_DIR/.deploy-state}
LOG_FILE=${DEPLOY_LOG_FILE:-$SCRIPT_DIR/autodeploy.log}
REMOTE=${AUTODEPLOY_REMOTE:-origin}
BRANCH=${AUTODEPLOY_BRANCH:-main}
DRY_RUN=0

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

while [ $# -gt 0 ]; do
	case "$1" in
		--dry-run) DRY_RUN=1; shift ;;
		--branch) BRANCH=${2:?--branch needs a value}; shift 2 ;;
		-h|--help) sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) die "unknown argument: $1" ;;
	esac
done

state_get() {
	[ -f "$STATE_FILE" ] || return 0
	sed -n "s/^$1=//p" "$STATE_FILE" | tail -1
}

[ -d "$REPO_DIR/.git" ] || die "no git checkout at $REPO_DIR"

git -C "$REPO_DIR" fetch --prune "$REMOTE" "$BRANCH" >/dev/null
REMOTE_SHA=$(git -C "$REPO_DIR" rev-parse "$REMOTE/$BRANCH^{commit}") || die "cannot resolve $REMOTE/$BRANCH"
DEPLOYED_SHA=$(state_get SHA)
FAILED_SHA=$(state_get FAILED_SHA)

# An empty/missing SHA means a fresh clone with nothing deployed yet: deploy now
# rather than waiting for a commit that already exists.
if [ -n "$DEPLOYED_SHA" ] && [ "$REMOTE_SHA" = "$DEPLOYED_SHA" ]; then
	log "up to date ($REMOTE/$BRANCH at $(git -C "$REPO_DIR" rev-parse --short=12 "$REMOTE_SHA"))"
	exit 0
fi

# A commit that already failed its smoke test is not retried every tick — that
# would rebuild and roll back forever. Clear it by pushing a new commit, or by
# running deploy.sh by hand with --ref.
if [ "$REMOTE_SHA" = "$FAILED_SHA" ]; then
	log "REFUSING $REMOTE/$BRANCH at $(git -C "$REPO_DIR" rev-parse --short=12 "$REMOTE_SHA") — it already failed its smoke test (FAILED_SHA). Push a fix, or deploy.sh --ref to retry."
	exit 0
fi

log "new commit on $REMOTE/$BRANCH: $(git -C "$REPO_DIR" rev-parse --short=12 "$REMOTE_SHA") (deployed: ${DEPLOYED_SHA:0:12})"
if [ "$DRY_RUN" = "1" ]; then
	log "dry run — would run deploy.sh --no-pull --ref $REMOTE_SHA"
	exit 0
fi

exec "$SCRIPT_DIR/deploy.sh" --no-pull --ref "$REMOTE_SHA"
