import type {
  GameCenterAuthResult,
  GameCenterFriendsAccess,
  GameCenterFriendsResult,
  GameCenterIdentityProof,
} from "./index";

export type {
  GameCenterAuthResult,
  GameCenterFriend,
  GameCenterFriendsAccess,
  GameCenterFriendsResult,
  GameCenterIdentityProof,
} from "./index";

export function isGameCenterAvailable(): boolean {
  return false;
}

export async function authenticateGameCenter(): Promise<GameCenterAuthResult> {
  return { authenticated: false, reason: "unavailable" };
}

export async function fetchGameCenterIdentityProof(): Promise<GameCenterIdentityProof> {
  throw new Error("Game Center is not available on the web");
}

export async function getGameCenterFriendsAccess(): Promise<GameCenterFriendsAccess> {
  return "unavailable";
}

export async function loadGameCenterFriends(): Promise<GameCenterFriendsResult> {
  return { access: "unavailable", friends: [] };
}
