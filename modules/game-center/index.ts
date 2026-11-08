import { requireOptionalNativeModule } from "expo";

export type GameCenterAuthResult =
  | { authenticated: true; playerId: string; displayName: string }
  | { authenticated: false; reason: "declined" | "unavailable" };

/** Apple's identity proof, verified by the server before linking an account. */
export type GameCenterIdentityProof = {
  playerId: string;
  publicKeyUrl: string;
  signature: string;
  salt: string;
  timestamp: string;
};

type GameCenterNativeModule = {
  authenticate(): Promise<GameCenterAuthResult>;
  fetchIdentityProof(): Promise<GameCenterIdentityProof>;
};

// Null in Expo Go, on Android and anywhere the native module is not built in.
const nativeModule = requireOptionalNativeModule<GameCenterNativeModule>("GameCenter");

export function isGameCenterAvailable(): boolean {
  return nativeModule !== null;
}

export async function authenticateGameCenter(): Promise<GameCenterAuthResult> {
  if (!nativeModule) return { authenticated: false, reason: "unavailable" };
  return nativeModule.authenticate();
}

export async function fetchGameCenterIdentityProof(): Promise<GameCenterIdentityProof> {
  if (!nativeModule) throw new Error("Game Center is not available on this device");
  return nativeModule.fetchIdentityProof();
}
