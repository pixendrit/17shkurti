#!/usr/bin/env bash
# Deploy to Cloudflare Workers + D1. Safe to re-run: every step is idempotent.
#
# Needs, in the environment:
#   CLOUDFLARE_API_TOKEN   token with Workers Scripts: Edit and D1: Edit
#   CLOUDFLARE_ACCOUNT_ID  from the Cloudflare dashboard
#   APP_PIN                the 4-digit code everyone unlocks with
set -euo pipefail
cd "$(dirname "$0")/.."

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is not set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is not set}"
: "${APP_PIN:?APP_PIN is not set}"
[[ "$APP_PIN" =~ ^[0-9]{4}$ ]] || { echo "APP_PIN must be exactly 4 digits" >&2; exit 1; }

export WRANGLER_SEND_METRICS=false
API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID"
auth=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")

step() { printf '\n==> %s\n' "$1"; }

step "Checking the token"
curl -sf "${auth[@]}" "$API/workers/scripts" >/dev/null \
	|| { echo "Token can't list Workers — check it has 'Workers Scripts: Edit'." >&2; exit 1; }

step "workers.dev subdomain"
# A brand-new account has none, and `wrangler deploy` can't create one non-interactively.
SUB=$(curl -s "${auth[@]}" "$API/workers/subdomain" | node -e \
	'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).result?.subdomain??"")}catch{console.log("")}})')
if [[ -z "$SUB" ]]; then
	WANT="hijeshi-$(openssl rand -hex 3)"
	curl -sf -X PUT "${auth[@]}" -H "Content-Type: application/json" \
		"$API/workers/subdomain" -d "{\"subdomain\":\"$WANT\"}" >/dev/null
	SUB="$WANT"
	echo "registered $SUB.workers.dev"
else
	echo "using $SUB.workers.dev"
fi

step "D1 database"
find_db() {
	npx wrangler d1 list --json 2>/dev/null | node -e \
		'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).find(x=>x.name==="hijeshi");console.log(d?(d.uuid??d.id):"")})'
}
DB_ID=$(find_db)
if [[ -z "$DB_ID" ]]; then
	npx wrangler d1 create hijeshi >/dev/null
	DB_ID=$(find_db)
	echo "created database $DB_ID"
else
	echo "found database $DB_ID"
fi
[[ -n "$DB_ID" ]] || { echo "Could not find or create the D1 database" >&2; exit 1; }
sed -i.bak -E "s/\"database_id\": \"[^\"]*\"/\"database_id\": \"$DB_ID\"/" wrangler.jsonc && rm -f wrangler.jsonc.bak

step "Migrations"
npx wrangler d1 migrations apply hijeshi --remote

step "Build"
pnpm build

step "Deploy"
npx wrangler deploy

step "Secrets"
printf '%s' "$APP_PIN" | npx wrangler secret put APP_PIN >/dev/null
# Keep the existing session secret so re-deploys don't log everyone out.
if ! npx wrangler secret list --format json 2>/dev/null | grep -q '"SESSION_SECRET"'; then
	openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET >/dev/null
	echo "generated SESSION_SECRET"
fi

URL="https://hijeshi-dashboard.$SUB.workers.dev"
step "Checking $URL"
for _ in $(seq 1 20); do
	code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/login" || true)
	[[ "$code" == "200" ]] && break
	sleep 3
done
echo "login page -> HTTP $code"
[[ "$code" == "200" ]] || { echo "Deployed, but the login page isn't answering yet." >&2; exit 1; }

printf '\nLive: %s\n' "$URL"
