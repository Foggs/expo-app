import { describe, expect, it } from "vitest";
import {
  describeGameCenterStatus,
  resolveFriendsAvailability,
} from "@/lib/social/friendsAvailability";

describe("resolveFriendsAvailability", () => {
  it("reports unsupported off iOS regardless of identity", () => {
    expect(resolveFriendsAvailability({ supported: false, identityStatus: "linked", access: "authorized" })).toBe(
      "unsupported",
    );
  });

  it("keeps Apple sign-in, server link and permission states apart", () => {
    const resolve = (identityStatus: Parameters<typeof resolveFriendsAvailability>[0]["identityStatus"]) =>
      resolveFriendsAvailability({ supported: true, identityStatus, access: "authorized" });
    expect(resolve("checking")).toBe("checking");
    expect(resolve("declined")).toBe("not_signed_in");
    expect(resolve("unavailable")).toBe("game_center_unavailable");
    // A server link failure must not be shown as being signed out of Apple.
    expect(resolve("error")).toBe("link_failed");
    expect(resolve("linked")).toBe("authorized");
  });

  it("passes the friends permission through once linked", () => {
    for (const access of ["checking", "denied", "restricted", "notDetermined", "unavailable"] as const) {
      expect(resolveFriendsAvailability({ supported: true, identityStatus: "linked", access })).toBe(access);
    }
  });
});

describe("describeGameCenterStatus", () => {
  it("names the player when connected", () => {
    expect(describeGameCenterStatus("authorized", "Ada")).toEqual({ label: "Connected", detail: "Signed in as Ada." });
  });

  it("explains a server link failure as a SketchDuel problem, not a sign-out", () => {
    const status = describeGameCenterStatus("link_failed", "Ada");
    expect(status.label).toBe("Can't reach SketchDuel");
    expect(status.detail).toContain("Signed in as Ada.");
    expect(status.detail).not.toMatch(/sign in to game center/i);
  });

  it("asks a signed-out player to sign in through the Settings app", () => {
    expect(describeGameCenterStatus("not_signed_in", null).label).toBe("Not signed in");
  });

  it("describes permission states while still connected", () => {
    expect(describeGameCenterStatus("denied", "Ada").label).toBe("Connected");
    expect(describeGameCenterStatus("denied", "Ada").detail).toContain("turned off");
  });
});
