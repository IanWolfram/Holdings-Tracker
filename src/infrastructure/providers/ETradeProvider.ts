import OAuth from "oauth-1.0a";
import crypto from "crypto";
import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";
import type { Position } from "@/types/position.types";
import { mapRawPosition } from "@/src/mappers/positionMapper";

export interface ETradeConfig {
  consumerKey: string;
  consumerSecret: string;
  oauthToken: string;
  oauthTokenSecret: string;
  baseUrl: string;
  authBaseUrl: string;
}

export class ETradeProvider implements IBrokerProvider {
  private cachedAccountIdKeys: string[] = [];
  private accountIdKeysExpiresAt = 0;

  constructor(private readonly cfg: ETradeConfig) {}

  private buildOAuth(): OAuth {
    return new OAuth({
      consumer: { key: this.cfg.consumerKey, secret: this.cfg.consumerSecret },
      signature_method: "HMAC-SHA1",
      hash_function(baseString, key) {
        return crypto.createHmac("sha1", key).update(baseString).digest("base64");
      },
    });
  }

  private accessToken(): OAuth.Token {
    return { key: this.cfg.oauthToken, secret: this.cfg.oauthTokenSecret };
  }

  /** oauth-1.0a includes realm="" by default; E*Trade rejects that field entirely. */
  private toHeader(oauth: OAuth, data: OAuth.Authorization): { Authorization: string } {
    const header = oauth.toHeader(data);
    header.Authorization = header.Authorization.replace(/^OAuth realm="[^"]*",\s*/, "OAuth ");
    return header;
  }

  private static readonly ACCOUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  private async fetchAccountIdKeys(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedAccountIdKeys.length > 0 && now < this.accountIdKeysExpiresAt) {
      return this.cachedAccountIdKeys;
    }

    const oauth = this.buildOAuth();
    const url = `${this.cfg.baseUrl}/v1/accounts/list.json`;
    const headers = this.toHeader(oauth, oauth.authorize({ url, method: "GET" }, this.accessToken()));

    const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Accounts list failed ${res.status}: ${body}`);
    }

    const json = await res.json();
    const accounts = json?.AccountListResponse?.Accounts?.Account ?? [];
    if (accounts.length === 0) throw new Error("No E*Trade accounts found");

    this.cachedAccountIdKeys = accounts.map((a: any) => a.accountIdKey as string);
    this.accountIdKeysExpiresAt = now + ETradeProvider.ACCOUNT_CACHE_TTL_MS;
    return this.cachedAccountIdKeys;
  }

  async getPositions(): Promise<Position[]> {
    const accountIdKeys = await this.fetchAccountIdKeys();
    const oauth = this.buildOAuth();

    const allRawPositions: Position[] = [];

    // Fetch from all accounts in parallel
    const results = await Promise.allSettled(
      accountIdKeys.map(async (key) => {
        const url = `${this.cfg.baseUrl}/v1/accounts/${key}/portfolio.json`;
        const headers = this.toHeader(oauth, oauth.authorize({ url, method: "GET" }, this.accessToken()));

        const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
        if (!res.ok) {
          const body = await res.text();
          console.warn(`[ETradeProvider] Portfolio fetch failed for account ${key}: ${res.status} ${body}`);
          return [];
        }

        const json = await res.json();
        const accountPortfolios = json?.PortfolioResponse?.AccountPortfolio ?? [];
        const positions: Position[] = [];

        for (const ap of accountPortfolios) {
          for (const pos of ap?.Position ?? []) {
            positions.push(mapRawPosition(pos));
          }
        }
        return positions;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allRawPositions.push(...result.value);
      }
    }

    // Deduplicate by ticker — sandbox sometimes returns the same symbol across accounts
    const seen = new Set<string>();
    return allRawPositions.filter((p) => {
      if (seen.has(p.ticker)) return false;
      seen.add(p.ticker);
      return true;
    });
  }
}
