import type { GameCenterAuthResult, GameCenterIdentityProof } from "./index";

export type { GameCenterAuthResult, GameCenterIdentityProof } from "./index";

export function isGameCenterAvailable(): boolean {
  return false;
}

export async function authenticateGameCenter(): Promise<GameCenterAuthResult> {
  return { authenticated: false, reason: "unavailable" };
}

export async function fetchGameCenterIdentityProof(): Promise<GameCenterIdentityProof> {
  throw new Error("Game Center is not available on the web");
}
