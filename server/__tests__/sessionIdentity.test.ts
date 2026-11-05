import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { getRequestSessionKey, getSessionKey } from "../sessionIdentity";

describe("device session identity", () => {
  it("creates a stable one-way key for a valid device token", () => {
    const token = "a".repeat(64);
    expect(getSessionKey(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(getSessionKey(token)).not.toBe(token);
  });

  it("rejects malformed tokens and supports header arrays", () => {
    expect(getSessionKey("not-a-token")).toBeNull();
    expect(getRequestSessionKey(["b".repeat(64), "ignored"])).toBe(
      createHash("sha256").update("b".repeat(64)).digest("hex"),
    );
  });
});
