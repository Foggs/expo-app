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

/** Whether the player lets SketchDuel see their Game Center friends. */
export type GameCenterFriendsAccess = "authorized" | "denied" | "restricted" | "notDetermined" | "unavailable";

/** A Game Center friend. The display name stays on the device; only playerId is sent to the server. */
export type GameCenterFriend = { playerId: string; displayName: string };

export type GameCenterFriendsResult = { access: GameCenterFriendsAccess; friends: GameCenterFriend[] };

type GameCenterNativeModule = {
  authenticate(): Promise<GameCenterAuthResult>;
  fetchIdentityProof(): Promise<GameCenterIdentityProof>;
  getFriendsAccess?(): Promise<GameCenterFriendsAccess>;
  loadFriends?(): Promise<GameCenterFriendsResult>;
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

/** The current friend-list permission, without asking the player. */
export async function getGameCenterFriendsAccess(): Promise<GameCenterFriendsAccess> {
  if (!nativeModule?.getFriendsAccess) return "unavailable";
  return nativeModule.getFriendsAccess();
}

/**
 * Loads the player's Game Center friends. Shows Apple's permission prompt
 * the first time; afterwards returns the saved choice.
 */
export async function loadGameCenterFriends(): Promise<GameCenterFriendsResult> {
  if (!nativeModule?.loadFriends) return { access: "unavailable", friends: [] };
  return nativeModule.loadFriends();
}
