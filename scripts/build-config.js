const fs = require("fs");
const path = require("path");

const isDev = process.env.TUNNEL_ENV === "development";
const serverUrl = isDev
  ? "https://debug-tool-test-server.onrender.com"
  : "https://debug-tool.onrender.com";

const content = `// Auto-generated config file - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Environment: ${isDev ? "DEVELOPMENT" : "PRODUCTION"}

export const TUNNEL_SERVER_URL = "${serverUrl}";
export const TUNNEL_ENV = "${isDev ? "development" : "production"}";
export const IS_DEVELOPMENT = ${isDev};
`;

const configPath = path.join(__dirname, "../src/config.ts");
fs.writeFileSync(configPath, content, "utf-8");

console.log(
  `✅ Config generated: ${isDev ? "DEVELOPMENT" : "PRODUCTION"} mode`,
);
console.log(`   Server URL: ${serverUrl}`);
