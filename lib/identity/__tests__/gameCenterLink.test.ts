import { describe, expect, it } from "vitest";
import type { GameCenterAuthResult, GameCenterIdentityProof } from "@/modules/game-center";
import {
  runGameCenterSignIn,
  type LinkDeviceResult,
  type StoredGameCenterLink,
} from "@/lib/identity/gameCenterLink";

const ALICE = "T:_alice";
const BOB = "T:_bob";

function proofFor(playerId: string): GameCenterIdentityProof {
  return { playerId, publicKeyUrl: "https://static.gc.apple.com/k.cer", signature: "c2ln", salt: "c2FsdA==", timestamp: "1" };
}

/** A fake device: a token, a stored link record, and a server that remembers device links. */
function fakeDevice(options: {
  auth: GameCenterAuthResult | "throws";
  stored?: StoredGameCenterLink | null;
  serverLinks?: Map<string, string>;
  linkFails?: boolean;
}) {
  const state = {
    token: "token-1",
    stored: options.stored ?? null,
    serverLinks: options.serverLinks ?? new Map<string, string>(),
    linkCalls: [] as string[],
    tokenCount: 1,
    rotations: 0,
  };
  const deps = {
    authenticate: async () => {
      if (options.auth === "throws") throw new Error("GameKit failed");
      return options.auth;
    },
    fetchProof: async () => {
      if (options.auth === "throws" || !options.auth.authenticated) throw new Error("not signed in");
      return proofFor(options.auth.playerId);
    },
    getStoredLink: async () => state.stored,
    setStoredLink: async (link: StoredGameCenterLink | null) => {
      state.stored = link;
    },
    rotateDeviceToken: async () => {
      state.rotations += 1;
      state.tokenCount += 1;
      state.token = `token-${state.tokenCount}`;
    },
    linkDevice: async (proof: GameCenterIdentityProof): Promise<LinkDeviceResult> => {
      state.linkCalls.push(state.token);
      if (options.linkFails) throw new Error("503: offline");
      const existing = state.serverLinks.get(state.token);
      if (existing && existing !== proof.playerId) return "device_linked_to_other_player";
      state.serverLinks.set(state.token, proof.playerId);
      return "linked";
    },
  };
  return { state, deps };
}

const signedIn = (playerId: string): GameCenterAuthResult => ({ authenticated: true, playerId, displayName: playerId });

describe("Game Center sign-in on a device", () => {
  it("links a first-time player and keeps the existing device token", async () => {
    const { state, deps } = fakeDevice({ auth: signedIn(ALICE) });
    const result = await runGameCenterSignIn(deps, { relinkWhenUnchanged: true });
    expect(result).toEqual({ status: "linked", displayName: ALICE, rotatedToken: false });
    expect(state.token).toBe("token-1");
    expect(state.serverLinks.get("token-1")).toBe(ALICE);
    expect(state.stored).toEqual({ playerId: ALICE, confirmed: true });
  });

  it("keeps the device identity for someone who never linked and declines", async () => {
    const { state, deps } = fakeDevice({ auth: { authenticated: false, reason: "declined" } });
    const result = await runGameCenterSignIn(deps, { relinkWhenUnchanged: true });
    expect(result).toEqual({ status: "declined", rotatedToken: false });
    expect(state.token).toBe("token-1");
    expect(state.linkCalls).toEqual([]);
  });

  it("gives the next person a fresh identity after the linked player signs out", async () => {
    const serverLinks = new Map([["token-1", ALICE]]);
    for (const reason of ["declined", "unavailable"] as const) {
      const { state, deps } = fakeDevice({
        auth: { authenticated: false, reason },
        stored: { playerId: ALICE, confirmed: true },
        serverLinks,
      });
      const result = await runGameCenterSignIn(deps, { relinkWhenUnchanged: false });
      expect(result).toEqual({ status: reason, rotatedToken: true });
      expect(state.token).not.toBe("token-1");
      expect(serverLinks.get(state.token)).toBeUndefined();
      expect(state.stored).toBeNull();
    }
  });

  it("also rotates after a link that may not have finished", async () => {
    const { state, deps } = fakeDevice({
      auth: { authenticated: false, reason: "declined" },
      stored: { playerId: ALICE, confirmed: false },
    });
    expect((await runGameCenterSignIn(deps, { relinkWhenUnchanged: true })).rotatedToken).toBe(true);
    expect(state.token).toBe("token-2");
  });

  it("never links a different Game Center player to the previous player's token", async () => {
    const serverLinks = new Map([["token-1", ALICE]]);
    const { state, deps } = fakeDevice({
      auth: signedIn(BOB),
      stored: { playerId: ALICE, confirmed: true },
      serverLinks,
    });
    const result = await runGameCenterSignIn(deps, { relinkWhenUnchanged: false });
    expect(result).toEqual({ status: "linked", displayName: BOB, rotatedToken: true });
    expect(state.linkCalls).toEqual(["token-2"]);
    expect(serverLinks.get("token-1")).toBe(ALICE);
    expect(serverLinks.get("token-2")).toBe(BOB);
    expect(state.stored).toEqual({ playerId: BOB, confirmed: true });
  });

  it("starts a fresh identity when the server says the token belongs to someone else", async () => {
    // Local link state was lost, but the server still knows token-1 as Alice.
    const serverLinks = new Map([["token-1", ALICE]]);
    const { state, deps } = fakeDevice({ auth: signedIn(BOB), serverLinks });
    const result = await runGameCenterSignIn(deps, { relinkWhenUnchanged: true });
    expect(result).toEqual({ status: "linked", displayName: BOB, rotatedToken: true });
    expect(state.linkCalls).toEqual(["token-1", "token-2"]);
    expect(serverLinks.get("token-1")).toBe(ALICE);
    expect(serverLinks.get("token-2")).toBe(BOB);
  });

  it("skips the server on foreground checks while the same player is still signed in", async () => {
    const { state, deps } = fakeDevice({ auth: signedIn(ALICE), stored: { playerId: ALICE, confirmed: true } });
    expect(await runGameCenterSignIn(deps, { relinkWhenUnchanged: false }))
      .toEqual({ status: "linked", displayName: ALICE, rotatedToken: false });
    expect(state.linkCalls).toEqual([]);

    await runGameCenterSignIn(deps, { relinkWhenUnchanged: true });
    expect(state.linkCalls).toEqual(["token-1"]);
    expect(state.token).toBe("token-1");
  });

  it("remembers a failed link so a later sign-out still rotates the token", async () => {
    const { state, deps } = fakeDevice({ auth: signedIn(ALICE), linkFails: true });
    await expect(runGameCenterSignIn(deps, { relinkWhenUnchanged: true })).rejects.toThrow("503");
    expect(state.stored).toEqual({ playerId: ALICE, confirmed: false });
    expect(state.token).toBe("token-1");
  });

  it("fails closed when Game Center cannot confirm the linked player", async () => {
    const serverLinks = new Map([["token-1", ALICE]]);
    const { state, deps } = fakeDevice({
      auth: "throws",
      stored: { playerId: ALICE, confirmed: true },
      serverLinks,
    });
    const result = await runGameCenterSignIn(deps, { relinkWhenUnchanged: false });
    expect(result).toEqual({ status: "unavailable", rotatedToken: true });
    expect(state.token).toBe("token-2");
    expect(state.stored).toBeNull();
  });

  it("keeps the identity of an unlinked device when the Game Center check fails", async () => {
    const { state, deps } = fakeDevice({ auth: "throws" });
    expect(await runGameCenterSignIn(deps, { relinkWhenUnchanged: true }))
      .toEqual({ status: "unavailable", rotatedToken: false });
    expect(state.token).toBe("token-1");
  });

  it("has already replaced the token when a later step of the same check fails", async () => {
    // Bob signs in on Alice's device, but the link request fails afterwards.
    const { state, deps } = fakeDevice({
      auth: signedIn(BOB),
      stored: { playerId: ALICE, confirmed: true },
      linkFails: true,
    });
    await expect(runGameCenterSignIn(deps, { relinkWhenUnchanged: false })).rejects.toThrow("503");
    // The rotation happened (and was announced by the real token store) before the failure.
    expect(state.rotations).toBe(1);
    expect(state.token).toBe("token-2");
    expect(state.stored).toEqual({ playerId: BOB, confirmed: false });
  });
});
