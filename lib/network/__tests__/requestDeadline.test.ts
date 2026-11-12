import { afterEach, describe, expect, it, vi } from "vitest";
import { withRequestDeadline } from "../requestDeadline";

afterEach(() => {
  vi.useRealTimers();
});

describe("read request deadline", () => {
  it("returns a successful response and clears its timeout", async () => {
    vi.useFakeTimers();
    expect(await withRequestDeadline(async () => [])).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles and aborts after ten seconds even if the transport ignores abort", async () => {
    vi.useFakeTimers();
    let transportSignal: AbortSignal | undefined;
    const result = withRequestDeadline((signal) => {
      transportSignal = signal;
      return new Promise(() => {});
    }).catch((error) => error);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toEqual(new Error("Loading took too long. Please try again."));
    expect(transportSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels on navigation and removes the deadline", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let transportSignal: AbortSignal | undefined;
    const result = withRequestDeadline((signal) => {
      transportSignal = signal;
      return new Promise(() => {});
    }, { signal: controller.signal }).catch((error) => error);
    controller.abort();

    expect(await result).toEqual(new Error("Request cancelled"));
    expect(transportSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a request that was already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();
    await expect(withRequestDeadline(request, { signal: controller.signal })).rejects.toThrow("cancelled");
    expect(request).not.toHaveBeenCalled();
  });

  it("clears the timeout on a failed request", async () => {
    vi.useFakeTimers();
    await expect(withRequestDeadline(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(vi.getTimerCount()).toBe(0);
  });
});
