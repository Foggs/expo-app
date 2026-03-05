const __DEV__ =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function logInvalidTransition(
  machine: string,
  fromState: string,
  event: string,
): void {
  if (__DEV__) {
    console.warn(
      `[${machine}] Invalid transition: event "${event}" received in state "${fromState}" — no handler, event ignored.`,
    );
  }
}
