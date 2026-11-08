import { Platform } from "react-native";
import {
  authenticateGameCenter,
  fetchGameCenterIdentityProof,
} from "@/modules/game-center";
import { apiRequest } from "@/lib/query-client";
import {
  getDeviceSessionToken,
  getStoredGameCenterLink,
  rotateSessionToken,
  setStoredGameCenterLink,
} from "@/lib/sessionToken";
import {
  runGameCenterSignIn,
  type GameCenterLinkDeps,
  type GameCenterLinkOutcome,
} from "@/lib/identity/gameCenterLink";

export type GameCenterSignInResult = GameCenterLinkOutcome;

const deps: GameCenterLinkDeps = {
  authenticate: authenticateGameCenter,
  fetchProof: fetchGameCenterIdentityProof,
  getStoredLink: getStoredGameCenterLink,
  setStoredLink: setStoredGameCenterLink,
  rotateDeviceToken: rotateSessionToken,
  async linkDevice(proof) {
    const sessionToken = await getDeviceSessionToken();
    try {
      await apiRequest("POST", "/api/identity/game-center", proof, {
        "x-session-token": sessionToken,
      });
      return "linked";
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("409")) {
        return "device_linked_to_other_player";
      }
      throw error;
    }
  },
};

/**
 * Signs into Game Center and links this device to the player's account on
 * the server. Players who decline, and every non-iOS platform, keep playing
 * with the device identity. Throws when the server link fails, so the
 * caller can retry later.
 */
export async function signInWithGameCenter(
  options: { relinkWhenUnchanged: boolean },
): Promise<GameCenterSignInResult> {
  if (Platform.OS !== "ios") return { status: "unavailable", rotatedToken: false };
  return runGameCenterSignIn(deps, options);
}
