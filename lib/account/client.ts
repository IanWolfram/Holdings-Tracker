import type { AccountInfo, UserPreferences } from "@/src/domain/interfaces/IAccountInfoProvider";

export interface MeResponse {
  account: AccountInfo;
  preferences: UserPreferences;
  etrade: { env: string; expiresAt: string | null };
}

export interface IAccountClient {
  getMe(): Promise<MeResponse>;
  updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences>;
  signOut(): Promise<void>;
}

export class HttpAccountClient implements IAccountClient {
  async getMe(): Promise<MeResponse> {
    const res = await fetch("/api/account/me");
    if (!res.ok) throw new Error(`getMe failed: ${res.status}`);
    return res.json();
  }

  async updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updatePreferences failed: ${res.status}`);
    return res.json();
  }

  async signOut(): Promise<void> {
    const res = await fetch("/api/account/signout", { method: "POST" });
    if (!res.ok) throw new Error(`signOut failed: ${res.status}`);
  }
}