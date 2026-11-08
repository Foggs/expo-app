/**
 * Coordinates requests with the Game Center identity check.
 *
 * While a check is running, the device token may be about to be replaced
 * (the linked player signed out or changed). Requests wait for the check to
 * settle instead of sending a token that may still act as the previous
 * player. There is deliberately no timeout: giving up early would send the
 * old token, which is exactly what the check exists to prevent.
 *
 * Token replacements are announced to listeners as they happen, so open
 * connections drop the old identity even if a later step of the check fails.
 */
export type IdentityGate = {
  /** Makes `waitForIdentityCheck` wait until this check settles. */
  hold(check: Promise<unknown>): void;
  /** Resolves once no identity check is running. */
  waitForIdentityCheck(): Promise<void>;
  /** Calls the listener each time the device token is replaced. Returns an unsubscribe function. */
  onTokenRotated(listener: () => void): () => void;
  /** Announces a token replacement to every listener. */
  notifyTokenRotated(): void;
};

export function createIdentityGate(): IdentityGate {
  let current: Promise<unknown> | null = null;
  const listeners = new Set<() => void>();

  return {
    hold(check) {
      current = check;
      void check.catch(() => undefined).finally(() => {
        if (current === check) current = null;
      });
    },
    async waitForIdentityCheck() {
      // A new check may start while waiting for the previous one.
      while (current) {
        const check = current;
        await check.catch(() => undefined);
        if (current === check) current = null;
      }
    },
    onTokenRotated(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notifyTokenRotated() {
      for (const listener of Array.from(listeners)) {
        try {
          listener();
        } catch (error) {
          console.warn("[identity] Token rotation listener failed:", error);
        }
      }
    },
  };
}
