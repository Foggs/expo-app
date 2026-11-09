/** How long both players get to reach the room an accepted invite reserved. */
export const INVITE_MATCH_TIMEOUT_MS = 20_000;

export const INVITE_MATCH_TIMEOUT_MESSAGE =
  "Your friend didn't join in time. Go back to Friends and send a new invite.";
export const INVITE_MATCH_CONNECTION_MESSAGE =
  "Couldn't connect to start the match. Check your connection and try again.";

/** Connection states from which the room join will not complete without the player acting. */
const FAILED_FLOW_STATES = new Set(["error_recoverable", "error_backoff", "error_fatal"]);

/**
 * Why "Starting match" should stop waiting, or null to keep waiting.
 * A message the server already gave (`roomError`) is shown by the caller instead.
 */
export function inviteMatchFailure(input: {
  flowState: string;
  roomError: string | null;
  elapsedMs: number;
}): string | null {
  if (input.roomError) return null;
  if (FAILED_FLOW_STATES.has(input.flowState)) return INVITE_MATCH_CONNECTION_MESSAGE;
  if (input.elapsedMs >= INVITE_MATCH_TIMEOUT_MS) return INVITE_MATCH_TIMEOUT_MESSAGE;
  return null;
}
