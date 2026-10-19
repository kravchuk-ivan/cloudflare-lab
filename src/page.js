// HTML for the lab. Kept apart from the router so index.js stays short.

const STYLE = `<style>
  body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1d1d1f}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:18px;margin:32px 0 4px} p{color:#555;margin:0 0 16px}
  button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #c9c9c9;background:#fff;cursor:pointer;margin-right:8px}
  button.primary{background:#f38020;border-color:#f38020;color:#fff}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-variant-numeric:tabular-nums}
  td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee} th{font-weight:600;color:#555}
  .HIT{color:#1a7f37;font-weight:600} .MISS{color:#b35900;font-weight:600}
  .products{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-top:16px}
  .products figure{margin:0;border:1px solid #eee;border-radius:10px;padding:12px}
  .products img{width:100%;height:auto;display:block} figcaption{margin-top:8px}
  small{color:#777} code{font-size:14px} label{display:block;margin:12px 0 4px} input{font:inherit;padding:6px 8px;width:260px}
</style>`;

const head = (title) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${STYLE}</head><body>`;

export const PAGE = `${head("Cloudflare lab")}
<h1>Cloudflare lab</h1>
<p>A small storefront on Cloudflare's developer platform. The "AWS origin" behind it is simulated:
an 800 ms delay inside the Worker.</p>

<h2>What's running here</h2>
<table>
  <thead><tr><th>Piece</th><th>Where</th><th>Status</th></tr></thead>
  <tbody>
    <tr><td>Edge cache</td><td><code>/api/products</code></td><td>Real Cache API. The AWS origin is simulated.</td></tr>
    <tr><td>Product images</td><td><code>/images/*</code></td><td>Real R2 bucket</td></tr>
    <tr><td>WAF custom rule</td><td><code>/.env</code>, <code>/wp-login.php</code></td><td>Real, returns 403</td></tr>
    <tr><td>Rate limiting</td><td><a href="/login">/login</a></td><td>Real, returns 429 after repeated attempts</td></tr>
    <tr><td>Client-Side Security</td><td>this page</td><td>Real script monitoring (CSP report-only header on a sample of page loads)</td></tr>
    <tr><td>Access</td><td><a href="/admin">/admin</a></td><td>Real, login required</td></tr>
    <tr><td>Tunnel, Hyperdrive, AWS</td><td>–</td><td>Described only, not built yet</td></tr>
  </tbody>
</table>

<h2>Products</h2>
<p><small>Images are served from an R2 bucket. Catalog generated at <span id="generated">…</span>.</small></p>
<div class="products" id="products"></div>

<h2>Edge cache</h2>
<p>The first request is a cache MISS and waits for the origin. Repeats are served from the Cloudflare
data center closest to you until the 60-second TTL expires.</p>
<button class="primary" id="go">Fetch product catalog</button><button id="purge">Purge cache</button>
<table><thead><tr><th>#</th><th>Cache</th><th>Time</th><th>Served from</th></tr></thead><tbody id="log"></tbody></table>
<p style="margin-top:16px"><small>The Cache API stores a copy per data center, so a purge here clears the copy in the location serving you.
Times are measured in your browser, end to end.</small></p>

<!-- Third-party script, pinned with Subresource Integrity: the browser refuses it if its contents change. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.23/dayjs.min.js"
  integrity="sha384-1Ft4/JTNbt7S/44V0himpcjx+YfQ1a6W6SYBJMr94ba6jwZhWoWoLaZsMmtJILgq"
  crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
let n = 0;
const log = document.getElementById("log");
function row(cells){const tr=document.createElement("tr");tr.innerHTML=cells;log.prepend(tr);}
async function fetchCatalog(){
  const t0 = performance.now();
  const r = await fetch("/api/products", { cache: "no-store" });
  const data = await r.json();
  const ms = Math.round(performance.now() - t0);
  const c = r.headers.get("x-cache");
  row("<td>"+(++n)+"</td><td class='"+c+"'>"+c+"</td><td>"+ms+" ms</td><td>"+r.headers.get("x-colo")+"</td>");
  return data;
}
function render(data){
  document.getElementById("generated").textContent =
    window.dayjs ? dayjs(data.generatedAt).format("HH:mm:ss") : data.generatedAt;
  document.getElementById("products").innerHTML = data.products.map(p =>
    "<figure><img src='"+p.image+"' alt='"+p.name+"' width='240' height='180'><figcaption>"+p.name+" · $"+p.price+"</figcaption></figure>").join("");
}
fetchCatalog().then(render);
document.getElementById("go").onclick = () => fetchCatalog().then(render);
document.getElementById("purge").onclick = async () => {
  const r = await fetch("/api/purge", { method: "POST" });
  const j = await r.json();
  row("<td>-</td><td colspan='3'>Purged in "+j.colo+(j.purged?"":" (nothing cached)")+"</td>");
};
</script></body></html>`;

export const LOGIN_PAGE = `${head("Sign in · Cloudflare lab")}
<h1>Sign in</h1>
<p>Demo form for the rate-limiting rule. No accounts exist, so every attempt fails with 401.
Repeated attempts from one IP get 429 from Cloudflare before they reach the Worker.</p>
<form method="post" action="/login">
  <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="off">
  <label for="password">Password</label><input id="password" name="password" type="password">
  <p style="margin-top:16px"><button class="primary" type="submit">Sign in</button></p>
</form></body></html>`;

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function adminPage({ email, hasJwt }) {
  const status = email
    ? `<p>Cloudflare Access let you in as <b>${escapeHtml(email)}</b>.</p>`
    : `<p><b>Access is not configured for this path yet.</b> Anyone can see this page.</p>`;
  return `${head("Admin · Cloudflare lab")}
<h1>Admin</h1>
${status}
<table>
  <tr><th>Header</th><th>Present</th></tr>
  <tr><td>cf-access-authenticated-user-email</td><td>${email ? "yes" : "no"}</td></tr>
  <tr><td>cf-access-jwt-assertion</td><td>${hasJwt ? "yes" : "no"}</td></tr>
</table>
<p style="margin-top:16px"><small>Access checks identity at Cloudflare's edge, so unauthenticated requests never reach this Worker.
A production origin would also validate the JWT.</small></p>
</body></html>`;
}
