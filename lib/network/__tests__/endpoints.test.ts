import { describe, expect, it } from "vitest";
import { resolveNativeApiBaseUrl, resolveNativeWsUrl } from "@/lib/network/endpoints";

describe("native endpoint resolution", () => {
  it("resolves LAN domain with explicit http scheme", () => {
    const domain = "http://192.168.1.10:5050";
    expect(resolveNativeApiBaseUrl(domain)).toBe("http://192.168.1.10:5050/");
    expect(resolveNativeWsUrl(domain)).toBe("ws://192.168.1.10:5050/ws");
  });

  it("resolves public domain with explicit https scheme", () => {
    const domain = "https://abc.ngrok-free.dev";
    expect(resolveNativeApiBaseUrl(domain)).toBe("https://abc.ngrok-free.dev/");
    expect(resolveNativeWsUrl(domain)).toBe("wss://abc.ngrok-free.dev/ws");
  });

  it("defaults host:port LAN input to http/ws", () => {
    const domain = "192.168.1.10:5050";
    expect(resolveNativeApiBaseUrl(domain)).toBe("http://192.168.1.10:5050/");
    expect(resolveNativeWsUrl(domain)).toBe("ws://192.168.1.10:5050/ws");
  });

  it("defaults public host input to https/wss", () => {
    const domain = "example.com";
    expect(resolveNativeApiBaseUrl(domain)).toBe("https://example.com/");
    expect(resolveNativeWsUrl(domain)).toBe("wss://example.com/ws");
  });
});
