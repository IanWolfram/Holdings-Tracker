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
  private cachedAccountIdKey: string | null = null;
  private accountIdKeyExpiresAt = 0;

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

  private async fetchAccountIdKey(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccountIdKey && now < this.accountIdKeyExpiresAt) {
      return this.cachedAccountIdKey;
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

    this.cachedAccountIdKey = accounts[0].accountIdKey as string;
    this.accountIdKeyExpiresAt = now + ETradeProvider.ACCOUNT_CACHE_TTL_MS;
    return this.cachedAccountIdKey;
  }

  async getPositions(): Promise<Position[]> {
    const accountIdKey = await this.fetchAccountIdKey();
    const oauth = this.buildOAuth();
    const url = `${this.cfg.baseUrl}/v1/accounts/${accountIdKey}/portfolio.json`;
    const headers = this.toHeader(oauth, oauth.authorize({ url, method: "GET" }, this.accessToken()));

    const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Portfolio fetch failed ${res.status}: ${body}`);
    }

    const json = await res.json();
    const accountPortfolios = json?.PortfolioResponse?.AccountPortfolio ?? [];

    const raw: Position[] = [];
    for (const ap of accountPortfolios) {
      for (const pos of ap?.Position ?? []) {
        raw.push(mapRawPosition(pos));
      }
    }

    // Deduplicate by ticker — sandbox sometimes returns the same symbol multiple times
    const seen = new Set<string>();
    return raw.filter((p) => {
      if (seen.has(p.ticker)) return false;
      seen.add(p.ticker);
      return true;
    });
  }
}
