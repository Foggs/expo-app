import { describe, expect, it } from "vitest";
import { createIdentityGate } from "@/lib/identity/identityGate";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("identity gate", () => {
  it("does not wait when no check is running", async () => {
    await expect(createIdentityGate().waitForIdentityCheck()).resolves.toBeUndefined();
  });

  it("holds requests until a slow check settles, with no timeout", async () => {
    const gate = createIdentityGate();
    const check = deferred();
    gate.hold(check.promise);
    let released = false;
    void gate.waitForIdentityCheck().then(() => {
      released = true;
    });
    // Far longer than the old 15 s limit would allow, in fake terms: many turns.
    for (let i = 0; i < 50; i++) await tick();
    expect(released).toBe(false);
    check.resolve();
    await tick();
    expect(released).toBe(true);
  });

  it("releases requests when the check fails", async () => {
    const gate = createIdentityGate();
    const check = deferred();
    gate.hold(check.promise);
    const waiting = gate.waitForIdentityCheck();
    check.reject(new Error("link failed"));
    await expect(waiting).resolves.toBeUndefined();
  });

  it("keeps waiting for a check that starts while waiting on the previous one", async () => {
    const gate = createIdentityGate();
    const first = deferred();
    const second = deferred();
    gate.hold(first.promise);
    let released = false;
    void gate.waitForIdentityCheck().then(() => {
      released = true;
    });
    gate.hold(second.promise);
    first.resolve();
    await tick();
    expect(released).toBe(false);
    second.resolve();
    await tick();
    expect(released).toBe(true);
  });

  it("announces every token replacement until a listener unsubscribes", () => {
    const gate = createIdentityGate();
    let count = 0;
    const unsubscribe = gate.onTokenRotated(() => {
      count += 1;
    });
    gate.notifyTokenRotated();
    gate.notifyTokenRotated();
    unsubscribe();
    gate.notifyTokenRotated();
    expect(count).toBe(2);
  });
});
