const { execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3000", 10);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "web-dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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

console.log("Building Expo web version...");
console.log("This may take 1-2 minutes on first run.");

try {
  execSync("pnpm exec expo export --platform web --output-dir web-dist --clear", {
    stdio: "inherit",
    cwd: projectRoot,
    env: {
      ...process.env,
      EXPO_PUBLIC_DOMAIN: process.env.REPLIT_DEV_DOMAIN || process.env.EXPO_PUBLIC_DOMAIN || "localhost",
      EXPO_PUBLIC_REPL_ID: process.env.REPL_ID || process.env.EXPO_PUBLIC_REPL_ID || "",
    },
  });
} catch (err) {
  console.error("Web export failed:", err.message);
  process.exit(1);
}

console.log(`Web build complete. Starting server on port ${PORT}...`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost`);
  let urlPath = url.pathname;

  let filePath = path.normalize(path.join(distDir, urlPath));

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    });
    res.end(fs.readFileSync(filePath));
    return;
  }

  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    });
    res.end(fs.readFileSync(indexPath));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DownTime web app running on port ${PORT}`);
  console.log(`Open in browser: http://localhost:${PORT}`);
});
