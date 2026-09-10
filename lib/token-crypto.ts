import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "@/lib/core";
import { requiredEnv } from "@/lib/env";

function tokenKey() {
  const supplied = requiredEnv("TOKEN_ENCRYPTION_KEY");
  const base64 = Buffer.from(supplied, "base64");
  const hex = Buffer.from(supplied, "hex");
  const key = base64.length === 32 ? base64 : hex.length === 32 ? hex : undefined;
  if (!key) {
    throw new AppError("The token encryption key must be a 32-byte base64 or hex value.", 503);
  }
  return key;
}

export function encryptToken(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new AppError("Stored Gmail connection is invalid.", 500);
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
