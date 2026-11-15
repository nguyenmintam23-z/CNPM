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

deploy() {
  local service_id=$1 label=$2 endpoint deploy_id status
  endpoint="https://api.render.com/v1/services/$service_id/deploys"
  deploy_id=$(render --request POST --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg commit "$commit" '{commitId: $commit}')" "$endpoint" | jq -er '.id')
  echo "$label deploy $deploy_id requested for $commit"

  for ((attempt=0; attempt<50; attempt++)); do
    status=$(render "$endpoint/$deploy_id" | jq -er '.status')
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

deploy "$RENDER_API_SERVICE_ID" API
smoke "${API_URL%/}/health"
deploy "$RENDER_WEB_SERVICE_ID" Web
smoke "${WEB_URL%/}/healthz"
