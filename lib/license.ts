import fs from "fs";
import path from "path";

const TRIAL_DAYS = 30;

interface LicenseState {
  firstLaunchAt?: string;
  licenseKey?: string;
  validatedAt?: string;
}

export interface LicenseStatus {
  isLicensed: boolean;
  trialExpired: boolean;
  daysRemaining: number;
}

function getUserDataPath(): string {
  return process.env.PULSE_USER_DATA_PATH ?? process.cwd();
}

function getLicensePath(): string {
  return path.join(getUserDataPath(), "license.json");
}

function readState(): LicenseState {
  const licensePath = getLicensePath();
  try {
    const raw = fs.readFileSync(licensePath, "utf-8");
    return JSON.parse(raw) as LicenseState;
  } catch {
    return {};
  }
}

function checksumSeed(input: string): string {
  const sum = [...input].reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), 0);
  return (sum % 1679616).toString(36).toUpperCase().padStart(4, "0").slice(-4);
}

export function isValidLicenseKeyFormat(key: string): boolean {
  const upper = key.trim().toUpperCase();
  const parts = upper.split("-");
  if (parts.length !== 4 || parts[0] !== "PULSE") return false;
  if (!parts.slice(1).every((part) => /^[A-Z0-9]{4}$/.test(part))) return false;
  const expected = checksumSeed(`${parts[0]}-${parts[1]}-${parts[2]}`);
  return expected === parts[3];
}

export function getLicenseStatus(): LicenseStatus {
  const state = readState();
  const isLicensed = Boolean(state.licenseKey && isValidLicenseKeyFormat(state.licenseKey));

  const firstLaunch = state.firstLaunchAt ? Date.parse(state.firstLaunchAt) : Date.now();
  const elapsedMs = Math.max(0, Date.now() - firstLaunch);
  const trialDaysUsed = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, TRIAL_DAYS - trialDaysUsed);
  const trialExpired = daysRemaining <= 0;

  return {
    isLicensed,
    trialExpired,
    daysRemaining,
  };
}

export function requirePremiumAccess(): { ok: true } | { ok: false; statusCode: number; error: string } {
  if (process.env.PULSE_DESKTOP !== "1") {
    return { ok: true };
  }

  const status = getLicenseStatus();
  if (status.isLicensed || !status.trialExpired) {
    return { ok: true };
  }

  return {
    ok: false,
    statusCode: 402,
    error: "Trial expired. A valid Pulse license key is required for this feature.",
  };
}
