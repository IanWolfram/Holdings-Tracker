/**
 * One-time E*Trade OAuth 1.0a authorization flow.
 * Writes tokens to .env.local for initial setup.
 * In production, tokens are managed per-user via /api/etrade/auth.
 *
 * Usage:
 *   node scripts/etrade-auth.mjs
 *
 * Prerequisites:
 *   - ETRADE_CONSUMER_KEY and ETRADE_CONSUMER_SECRET set in .env.local
 *   - Run: npm install dotenv (if not already installed)
 */

import { createHmac } from "crypto";
import { createInterface } from "readline/promises";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync, exec } from "child_process";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const CONSUMER_KEY = process.env.ETRADE_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.ETRADE_CONSUMER_SECRET;
const IS_SANDBOX = process.env.ETRADE_ENV === "sandbox";

if (!CONSUMER_KEY || !CONSUMER_SECRET) {
  console.error(
    "Error: ETRADE_CONSUMER_KEY and ETRADE_CONSUMER_SECRET must be set in .env.local"
  );
  process.exit(1);
}

const AUTH_BASE_URL = IS_SANDBOX
  ? "https://apisb.etrade.com"
  : "https://api.etrade.com";

// Minimal OAuth 1.0a implementation (no npm package needed in this script)
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function buildOAuthHeader(method, url, oauthParams, tokenSecret = "") {
  const params = { ...oauthParams };
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(CONSUMER_SECRET)}&${percentEncode(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const allParams = { ...params, oauth_signature: signature };
  const headerValue =
    "OAuth " +
    Object.keys(allParams)
      .sort()
      .map((k) => `${k}="${percentEncode(allParams[k])}"`)
      .join(", ");

  return headerValue;
}

function nonce() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function step1_requestToken() {
  const url = `${AUTH_BASE_URL}/oauth/request_token`;
  const oauthParams = {
    oauth_callback: "oob",
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const authHeader = buildOAuthHeader("GET", url, oauthParams);

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Request token failed ${res.status}: ${body}`);

  const params = new URLSearchParams(body);
  return {
    token: params.get("oauth_token"),
    tokenSecret: params.get("oauth_token_secret"),
  };
}

async function step3_accessToken(requestToken, requestTokenSecret, verifier) {
  const url = `${AUTH_BASE_URL}/oauth/access_token`;
  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: requestToken,
    oauth_verifier: verifier,
    oauth_version: "1.0",
  };

  const authHeader = buildOAuthHeader("GET", url, oauthParams, requestTokenSecret);

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Access token failed ${res.status}: ${body}`);

  const params = new URLSearchParams(body);
  return {
    token: params.get("oauth_token"),
    tokenSecret: params.get("oauth_token_secret"),
  };
}

function updateEnvLocal(key, value) {
  const path = resolve(process.cwd(), ".env.local");
  let content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  writeFileSync(path, content);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log("\n=== E*Trade OAuth Authorization ===\n");
console.log(`Environment: ${IS_SANDBOX ? "SANDBOX" : "LIVE"}\n`);

try {
  console.log("Step 1: Requesting OAuth request token...");
  const { token, tokenSecret } = await step1_requestToken();
  console.log(`  Request token: ${token}\n`);

  const authUrl = `https://us.etrade.com/e/t/etws/authorize?key=${CONSUMER_KEY}&token=${token}`;
  console.log("Step 2: Authorizing in your browser...");
  console.log(`  URL: ${authUrl}\n`);

  // Automatically open the browser
  try {
    const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${openCmd} "${authUrl}"`);
  } catch (err) {
    // Ignore errors opening browser
  }

  console.log("Step 3: Waiting for verifier code...");
  console.log("👉 Please log in. Once you see the 5-character code, just COPY it (Cmd+C).");
  console.log("   I will detect it automatically from your clipboard.\n");

  let verifier = "";
  
  // Try to get verifier from clipboard (Mac only for now, falls back to manual)
  if (process.platform === "darwin") {
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes
    
    process.stdout.write("Searching clipboard... ");
    
    while (Date.now() - startTime < timeout) {
      try {
        const clipboard = execSync("pbpaste", { encoding: "utf8" }).trim();
        // E*Trade verifiers are 5 characters, alphanumeric
        if (/^[A-Z0-9]{5}$/.test(clipboard)) {
          verifier = clipboard;
          console.log(`\n✅ Found code in clipboard: ${verifier}`);
          break;
        }
      } catch (e) {}
      
      process.stdout.write(".");
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log("");
  }

  if (!verifier) {
    verifier = await rl.question("Could not find code in clipboard. Please enter it manually: ");
  }
  
  rl.close();

  console.log("\nStep 4: Exchanging for access token...");
  const access = await step3_accessToken(token, tokenSecret, verifier.trim());

  console.log("\n✅ Success! Writing tokens to .env.local...");
  updateEnvLocal("ETRADE_OAUTH_TOKEN", access.token);
  updateEnvLocal("ETRADE_OAUTH_TOKEN_SECRET", access.tokenSecret);

  console.log("\nTokens written to .env.local successfully.");
  console.log("You can now start the dev server: npm run dev\n");
} catch (err) {
  rl.close();
  console.error("\n❌ Auth failed:", err.message);
  process.exit(1);
}
