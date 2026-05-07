import type {
  AccountInfo,
  UserPreferences,
  IAccountInfoProvider,
} from "@/src/domain/interfaces/IAccountInfoProvider";

/** In-memory preferences for Personal Mode — resets on process restart. */
const devPreferences: UserPreferences = {
  cronOptIn: true,
  aiModel: null,
  vaultEnabled: true,
};

export class DevAccountInfoProvider implements IAccountInfoProvider {
  async getAccountInfo(_userId: string): Promise<AccountInfo> {
    return {
      id: "dev-user-id",
      email: "dev@local",
      displayName: "Developer",
      createdAt: "2025-01-01T00:00:00Z",
      lastSignInAt: null,
    };
  }

  async getPreferences(_userId: string): Promise<UserPreferences> {
    return { ...devPreferences };
  }

  async updatePreferences(
    _userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    if (patch.cronOptIn !== undefined) devPreferences.cronOptIn = patch.cronOptIn;
    if (patch.aiModel !== undefined) devPreferences.aiModel = patch.aiModel;
    if (patch.vaultEnabled !== undefined) devPreferences.vaultEnabled = patch.vaultEnabled;
    return { ...devPreferences };
  }

  async getEtradeTokenExpiry(
    _userId: string,
  ): Promise<{ expiresAt: string | null }> {
    // In Personal Mode tokens expire at midnight ET per E*TRADE policy.
    // The actual env-driven token is read from .env.local but the
    // expires_at is not stored — return null so the client falls back
    // to the midnight-ET heuristic.
    return { expiresAt: null };
  }
}