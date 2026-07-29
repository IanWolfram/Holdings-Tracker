import { encrypt, decrypt } from "@/lib/crypto/tokenCipher";

/**
 * Pack/unpack an AES-256-GCM blob as a single base64 JSON string so it can
 * live in an existing text column without a schema migration.
 */
export function sealSecret(plaintext: string): string {
  const blob = encrypt(plaintext);
  const payload = {
    v: blob.keyVersion,
    iv: blob.iv.toString("base64"),
    t: blob.authTag.toString("base64"),
    c: blob.ciphertext.toString("base64"),
  };
  return "enc:v1:" + Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function unsealSecret(stored: string): string {
  if (!stored.startsWith("enc:v1:")) {
    // Legacy plaintext row — return as-is (will be rotated on next save).
    return stored;
  }
  const json = Buffer.from(stored.slice("enc:v1:".length), "base64").toString("utf8");
  const payload = JSON.parse(json) as { v: number; iv: string; t: string; c: string };
  return decrypt({
    keyVersion: payload.v,
    iv: Buffer.from(payload.iv, "base64"),
    authTag: Buffer.from(payload.t, "base64"),
    ciphertext: Buffer.from(payload.c, "base64"),
  });
}