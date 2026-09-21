// Integration check against running local frontend/backend; no fixtures written.
// PROXY_TEST_USERNAME / PROXY_TEST_PASSWORD supply an existing test account.
import assert from "node:assert/strict";

const frontend = process.env.PROXY_TEST_FRONTEND || "http://127.0.0.1:3000";
const backend = process.env.PROXY_TEST_BACKEND || "http://127.0.0.1:8000";
const username = process.env.PROXY_TEST_USERNAME;
const password = process.env.PROXY_TEST_PASSWORD;
assert(username && password, "Set PROXY_TEST_USERNAME and PROXY_TEST_PASSWORD.");

async function request(origin, path, token, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    redirect: "manual",
    signal: AbortSignal.timeout(30000)
  });
  assert(!(response.status >= 300 && response.status < 400), `Unexpected redirect: ${path} -> ${response.headers.get("location")}`);
  return response;
}

const login = await request(frontend, "/api/auth/login", null, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password })
});
assert.equal(login.status, 200, "Login through frontend proxy failed");
let { access_token: token, refresh_token: refresh } = await login.json();
assert.equal((await request(frontend, "/api/auth/me", token)).status, 200);

// Discover canonical collection routes from OpenAPI to detect newly added
// routes that also need slash normalization in the frontend proxy.
const schema = await (await request(backend, "/openapi.json")).json();
const paths = Object.keys(schema.paths).filter((p) => p.endsWith("/") && schema.paths[p].get);
for (const template of paths) {
  const canonical = template.replace(/\{[^}]+\}/g, "1");
  const direct = await request(backend, canonical, token);
  const expectedStatus = direct.status;
  await direct.arrayBuffer();
  for (const path of [canonical, canonical.slice(0, -1)]) {
    const response = await request(frontend, `/api${path}`, token);
    assert.equal(response.status, expectedStatus, `Authorization/status changed through proxy: ${path}`);
    await response.arrayBuffer();
  }
}
assert.equal((await request(frontend, "/api/jadwal-ujian")).status, 401, "Anonymous access must remain denied");
const rotated = await request(frontend, "/api/auth/refresh-token", null, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refresh_token: refresh })
});
assert.equal(rotated.status, 200, "Refresh through proxy failed");
token = (await rotated.json()).access_token;
assert.equal((await request(frontend, "/api/auth/me", token)).status, 200);
console.log(`PASS ${username}: login, ${paths.length} collections with/without slash, anonymous denial, refresh.`);
