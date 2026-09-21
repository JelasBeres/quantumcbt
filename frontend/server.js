/* Single-origin proxy + Next server (ngrok friendly).
 * - external port (default 3000) fronts the app
 * - /api/* and /uploads/*  -> proxied to BACKEND_URL forwarding ALL headers (Authorization included)
 * - everything else        -> proxied to the Next.js child running on an internal port
 */
const http = require("http");
const { spawn } = require("child_process");

const EXTERNAL_PORT = Number(process.env.PORT || 3000);
const NEXT_INTERNAL_PORT = Number(process.env.NEXT_INTERNAL_PORT || 3100);
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");
const backend = new URL(BACKEND_URL);

function rewriteLocation(location, req, target, stripPrefix) {
  // Backend/Next redirects (e.g. FastAPI trailing-slash 307s) return an
  // absolute Location pointing at the internal target (localhost:8000 or
  // 127.0.0.1:3100). If forwarded as-is, the browser tries to follow the
  // redirect against that internal-only address instead of the public
  // ngrok/proxy origin, and the request silently fails client-side.
  let parsed;
  try {
    parsed = new URL(location, `http://${target.host}`);
  } catch {
    return location;
  }
  let path = parsed.pathname + parsed.search;
  if (stripPrefix && !path.startsWith(stripPrefix)) {
    path = stripPrefix + (path.startsWith("/") ? path : "/" + path);
  }
  const publicHost = req.headers["x-forwarded-host"] || req.headers.host;
  const publicProto = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  return `${publicProto}://${publicHost}${path}`;
}

function pipeTo(res, backendRes, req, target, stripPrefix) {
  const headers = { ...backendRes.headers };
  if (headers.location) {
    headers.location = rewriteLocation(headers.location, req, target, stripPrefix);
  }
  res.writeHead(backendRes.statusCode, headers);
  backendRes.pipe(res);
}

function proxyPass(req, res, target, path, method, headers, stripPrefix) {
  const upstream = http.request(
    { host: target.hostname, port: target.port, path, method, headers },
    (upRes) => pipeTo(res, upRes, req, target, stripPrefix)
  );
  upstream.on("error", () => fail(res, 502, "upstream error"));
  req.pipe(upstream);
}

function proxyTo(req, res, target, stripPrefix) {
  const headers = { ...req.headers };
  headers.host = target.host;
  // Preserve any upstream X-Forwarded-For (e.g. ngrok already recorded the
  // real client IP) and append this hop, instead of overwriting it. If we
  // overwrite with only a loopback address, uvicorn's ProxyHeadersMiddleware
  // treats every hop as trusted and sets request.client to (None, 0).
  const inbound = req.headers["x-forwarded-for"];
  const thisHop = req.socket.remoteAddress || "127.0.0.1";
  headers["x-forwarded-for"] = inbound ? `${inbound}, ${thisHop}` : thisHop;
  delete headers["x-real-ip"];
  headers["x-forwarded-host"] = req.headers.host || "localhost";
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";

  let path = req.url;
  if (stripPrefix && path.startsWith(stripPrefix)) {
    path = path.slice(stripPrefix.length);
    if (!path.startsWith("/")) path = "/" + path;
  }

  proxyPass(req, res, target, path, req.method, headers, stripPrefix);
}

function fail(res, code, msg) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ detail: msg }));
}

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(NEXT_INTERNAL_PORT)],
  { stdio: ["ignore", "pipe", "pipe"], cwd: __dirname }
);
next.stdout.on("data", (d) => process.stdout.write(d));
next.stderr.on("data", (d) => process.stderr.write(d));
next.on("exit", (code) => process.exit(code ?? 0));

const nextTarget = { hostname: "127.0.0.1", port: String(NEXT_INTERNAL_PORT), host: `127.0.0.1:${NEXT_INTERNAL_PORT}` };

const server = http.createServer((req, res) => {
  res.setHeader("x-powered-by", "cbt-proxy");
  if (req.url.startsWith("/api/")) {
    proxyTo(req, res, backend, "/api");
  } else if (req.url.startsWith("/uploads/")) {
    proxyTo(req, res, backend);
  } else {
    proxyTo(req, res, nextTarget);
  }
});

function poll(cb, tries = 0) {
  const r = http.get({ host: "127.0.0.1", port: NEXT_INTERNAL_PORT, path: "/" }, (res) => {
    res.resume();
    cb();
  });
  r.on("error", () => {
    if (tries > 60) {
      console.error("[proxy] Next did not start in time; exiting");
      process.exit(1);
    }
    setTimeout(() => poll(cb, tries + 1), 600);
  });
}

poll(() => {
  server.listen(EXTERNAL_PORT, () => {
    console.log(`[proxy] external :${EXTERNAL_PORT} -> Next :${NEXT_INTERNAL_PORT}, backend ${backend.origin}`);
  });
});
