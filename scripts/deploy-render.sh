#!/usr/bin/env bash
set -euo pipefail

: "${RENDER_API_KEY:?Missing Render API key}"
: "${RENDER_API_SERVICE_ID:?Missing Render API service ID}"
: "${RENDER_WEB_SERVICE_ID:?Missing Render Web service ID}"
: "${API_URL:?Missing API URL}"
: "${WEB_URL:?Missing Web URL}"

for url in "$API_URL" "$WEB_URL"; do
  if [[ "$url" != https://* ]]; then
    echo 'Production URLs must use HTTPS.' >&2
    exit 1
  fi
done

commit=$(git rev-parse HEAD)

render() {
  curl --silent --show-error --fail --max-time 20 \
    --header "Authorization: Bearer $RENDER_API_KEY" "$@"
}

live_deploy() {
  render "https://api.render.com/v1/services/$1/deploys?status=live" |
    jq -r '[.[] | .deploy | select(.status == "live")][0].id // ""'
}

deploy() {
  render --request POST --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg commit "$commit" '{commitId: $commit}')" \
    "https://api.render.com/v1/services/$1/deploys" | jq -er '.id'
}

wait_live() {
  local service_id=$1 deploy_id=$2 label=$3 status
  local endpoint="https://api.render.com/v1/services/$service_id/deploys/$deploy_id"
  for ((attempt=0; attempt<50; attempt++)); do
    status=$(render "$endpoint" | jq -er '.status') || return 1
    case "$status" in
      live) return 0 ;;
      *_failed|canceled|cancelled|deactivated)
        echo "$label deploy $deploy_id ended with status $status" >&2
        return 1 ;;
    esac
    sleep 10
  done
  echo "$label deploy $deploy_id timed out" >&2
  return 1
}

smoke() {
  local url=$1 status
  for ((attempt=0; attempt<12; attempt++)); do
    if status=$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' "$url") &&
      [[ "$status" == 200 ]]; then
      echo "HTTP 200 $url"
      return 0
    fi
    sleep 5
  done
  echo "Smoke test failed for $url" >&2
  return 1
}

rollback() {
  local service_id=$1 previous=$2 attempted=$3 url=$4 label=$5 current restored
  [[ -n "$attempted" ]] || return 0
  current=$(live_deploy "$service_id") || return 1
  if [[ "$current" != "$attempted" ]]; then
    echo "$label deploy $attempted is not live. Check its status in Render if the deployment timed out." >&2
    return 0
  fi
  if [[ -z "$previous" ]]; then
    echo "$label has no previous live deploy to restore." >&2
    return 1
  fi
  restored=$(render --request POST --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg id "$previous" '{deployId: $id}')" \
    "https://api.render.com/v1/services/$service_id/rollback" | jq -er '.id') || return 1
  printf '%s rollback %s requested from %s\n' "$label" "$restored" "$previous"
  wait_live "$service_id" "$restored" "$label rollback" && smoke "$url"
}

api_health="${API_URL%/}/health"
web_health="${WEB_URL%/}/healthz"
api_previous=$(live_deploy "$RENDER_API_SERVICE_ID")
web_previous=$(live_deploy "$RENDER_WEB_SERVICE_ID")
api_attempted=''
web_attempted=''

on_exit() {
  local result=$?
  if ((result != 0)); then
    rollback "$RENDER_WEB_SERVICE_ID" "$web_previous" "$web_attempted" "$web_health" Web ||
      echo 'Web rollback requires intervention in Render.' >&2
    rollback "$RENDER_API_SERVICE_ID" "$api_previous" "$api_attempted" "$api_health" API ||
      echo 'API rollback requires intervention in Render.' >&2
  fi
}
trap on_exit EXIT

api_attempted=$(deploy "$RENDER_API_SERVICE_ID")
echo "API deploy $api_attempted requested for $commit"
wait_live "$RENDER_API_SERVICE_ID" "$api_attempted" API
smoke "$api_health"
web_attempted=$(deploy "$RENDER_WEB_SERVICE_ID")
echo "Web deploy $web_attempted requested for $commit"
wait_live "$RENDER_WEB_SERVICE_ID" "$web_attempted" Web
smoke "$web_health"
