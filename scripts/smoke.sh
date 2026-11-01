#!/usr/bin/env bash
set -u
APP="$1"; PORT="${2:-8791}"; B="http://localhost:$PORT"; A="$B/api/v2"
MOCK_FONZIP_PORT=$PORT bun run --cwd "$APP" start >"${TMPDIR:-/tmp}/mock-fonzip-smoke.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; wait $PID 2>/dev/null' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "$B/__mock/clock" && break; sleep 0.2; done
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok   $1 ($3)"; else fail=$((fail+1)); echo "FAIL $1: expected $2, got $3"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
tok=$(curl -s -X POST "$A/token" -d grant_type=client_credentials -d client_id=kelder-local -d client_secret=kelder-local-secret)
echo "token response: $tok"
T=$(echo "$tok" | jq -r .access_token)
check "token expires_in" 3600 "$(echo "$tok" | jq -r .expires_in)"
check "token_type" Bearer "$(echo "$tok" | jq -r .token_type)"
H="Authorization: Bearer $T"
check "GET /me" 200 "$(code -H "$H" "$A/me")"
check "GET /tags" 200 "$(code -H "$H" "$A/tags?start_page=1&how_many=5")"
check "POST /users search" 200 "$(code -H "$H" -H 'Content-Type: application/json' -X POST "$A/users" -d '{"search":{"start_page":1,"how_many":5,"order_by":"id","filter":{"condition":"and","attributes":[{"type":"default","parameter":"name","condition":"contains","value":"a"}]}}}')"
check "GET /donations paid" 200 "$(code -H "$H" "$A/donations?status=paid&start_page=1&how_many=2&start_date=2020-01-01T00:00:00%2B03:00&end_date=2027-01-01T00:00:00%2B03:00")"
check "GET /debts" 200 "$(code -H "$H" "$A/debts?start_page=1&how_many=2")"
check "GET /events" 200 "$(code -H "$H" "$A/events?start_page=1&how_many=2")"
check "GET /forms" 200 "$(code -H "$H" "$A/forms?start_page=1&how_many=2")"
check "GET /fundraising-campaigns" 200 "$(code -H "$H" "$A/fundraising-campaigns?start_page=1&how_many=2")"
check "GET /ecard-transactions" 200 "$(code -H "$H" "$A/ecard-transactions?start_page=1&how_many=2&start_date=2020-01-01T00:00:00%2B03:00&end_date=2027-01-01T00:00:00%2B03:00")"
check "GET /user/1004" 200 "$(code -H "$H" "$A/user/1004")"
check "GET /user/999999 unknown" 404 "$(code -H "$H" "$A/user/999999")"
check "no token" 401 "$(code "$A/me")"
check "bad secret" 401 "$(code -X POST "$A/token" -d grant_type=client_credentials -d client_id=kelder-local -d client_secret=wrong)"
check "refresh_token grant" 400 "$(code -X POST "$A/token" -d grant_type=refresh_token -d client_id=kelder-local -d client_secret=kelder-local-secret -d refresh_token=x)"
check "unknown grant" 406 "$(code -X POST "$A/token" -d grant_type=password -d client_id=kelder-local -d client_secret=kelder-local-secret)"
check "lapsed plan token" 402 "$(code -X POST "$A/token" -d grant_type=client_credentials -d client_id=ornek-lapsed -d client_secret=ornek-lapsed-secret)"
RO=$(curl -s -X POST "$A/token" -d grant_type=client_credentials -d client_id=kelder-readonly -d client_secret=kelder-readonly-secret | jq -r .access_token)
check "read-only key writes" 403 "$(code -H "Authorization: Bearer $RO" -H 'Content-Type: application/json' -X POST "$A/tags" -d '{"name":"x","color":"#fff000"}')"
check "wrong method" 405 "$(code -H "$H" -X PATCH "$A/tags")"
check "missing required query" 400 "$(code -H "$H" "$A/tags")"
curl -s -X DELETE "$B/__mock/webhooks/deliveries" >/dev/null
don=$(curl -s -H "$H" -H 'Content-Type: application/json' -X POST "$A/donations" -d '{"payment_method_select":"other","payment_method":1,"amount":750,"first_name":"Deniz","last_name":"Yılmaz","email":"deniz.yilmaz@eposta.example"}')
echo "createDonation: $don"
check "createDonation result" ok "$(echo "$don" | jq -r .result)"
sale=$(curl -s -H 'Content-Type: application/json' -X POST "$B/__mock/simulations/dues-events/ticket-sale?org=kelder" -d '{"ticket_id":6101,"name":"Ayşe Demir","email":"ayse.demir@eposta.example"}')
echo "ticket-sale simulation: $(echo "$sale" | head -c 300)"
sleep 1
dl=$(curl -s "$B/__mock/webhooks/deliveries")
echo "deliveries: $(echo "$dl" | jq -c '[.deliveries[] | {webhook: .body.webhook_id, op: .body.operation, status: .body.status, auth: (.headers["X-FZ-Auth-Token"] // null), outcome: .outcome.state}]' 2>/dev/null | head -c 900)"
check "DONATION webhook delivered" true "$(echo "$dl" | jq '[.deliveries[] | select(.body.operation == 1 and .outcome.state == "delivered")] | length > 0')"
check "TICKET webhook delivered" true "$(echo "$dl" | jq '[.deliveries[] | select(.body.operation == 3 and .outcome.state == "delivered")] | length > 0')"
check "auth header on webhook 21" true "$(echo "$dl" | jq '[.deliveries[] | select(.headers["X-FZ-Auth-Token"] != null) | .body.webhook_id] | unique == [21]')"
rl=""; for i in $(seq 1 61); do rl=$(code -H "$H" "$A/me"); done
check "61st /me in a minute" 429 "$rl"
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ]
