#!/usr/bin/env bash
# Runs every lab check in order. Usage: ./demo.sh [base-url]
# Set PAUSE=1 to wait for Enter between sections (useful when recording).
set -u
BASE="${1:-https://cloudflare-lab.webflexer.com}"
HOST="${BASE#*://}"

section() {
  [ "${PAUSE:-0}" = "1" ] && read -r -p $'\n[Enter] ' _
  printf '\n\033[1;33m== %s\033[0m\n' "$1"
}

section "1. DNS and edge: the request lands on Cloudflare first"
echo "\$ dig +short $HOST"; dig +short "$HOST"
curl -sI "$BASE/" | grep -iE '^(server|cf-ray):'
echo "(the cf-ray suffix is the data center that handled the request)"

section "2. Edge cache: MISS goes to the simulated origin, HIT never leaves Cloudflare"
echo "purge first, so the run starts cold: $(curl -s -X POST "$BASE/api/purge")"
for i in 1 2 3; do
  curl -s -o /dev/null -D - -w 'time: %{time_total}s\n' "$BASE/api/products" | grep -iE '^(x-cache|x-colo|time)' | paste -sd' ' -
done

section "3. R2: product image served from the bucket"
curl -s -o /dev/null -D - "$BASE/images/shoe.svg" | grep -iE '^(HTTP|content-type|x-source)'

section "4. WAF custom rule: probes for secrets are blocked at the edge"
for p in /.env /wp-login.php; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")"
done
echo "(403 = blocked by Cloudflare; 404 = reached the Worker)"

section "5. Rate limiting: repeated logins from one IP"
for i in $(seq 1 12); do
  printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' -X POST -d 'email=a@example.com&password=x' "$BASE/login")"
done
echo; echo "(401 = Worker rejected the login; 429 = Cloudflare stopped it first)"

section "6. Client-Side Security: Cloudflare adds a CSP report-only header (to a sample of responses)"
found=""
for i in $(seq 1 20); do
  found=$(curl -s -D - -o /dev/null -H 'Cache-Control: no-cache' "$BASE/" | grep -i '^content-security-policy-report-only:')
  [ -n "$found" ] && break
done
if [ -n "$found" ]; then echo "$found" | cut -c1-160; echo "(seen after $i request(s))"; else echo "not seen in 20 requests"; fi

section "7. Access: /admin needs a login, the rest of the site doesn't"
curl -s -o /dev/null -D - "$BASE/admin" | grep -iE '^(HTTP/|location:)' | cut -c1-120
echo
