import type { GameCenterFriendsAccess } from "@/modules/game-center";

export type IdentityStatus = "checking" | "linked" | "declined" | "unavailable" | "error";

/**
 * Why Game Center friends cannot be shown, or the friend-list permission once
 * the player is connected. Apple sign-in, the SketchDuel server link, and the
 * friends permission are kept apart so one is never reported as another.
 */
export type FriendsAvailability =
  | "unsupported"
  | "checking"
  /** Apple's sign-in was declined or the player is signed out of Game Center. */
  | "not_signed_in"
  /** Game Center itself could not be reached on this iPhone. */
  | "game_center_unavailable"
  /** Signed in to Game Center, but SketchDuel's server could not confirm the account. */
  | "link_failed"
  | GameCenterFriendsAccess;

export function resolveFriendsAvailability(input: {
  supported: boolean;
  identityStatus: IdentityStatus;
  access: GameCenterFriendsAccess | "checking";
}): FriendsAvailability {
  if (!input.supported) return "unsupported";
  switch (input.identityStatus) {
    case "checking":
      return "checking";
    case "declined":
      return "not_signed_in";
    case "unavailable":
      return "game_center_unavailable";
    case "error":
      return "link_failed";
    case "linked":
      return input.access;
  }
}

export type GameCenterStatusSummary = {
  /** Short status, e.g. for a Settings row. */
  label: string;
  /** One sentence on what it means or what to do. */
  detail: string;
};

/** Plain-language Game Center status for Settings and the friends hub. */
export function describeGameCenterStatus(
  availability: FriendsAvailability,
  displayName: string | null,
): GameCenterStatusSummary {
  const signedInAs = displayName ? `Signed in as ${displayName}.` : "Signed in.";
  switch (availability) {
    case "unsupported":
      return { label: "Not on this device", detail: "Game Center friends are available on iPhone." };
    case "checking":
      return { label: "Checking…", detail: "Connecting to Game Center." };
    case "not_signed_in":
      return { label: "Not signed in", detail: "Sign in to Game Center in the Settings app to see your friends." };
    case "game_center_unavailable":
      return { label: "Unavailable", detail: "Game Center isn't available on this device right now." };
    case "link_failed":
      return {
        label: "Can't reach SketchDuel",
        detail: `${signedInAs} SketchDuel couldn't confirm your account with its server. Try again later.`,
      };
    case "authorized":
      return { label: "Connected", detail: signedInAs };
    case "notDetermined":
      return { label: "Connected", detail: `${signedInAs} Friends access hasn't been allowed yet.` };
    case "denied":
      return { label: "Connected", detail: `${signedInAs} Friends access is turned off in Settings.` };
    case "restricted":
      return { label: "Connected", detail: `${signedInAs} Friends access is restricted on this device.` };
    case "unavailable":
      return { label: "Connected", detail: `${signedInAs} Your friends list couldn't be loaded.` };
  }
}
