# cloudflare-lab

A retail storefront on Cloudflare's developer platform, with AWS kept as the system of record. Each module is a live demo on [cloudflare-lab.webflexer.com](https://cloudflare-lab.webflexer.com).

## What runs today

One Worker, one route per piece of the architecture. `./demo.sh` runs every check below.

| Piece | Where | Real or simulated |
|---|---|---|
| Edge cache | `/api/products`, `POST /api/purge` | Real Cache API. The "AWS origin" is simulated: an 800 ms delay inside the Worker. |
| Storefront | `/` | Real Worker. |
| Product images | `/images/*.svg` | Real R2 bucket, read through a binding. No image resizing yet. |
| WAF custom rule | `/.env`, `/wp-login.php` | Real rule, configured in the dashboard. Returns 403 at the edge. |
| Rate limiting | `/login` | Real rule, configured in the dashboard. Returns 429 after repeated attempts. The form itself is fake: there are no accounts. |
| Client-Side Security | `/` | Real script monitoring. The page loads one third-party script from cdnjs, pinned with Subresource Integrity. |
| Access | `/admin` | Real Cloudflare Access app on that path only. |

Not built yet, described only: Tunnel, Hyperdrive, a real AWS origin, KV, Queues, Durable Objects.

## Try it

```sh
./demo.sh                                   # against the live site
curl -s -D - -o /dev/null https://cloudflare-lab.webflexer.com/api/products | grep -iE 'x-cache|x-colo'
curl -s -X POST https://cloudflare-lab.webflexer.com/api/purge
```

Locally:

```sh
npm install
npm run images:local    # copy images into the local R2 store
npm run dev             # http://localhost:8787
./demo.sh http://localhost:8787   # sections 4-7 need the zone, so they only work live
```

## Notes

- **Per data center.** The Cache API cache is per data center, and a purge clears only the location that ran it. The Cache API doesn't support tiered cache ([docs](https://developers.cloudflare.com/workers/runtime-apis/cache/)). v2 moves to Workers Caching, which adds tiered cache, request collapsing, and purge from code.
- **Why a custom domain.** WAF, rate limiting, and Client-Side Security apply only to hostnames in a zone you own, not to `*.workers.dev`. The workers.dev URL stays on as a backup.
- **Access only on `/admin`.** "For Workers fronted by Cloudflare Access, the Cache API is not currently available" ([docs](https://developers.cloudflare.com/workers/runtime-apis/cache/)).
- **Purge is public on purpose.** It clears one data center's copy of a public catalog. The worst case is a forced cache MISS.
- **JavaScript, not TypeScript.** Module 1 started as tested JavaScript. TypeScript comes with v2.
- **Free plan limits.** One rate-limiting rule, a 10-second counting period, and matching on path only ([docs](https://developers.cloudflare.com/waf/rate-limiting-rules/)). Script monitoring is the only Client-Side Security feature on Free ([docs](https://developers.cloudflare.com/client-side-security/detection/monitor-connections-scripts/)).
