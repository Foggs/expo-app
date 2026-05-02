export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ROOM_CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`
);
const ROOM_CODE_SANITIZE_PATTERN = new RegExp(
  `[^${ROOM_CODE_ALPHABET}]`,
  "g"
);

export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(ROOM_CODE_SANITIZE_PATTERN, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}
