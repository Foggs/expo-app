import { afterEach, describe, expect, it, vi } from "vitest";
import { signInWithGameCenter } from "@/lib/gameCenter";

const mocks = vi.hoisted(() => ({
  isGameCenterAvailable: vi.fn<() => boolean>(),
  authenticateGameCenter: vi.fn(),
  fetchGameCenterIdentityProof: vi.fn(),
  runGameCenterSignIn: vi.fn(),
  getDeviceSessionToken: vi.fn(),
  getStoredGameCenterLink: vi.fn(),
  rotateSessionToken: vi.fn(),
  setStoredGameCenterLink: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("@/modules/game-center", () => ({
  isGameCenterAvailable: mocks.isGameCenterAvailable,
  authenticateGameCenter: mocks.authenticateGameCenter,
  fetchGameCenterIdentityProof: mocks.fetchGameCenterIdentityProof,
}));

vi.mock("@/lib/sessionToken", () => ({
  getDeviceSessionToken: mocks.getDeviceSessionToken,
  getStoredGameCenterLink: mocks.getStoredGameCenterLink,
  rotateSessionToken: mocks.rotateSessionToken,
  setStoredGameCenterLink: mocks.setStoredGameCenterLink,
}));

vi.mock("@/lib/query-client", () => ({ apiRequest: mocks.apiRequest }));

vi.mock("@/lib/identity/gameCenterLink", () => ({
  runGameCenterSignIn: mocks.runGameCenterSignIn,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Game Center availability guard", () => {
  it("preserves device identity when the native module is absent", async () => {
    mocks.isGameCenterAvailable.mockReturnValue(false);

    await expect(signInWithGameCenter({ relinkWhenUnchanged: true })).resolves.toEqual({
      status: "unavailable",
      rotatedToken: false,
    });

    expect(mocks.runGameCenterSignIn).not.toHaveBeenCalled();
    expect(mocks.getStoredGameCenterLink).not.toHaveBeenCalled();
    expect(mocks.rotateSessionToken).not.toHaveBeenCalled();
    expect(mocks.setStoredGameCenterLink).not.toHaveBeenCalled();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it("continues normal sign-in when the native module is present", async () => {
    const options = { relinkWhenUnchanged: false };
    const result = { status: "linked", displayName: "Player", rotatedToken: false };
    mocks.isGameCenterAvailable.mockReturnValue(true);
    mocks.runGameCenterSignIn.mockResolvedValue(result);

    await expect(signInWithGameCenter(options)).resolves.toEqual(result);
    expect(mocks.runGameCenterSignIn).toHaveBeenCalledOnce();
    expect(mocks.runGameCenterSignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticate: mocks.authenticateGameCenter,
        fetchProof: mocks.fetchGameCenterIdentityProof,
        rotateDeviceToken: mocks.rotateSessionToken,
      }),
      options,
    );
  });
});
