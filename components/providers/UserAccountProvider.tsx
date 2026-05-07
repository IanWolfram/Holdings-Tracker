"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { IAccountClient, MeResponse } from "@/lib/account/client";
import { HttpAccountClient } from "@/lib/account/client";
import type { UserPreferences } from "@/src/domain/interfaces/IAccountInfoProvider";

interface UserAccountState {
  account: MeResponse["account"] | null;
  preferences: UserPreferences | null;
  etradeExpiry: { env: string; expiresAt: string | null } | null;
  refresh: () => Promise<void>;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const UserAccountContext = createContext<UserAccountState | null>(null);

export function UserAccountProvider({
  client: clientProp,
  children,
}: {
  client?: IAccountClient;
  children: React.ReactNode;
}) {
  const client = clientProp ?? new HttpAccountClient();

  const [account, setAccount] = useState<MeResponse["account"] | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [etradeExpiry, setEtradeExpiry] = useState<{
    env: string;
    expiresAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.getMe();
      setAccount(data.account);
      setPreferences(data.preferences);
      setEtradeExpiry(data.etrade);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpdatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (!preferences) return;
      // Optimistic update
      setPreferences((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        const updated = await client.updatePreferences(patch);
        setPreferences(updated);
      } catch {
        // Revert on failure
        setPreferences(preferences);
      }
    },
    [client, preferences],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await client.signOut();
    } catch {
      /* ignore */
    }
  }, [client]);

  return (
    <UserAccountContext.Provider
      value={{
        account,
        preferences,
        etradeExpiry,
        refresh,
        updatePreferences: handleUpdatePreferences,
        signOut: handleSignOut,
        loading,
        error,
      }}
    >
      {children}
    </UserAccountContext.Provider>
  );
}

export function useAccount(): UserAccountState {
  const ctx = useContext(UserAccountContext);
  if (!ctx) throw new Error("useAccount must be used within UserAccountProvider");
  return ctx;
}