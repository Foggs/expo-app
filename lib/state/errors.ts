export interface FlowError {
  code: string;
  source: "websocket" | "server" | "runtime";
  retryable: boolean;
  fatal: boolean;
  message: string;
  stateVersion: number;
  occurredAt: number;
}

export type ErrorClass =
  | "recoverable"
  | "backoff"
  | "fatal"
  | "validation"
  | "security";

const FATAL_CODES = new Set([
  "SESSION_EXPIRED",
  "SESSION_REPLAYED",
  "SCHEMA_MISMATCH",
  "STATE_VERSION_REGRESSION",
]);

const SECURITY_CODES = new Set([
  "ORIGIN_VIOLATION",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "REPLAY_DETECTED",
  "AUTH_FAILED",
]);

const BACKOFF_CODES = new Set([
  "RATE_LIMITED",
  "SERVER_OVERLOAD",
  "TOO_MANY_REQUESTS",
]);

const VALIDATION_CODES = new Set([
  "MALFORMED_PAYLOAD",
  "INVALID_MESSAGE",
  "SCHEMA_VALIDATION_FAILED",
]);

const TRANSIENT_WS_CLOSE_CODES = new Set([
  1001,
  1006,
  1012,
  1013,
  1014,
]);

export function classifyError(
  code: string | undefined,
  closeCode?: number,
  reconnectAttempt?: number,
): ErrorClass {
  if (code && SECURITY_CODES.has(code)) return "security";
  if (code && FATAL_CODES.has(code)) return "fatal";
  if (code && VALIDATION_CODES.has(code)) return "validation";
  if (code && BACKOFF_CODES.has(code)) return "backoff";

  if (closeCode !== undefined) {
    if (closeCode === 1008 || closeCode === 1011) return "fatal";
    if (TRANSIENT_WS_CLOSE_CODES.has(closeCode)) {
      if (reconnectAttempt !== undefined && reconnectAttempt >= 8) return "backoff";
      return "recoverable";
    }
  }

  if (code === "SUBMIT_FAILED") return "recoverable";
  if (code === "MATCHMAKING_TIMEOUT") return "recoverable";
  if (code === "TIMEOUT" || code === "NETWORK_ERROR") return "recoverable";

  return "recoverable";
}

export function toFlowError(
  raw: { message: string; code?: string },
  source: FlowError["source"],
  stateVersion: number,
  closeCode?: number,
  reconnectAttempt?: number,
): FlowError {
  const errorClass = classifyError(raw.code, closeCode, reconnectAttempt);

  const fatal =
    errorClass === "fatal" ||
    errorClass === "security" ||
    errorClass === "validation";

  const retryable =
    errorClass === "recoverable" || errorClass === "backoff";

  return {
    code: raw.code ?? "UNKNOWN",
    source,
    retryable,
    fatal,
    message: raw.message,
    stateVersion,
    occurredAt: Date.now(),
  };
}

export interface ErrorRaisedEvent {
  type: "ERROR_RAISED";
  error: FlowError;
}
