/**
 * Diagnostic script to fetch and map E*Trade positions.
 * 
 * Usage: 
 *   node scripts/fetch-positions.mjs
 */

import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// 1. LOAD ENVIRONMENT
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
const OAUTH_TOKEN = process.env.ETRADE_OAUTH_TOKEN;
const OAUTH_TOKEN_SECRET = process.env.ETRADE_OAUTH_TOKEN_SECRET;
const IS_SANDBOX = process.env.ETRADE_ENV === "sandbox";

if (!CONSUMER_KEY || !CONSUMER_SECRET || !OAUTH_TOKEN || !OAUTH_TOKEN_SECRET) {
  console.error("Error: E*Trade credentials missing in .env.local. Run `npm run etrade:auth` first.");
  process.exit(1);
}

const BASE_URL = IS_SANDBOX ? "https://apisb.etrade.com" : "https://api.etrade.com";

// 2. OAUTH HELPERS
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

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(CONSUMER_SECRET)}&${percentEncode(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  const allParams = { ...params, oauth_signature: signature };
  return "OAuth " + Object.keys(allParams).sort().map((k) => `${k}="${percentEncode(allParams[k])}"`).join(", ");
}

function nonce() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function signedFetch(url, method = "GET") {
  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: OAUTH_TOKEN,
    oauth_version: "1.0",
  };

  const authHeader = buildOAuthHeader(method, url, oauthParams, OAUTH_TOKEN_SECRET);
  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API Error ${res.status}: ${body}`);
  }
  return res.json();
}

// 3. MAPPING LOGIC (The "turn them into position objects" part)
function mapRawPosition(pos) {
    return {
      ticker: pos.Product?.symbol ?? "UNKNOWN",
      description: pos.symbolDescription ?? pos.Product?.symbol ?? "UNKNOWN",
      quantity: Number(pos.quantity ?? 0),
      marketValue: Number(pos.marketValue ?? 0),
      gainLoss: Number(pos.totalGain ?? 0),
      pricePaid: Number(pos.pricePaid ?? 0),
      currentPrice: Number(pos.Quick?.lastTrade ?? 0),
    };
}

// 4. MAIN FLOW
async function run() {
  console.log("\n=== E*Trade Position Fetcher ===\n");
  console.log(`Environment: ${IS_SANDBOX ? "SANDBOX" : "LIVE"}`);
  console.log(`Endpoint:    ${BASE_URL}\n`);

  try {
    // Step A: Get Account ID
    console.log("Step 1: Fetching account list...");
    const accountList = await signedFetch(`${BASE_URL}/v1/accounts/list.json`);
    const accounts = accountList?.AccountListResponse?.Accounts?.Account ?? [];
    
    if (accounts.length === 0) throw new Error("No accounts found.");
    console.log(`  Found ${accounts.length} account(s).\n`);

    // Step B: Get Portfolio from ALL accounts
    const allPositions = [];
    for (const account of accounts) {
      const key = account.accountIdKey;
      console.log(`Step 2 [${account.accountDesc ?? key}]: Fetching positions...`);
      try {
        const portfolio = await signedFetch(`${BASE_URL}/v1/accounts/${key}/portfolio.json`);
        const accountPortfolios = portfolio?.PortfolioResponse?.AccountPortfolio ?? [];
        
        for (const ap of accountPortfolios) {
          for (const pos of ap.Position ?? []) {
            allPositions.push(mapRawPosition(pos));
          }
        }
      } catch (err) {
        console.warn(`  ⚠️ Failed to fetch account ${key}: ${err.message}`);
      }
    }

    // Step C: Display Results
    if (allPositions.length === 0) {
      console.log("\n⚠️ No positions found in any account.");
    } else {
      console.log(`\n✅ Success! Aggregated ${allPositions.length} positions across all accounts:\n`);
      console.table(allPositions);
    }

    if (IS_SANDBOX) {
      console.log("\n💡 NOTE: You are in SANDBOX mode. E*Trade returns sample data like MSFT and GLD.");
      console.log("   To see your actual holdings, you must use Production keys and set ETRADE_ENV=live.\n");
    }

  } catch (err) {
    console.error("\n❌ Error:", err.message);
  }
}

run();
