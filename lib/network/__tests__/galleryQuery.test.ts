import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { platform, fetchMock } = vi.hoisted(() => ({
  platform: { OS: "ios" },
  fetchMock: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo/fetch", () => ({ fetch: fetchMock }));

import { getApiUrl, getQueryFn } from "@/lib/query-client";

let client: QueryClient;
beforeEach(() => {
  platform.OS = "ios";
  vi.stubEnv("EXPO_PUBLIC_DOMAIN", "https://api.example.test");
  // React Native may expose window without a browser Location.
  vi.stubGlobal("window", {});
  fetchMock.mockReset();
  client = new QueryClient({
    defaultOptions: { queries: { queryFn: getQueryFn({ on401: "throw" }), retry: false, gcTime: 0 } },
  });
});
afterEach(() => {
  client.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Gallery read lifecycle", () => {
  it("uses the configured native backend even when window exists", () => {
    expect(getApiUrl()).toBe("https://api.example.test/");
  });

  it("uses same-origin API URLs on the web", () => {
    platform.OS = "web";
    vi.stubGlobal("window", { location: { origin: "https://preview.example.test" } });
    expect(getApiUrl()).toBe("https://preview.example.test/");
  });

  it("settles an empty gallery as success instead of continuing to load", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    expect(await client.fetchQuery({ queryKey: ["/api/gallery"] })).toEqual([]);
    expect(client.getQueryState(["/api/gallery"])?.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/gallery",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns real drawings unchanged", async () => {
    const drawings = [{ id: "drawing-1", strokes: [], roundCount: 3 }];
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => drawings });
    expect(await client.fetchQuery({ queryKey: ["/api/gallery"] })).toEqual(drawings);
  });

  it("rejects a malformed response rather than telling the user the gallery is empty", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "unavailable" }) });
    await expect(client.fetchQuery({ queryKey: ["/api/gallery"] })).rejects.toThrow("invalid response");
    expect(client.getQueryState(["/api/gallery"])?.status).toBe("error");
  });

  it("reports server failures as errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => "Unavailable" });
    await expect(client.fetchQuery({ queryKey: ["/api/gallery"] })).rejects.toThrow("503");
  });

  it("stops loading when the network never answers, then allows a successful retry", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const result = client.fetchQuery({ queryKey: ["/api/gallery"] }).catch((error) => error);
    expect(client.getQueryState(["/api/gallery"])?.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBeInstanceOf(Error);
    expect(client.getQueryState(["/api/gallery"])?.status).toBe("error");
    expect(client.getQueryState(["/api/gallery"])?.fetchStatus).toBe("idle");

    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    expect(await client.fetchQuery({ queryKey: ["/api/gallery"] })).toEqual([]);
    expect(client.getQueryState(["/api/gallery"])?.status).toBe("success");
  });

  it("also stops loading when headers arrive but the response body stalls", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) });
    const result = client.fetchQuery({ queryKey: ["/api/gallery"] }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBeInstanceOf(Error);
    expect(client.getQueryState(["/api/gallery"])?.status).toBe("error");
  });
});
