import { describe, expect, it } from "vitest";
import { isAppStoreListingPublic } from "@/lib/appStoreListing";

describe("isAppStoreListingPublic", () => {
  it("is not public before release (Apple's lookup returns no results)", () => {
    expect(isAppStoreListingPublic({ resultCount: 0, results: [] }, "6758966766")).toBe(false);
  });

  it("is public when the lookup lists this exact app", () => {
    expect(
      isAppStoreListingPublic({ resultCount: 1, results: [{ trackId: 6758966766 }] }, "6758966766"),
    ).toBe(true);
  });

  it("ignores a different app and malformed responses", () => {
    expect(isAppStoreListingPublic({ results: [{ trackId: 123 }] }, "6758966766")).toBe(false);
    expect(isAppStoreListingPublic({ results: "nope" }, "6758966766")).toBe(false);
    expect(isAppStoreListingPublic(null, "6758966766")).toBe(false);
    expect(isAppStoreListingPublic("html", "6758966766")).toBe(false);
  });
});
