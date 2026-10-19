// Cloudflare lab: one Worker, one route per box on the architecture diagram.
import { PAGE, LOGIN_PAGE, adminPage } from "./page.js";

const ORIGIN_DELAY_MS = 800; // stand-in for a slow origin on AWS (simulated)
const TTL_SECONDS = 60;

const products = [
  { id: 1, name: "Trail running shoe", price: 149, image: "/images/shoe.svg" },
  { id: 2, name: "Merino base layer", price: 89, image: "/images/base-layer.svg" },
  { id: 3, name: "Insulated bottle", price: 39, image: "/images/bottle.svg" },
];

async function slowOrigin() {
  await new Promise((resolve) => setTimeout(resolve, ORIGIN_DELAY_MS));
  return new Response(JSON.stringify({ products, generatedAt: new Date().toISOString() }), {
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${TTL_SECONDS}`,
    },
  });
}

const html = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const colo = request.cf?.colo ?? "local";
    // One cache entry for the catalog: query strings and other paths don't change the key.
    const cacheKey = new Request(`${url.origin}/api/products`, { method: "GET" });

    // Storefront page (Workers box).
    if (url.pathname === "/") return html(PAGE);

    // CDN box: "cache hits never reach AWS". Cache API, per data center.
    if (url.pathname === "/api/products") {
      let response = await caches.default.match(cacheKey);
      let status = "HIT";
      if (!response) {
        status = "MISS";
        response = await slowOrigin();
        ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      }
      const out = new Response(response.body, response);
      out.headers.set("x-cache", status);
      out.headers.set("x-colo", colo);
      return out;
    }

    // Clears the catalog from this data center only. See README for why it's public.
    if (url.pathname === "/api/purge" && request.method === "POST") {
      const purged = await caches.default.delete(cacheKey);
      return Response.json({ purged, colo });
    }

    // R2 box: product images read straight from the bucket through the binding.
    if (url.pathname.startsWith("/images/")) {
      const key = url.pathname.slice("/images/".length);
      if (!/^[a-z0-9-]+\.svg$/.test(key)) return new Response("Not found", { status: 404 });
      const object = await env.IMAGES.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers); // content-type stored at upload
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=3600");
      headers.set("x-source", "r2");
      return new Response(object.body, { headers });
    }

    // Access box. Cloudflare Access sits in front of /admin only (configured in the dashboard).
    // Access checks identity at the edge before the request reaches this code.
    if (url.pathname === "/admin") {
      const email = request.headers.get("cf-access-authenticated-user-email");
      const hasJwt = request.headers.has("cf-access-jwt-assertion");
      return html(adminPage({ email, hasJwt }));
    }

    // Target for the rate-limiting rule. There are no accounts; every login fails.
    if (url.pathname === "/login") {
      if (request.method === "POST") {
        return Response.json({ ok: false, message: "Demo form: no accounts exist." }, { status: 401 });
      }
      return html(LOGIN_PAGE);
    }

    // Unknown paths return 404, so a WAF block (403) is easy to tell apart.
    return new Response("Not found", { status: 404 });
  },
};
