const { spawn } = require("child_process");

// Replit's public HTTPS domain (no protocol)
const domain =
  process.env.REPLIT_DEV_DOMAIN ||
  process.env.REPLIT_INTERNAL_APP_DOMAIN ||
  process.env.EXPO_PUBLIC_DOMAIN;

if (!domain) {
  console.error("No Replit domain found (REPLIT_DEV_DOMAIN).");
  process.exit(1);
}

// Replit maps the first opened port to the Preview / public domain.
const PORT = process.env.PORT || "8081";

console.log(`\n  Web preview:   https://${domain}`);
console.log(`  Device URL:    exp+://${domain}   (dev client / Expo Go)\n`);

const env = {
  ...process.env,
  PORT,
  // Make Metro advertise the public domain to devices instead of localhost
  EXPO_PACKAGER_PROXY_URL: `https://${domain}`,
  REACT_NATIVE_PACKAGER_HOSTNAME: domain,
  EXPO_DEVTOOLS_LISTEN_ADDRESS: "0.0.0.0",
  CI: "1", // stops Expo from trying to open an interactive prompt
};

const child = spawn(
  "pnpm",
  [
    "exec",
    "expo",
    "start",
    "--dev-client",   // serve dev-client compatible bundles
    "--web",          // also serve web (renders in Preview)
    "--port", PORT,
    "--host", "lan",  // bind 0.0.0.0 so Replit can expose it
  ],
  { stdio: "inherit", env }
);

const stop = () => { child.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGHUP", stop);