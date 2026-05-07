export interface AccountInfo {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface UserPreferences {
  cronOptIn: boolean;
  aiModel: string | null;
  vaultEnabled: boolean;
}

export interface IAccountInfoProvider {
  getAccountInfo(userId: string): Promise<AccountInfo>;
  getPreferences(userId: string): Promise<UserPreferences>;
  updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<UserPreferences>;
  getEtradeTokenExpiry(
    userId: string,
  ): Promise<{ expiresAt: string | null }>;
}