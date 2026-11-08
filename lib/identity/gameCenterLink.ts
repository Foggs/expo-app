import type { GameCenterAuthResult, GameCenterIdentityProof } from "@/modules/game-center";

/**
 * The Game Center player this device's token was linked to. `confirmed` is
 * false while a link request is in flight or after one failed, so a later
 * sign-out still rotates the token even if the server did record the link.
 */
export type StoredGameCenterLink = { playerId: string; confirmed: boolean };

export type LinkDeviceResult = "linked" | "device_linked_to_other_player";

export type GameCenterLinkDeps = {
  authenticate(): Promise<GameCenterAuthResult>;
  fetchProof(): Promise<GameCenterIdentityProof>;
  getStoredLink(): Promise<StoredGameCenterLink | null>;
  setStoredLink(link: StoredGameCenterLink | null): Promise<void>;
  /** Replaces the device token with a fresh random one (a new anonymous identity). */
  rotateDeviceToken(): Promise<void>;
  linkDevice(proof: GameCenterIdentityProof): Promise<LinkDeviceResult>;
};

export type GameCenterLinkOutcome =
  | { status: "linked"; displayName: string; rotatedToken: boolean }
  | { status: "declined" | "unavailable"; rotatedToken: boolean };

/**
 * Signs into Game Center and links this device token to the player.
 *
 * A device token linked to a player acts as that player on the server, so
 * the token is replaced whenever that player is no longer the one signed in
 * (signed out, declined, or a different Game Center account). The old token's
 * history stays with the old player's account; the device starts fresh.
 *
 * With `relinkWhenUnchanged: false` (foreground checks), a confirmed link
 * for the same player is trusted without another server request.
 */
export async function runGameCenterSignIn(
  deps: GameCenterLinkDeps,
  options: { relinkWhenUnchanged: boolean },
): Promise<GameCenterLinkOutcome> {
  const stored = await deps.getStoredLink();
  let rotatedToken = false;
  const rotate = async () => {
    await deps.rotateDeviceToken();
    await deps.setStoredLink(null);
    rotatedToken = true;
  };

  let auth: GameCenterAuthResult;
  try {
    auth = await deps.authenticate();
  } catch (error) {
    // Fail closed: if Game Center cannot confirm the player is still signed
    // in, the token must not keep acting as them.
    console.warn("[GameCenter] Sign-in check failed; treating Game Center as unavailable:", error);
    auth = { authenticated: false, reason: "unavailable" };
  }
  if (!auth.authenticated) {
    if (stored) await rotate();
    return { status: auth.reason, rotatedToken };
  }

  if (stored && stored.playerId !== auth.playerId) {
    await rotate();
  } else if (stored?.confirmed && !options.relinkWhenUnchanged) {
    return { status: "linked", displayName: auth.displayName, rotatedToken };
  }

  const proof = await deps.fetchProof();
  if (proof.playerId !== auth.playerId) {
    throw new Error("Game Center identity proof is for a different player");
  }

  // Record the pending link first: if the app is closed mid-request, the
  // next launch still knows this token may be linked to the player.
  await deps.setStoredLink({ playerId: proof.playerId, confirmed: false });
  let result = await deps.linkDevice(proof);
  if (result === "device_linked_to_other_player") {
    // The server knows this token as someone else (for example, local state
    // was lost). Start a fresh identity rather than act as that player.
    await deps.rotateDeviceToken();
    rotatedToken = true;
    result = await deps.linkDevice(proof);
    if (result !== "linked") {
      throw new Error("A fresh device identity could not be linked");
    }
  }
  await deps.setStoredLink({ playerId: proof.playerId, confirmed: true });
  return { status: "linked", displayName: auth.displayName, rotatedToken };
}
