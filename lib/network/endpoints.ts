function extractHostname(hostWithOptionalPort: string): string {
  const trimmed = hostWithOptionalPort.trim();
  if (trimmed.startsWith("[")) {
    const closeIndex = trimmed.indexOf("]");
    if (closeIndex > 1) {
      return trimmed.slice(1, closeIndex);
    }
  }

  return trimmed.split(":")[0];
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function resolveNativeApiBaseUrl(domain: string): string {
  const input = domain.trim();
  if (!input) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  const hasScheme = /^https?:\/\//i.test(input);
  let parsed: URL;

  if (hasScheme) {
    parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("EXPO_PUBLIC_DOMAIN must use http or https");
    }
  } else {
    const normalizedDomain = input.split("/")[0];
    const detectedHost = extractHostname(normalizedDomain);
    const defaultProtocol = isPrivateOrLocalHost(detectedHost)
      ? "http:"
      : "https:";
    parsed = new URL(`${defaultProtocol}//${normalizedDomain}`);
  }

  return `${parsed.protocol}//${parsed.host}/`;
}

export function resolveNativeWsUrl(domain: string): string {
  const apiBaseUrl = resolveNativeApiBaseUrl(domain);
  const parsed = new URL(apiBaseUrl);
  const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${parsed.host}/ws`;
}
