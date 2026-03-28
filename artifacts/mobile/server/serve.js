/**
 * Production web server for DownTime.
 * Serves the Expo web export from web-dist/ as a single-page application.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "web-dist");
const PORT = parseInt(process.env.PORT || "18115", 10);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  let urlPath = url.pathname;

  if (urlPath === "/status") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
    });
    res.end(fs.readFileSync(filePath));
    return;
  }

  const indexPath = path.join(STATIC_ROOT, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    });
    res.end(fs.readFileSync(indexPath));
    return;
  }

  res.writeHead(503, { "content-type": "text/plain" });
  res.end("App not built yet. Run the build step first.");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serving DownTime web app on port ${PORT}`);
  console.log(`Static root: ${STATIC_ROOT}`);
  if (!fs.existsSync(STATIC_ROOT)) {
    console.warn("WARNING: web-dist/ not found — run the build step first");
  }
});
