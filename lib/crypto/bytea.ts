import { encrypt, decrypt } from "@/lib/crypto/tokenCipher";

/**
 * supabase-js returns bytea columns as PostgreSQL hex strings ("\x...") in
 * JSON responses, NOT as Buffers/Uint8Arrays. And on write, sending raw Buffer
 * values gets JSON.stringify'd to `{type:"Buffer",data:[...]}` which is not a
 * valid bytea literal. We normalize to hex strings in both directions.
 */
export function toByteaHex(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

export function fromBytea(value: unknown): Buffer {
  if (value == null) throw new Error("bytea value is null");
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
    if (value.startsWith("0x")) return Buffer.from(value.slice(2), "hex");
    // Fallback: try base64
    return Buffer.from(value, "base64");
  }
  // Sometimes serialized as { type: 'Buffer', data: [...] }
  if (typeof value === "object" && value !== null && "data" in (value as Record<string, unknown>)) {
    const data = (value as { data: unknown }).data;
    if (Array.isArray(data)) return Buffer.from(data as number[]);
  }
  throw new Error(`Unsupported bytea value shape: ${typeof value}`);
}

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