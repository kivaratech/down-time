const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function getDeploymentDomain() {
  const raw =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    "";

  if (!raw) {
    console.warn("WARNING: No deployment domain found, defaulting to localhost");
    return "localhost";
  }

  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

const domain = getDeploymentDomain();
const replId = process.env.REPL_ID || process.env.EXPO_PUBLIC_REPL_ID || "";

console.log("Building Expo web bundle...");
console.log(`Domain: ${domain}`);

try {
  execSync(
    "pnpm exec expo export --platform web --output-dir web-dist --clear",
    {
      stdio: "inherit",
      cwd: projectRoot,
      env: {
        ...process.env,
        EXPO_PUBLIC_DOMAIN: domain,
        EXPO_PUBLIC_REPL_ID: replId,
      },
    }
  );
  console.log("Web build complete!");
} catch (err) {
  console.error("Web build failed:", err.message);
  process.exit(1);
}
