import * as Linking from "expo-linking";
import {
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "@shared/friendRoom";

const INVITE_SCHEME = "sketchduel";
const INVITE_HOST = "friends";
const INVITE_PATH = "friends";

export function createFriendInviteLink(roomCode: string): string | null {
  const normalizedCode = normalizeRoomCode(roomCode);
  if (!isValidRoomCode(normalizedCode)) {
    return null;
  }

  return Linking.createURL(INVITE_PATH, {
    scheme: INVITE_SCHEME,
    queryParams: { code: normalizedCode },
  });
}

export function parseFriendInviteUrl(url: string): string | null {
  let parsed: Linking.ParsedURL;
  try {
    parsed = Linking.parse(url);
  } catch {
    return null;
  }

  if (parsed.scheme?.toLowerCase() !== INVITE_SCHEME) {
    return null;
  }

  const hostname = parsed.hostname?.toLowerCase();
  const path = parsed.path?.replace(/^\/+/, "").toLowerCase();
  const isHostInvite =
    hostname === INVITE_HOST && (!path || path.length === 0);
  const isPathInvite = !hostname && path === INVITE_PATH;
  if (!isHostInvite && !isPathInvite) {
    return null;
  }

  const queryKeys = Object.keys(parsed.queryParams ?? {});
  if (queryKeys.some((key) => key !== "code")) {
    return null;
  }

  return parseFriendInviteCode(parsed.queryParams?.code);
}

export function parseFriendInviteCode(rawCode: unknown): string | null {
  if (typeof rawCode !== "string" || rawCode.length !== ROOM_CODE_LENGTH) {
    return null;
  }

  const normalizedCode = normalizeRoomCode(rawCode);
  if (rawCode !== normalizedCode || !isValidRoomCode(normalizedCode)) {
    return null;
  }

  return normalizedCode;
}

export function createFriendInviteMessage(
  roomCode: string,
  inviteLink: string,
): string {
  return `Join my SketchDuel friend match!\nRoom code: ${roomCode}\nInvite link: ${inviteLink}`;
}