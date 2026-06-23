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
  /** Default x-axis window for PositionCard graphs (e.g. "6M", "1Y"). */
  defaultTimescale: string;
  /** Max age (days) for analyzed news cards to appear in the visible stack. */
  analyzedMaxAgeDays: number;
}

export interface IAccountInfoProvider {
  getAccountInfo(userId: string): Promise<AccountInfo>;
  getPreferences(userId: string): Promise<UserPreferences>;
  updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<UserPreferences>;
}