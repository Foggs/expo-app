export const READ_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Bound the entire read, including response-body decoding. The race also settles
 * when a platform transport ignores abort, so the UI cannot spin indefinitely.
 */
export async function withRequestDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  {
    signal,
    timeoutMs = READ_REQUEST_TIMEOUT_MS,
  }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  if (signal?.aborted) throw new Error("Request cancelled");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(new Error("Request cancelled"));
      controller.abort();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new Error("Loading took too long. Please try again."));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([request(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
