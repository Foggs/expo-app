import { createHash } from "crypto";

export function getSessionKey(token: unknown): string | null {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return createHash("sha256").update(token.toLowerCase()).digest("hex");
}

export function getRequestSessionKey(value: string | string[] | undefined): string | null {
  return getSessionKey(Array.isArray(value) ? value[0] : value);
}
