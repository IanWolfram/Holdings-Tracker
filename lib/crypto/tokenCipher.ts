import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Resolve the encryption key from env. Supports key rotation via
 * ETRADE_TOKEN_ENC_KEYS (comma-separated, key version = 1-based index).
 * Falls back to ETRADE_TOKEN_ENC_KEY (single key, version 1).
 */
function getKey(version: number): Buffer {
  const keys = process.env.ETRADE_TOKEN_ENC_KEYS?.split(",").map((k) => k.trim());
  if (keys && keys.length >= version && version >= 1) {
    return Buffer.from(keys[version - 1], "hex");
  }
  const single = process.env.ETRADE_TOKEN_ENC_KEY;
  if (!single) throw new Error("ETRADE_TOKEN_ENC_KEY (or ETRADE_TOKEN_ENC_KEYS) is required");
  if (version !== 1) throw new Error(`Key version ${version} not found in ETRADE_TOKEN_ENC_KEYS`);
  return Buffer.from(single, "hex");
}

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns the ciphertext, IV, auth tag, and key version for storage.
 */
export function encrypt(plaintext: string, keyVersion = 1): EncryptedBlob {
  const key = getKey(keyVersion);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag, keyVersion };
}

/**
 * Decrypt an EncryptedBlob back to a plaintext string.
 * Throws if the auth tag verification fails (tampered ciphertext).
 */
export function decrypt(blob: EncryptedBlob): string {
  const key = getKey(blob.keyVersion);
  const decipher = createDecipheriv(ALGORITHM, key, blob.iv);
  decipher.setAuthTag(blob.authTag);
  const plaintext = Buffer.concat([
    decipher.update(blob.ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * Convenience: encrypt to Buffers suitable for Postgres bytea columns.
 */
export function encryptForStorage(plaintext: string, keyVersion = 1) {
  const blob = encrypt(plaintext, keyVersion);
  return {
    ciphertext: blob.ciphertext,
    iv: blob.iv,
    authTag: blob.authTag,
    keyVersion: blob.keyVersion,
  };
}

/**
 * Convenience: decrypt from values retrieved from Postgres bytea columns.
 * Handles both Buffer and Uint8Array (node-postgres returns Uint8Array).
 */
export function decryptFromStorage(
  ciphertext: Buffer | Uint8Array,
  iv: Buffer | Uint8Array,
  authTag: Buffer | Uint8Array,
  keyVersion: number,
): string {
  return decrypt({
    ciphertext: Buffer.from(ciphertext),
    iv: Buffer.from(iv),
    authTag: Buffer.from(authTag),
    keyVersion,
  });
}