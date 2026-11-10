import { X509Certificate, createHash, verify as verifySignature } from "node:crypto";
import { rootCertificates } from "node:tls";
import type { GameCenterIdentityProof } from "@shared/schema";

/**
 * Verifies Game Center identity proofs from GKLocalPlayer
 * fetchItems(forIdentityVerificationSignature:).
 *
 * Apple signs: teamPlayerID (UTF-8) + bundle ID (UTF-8) +
 * timestamp (UInt64 big-endian, milliseconds) + salt, using RSA-SHA256 with
 * the key in the certificate at publicKeyURL. The certificate must chain to a
 * trusted root and belong to Apple Inc.
 */

export type GameCenterVerificationFailure =
  | "invalid_proof"
  | "untrusted_key_url"
  | "stale_proof"
  | "certificate_unavailable"
  | "untrusted_certificate"
  | "bad_signature";

export class GameCenterVerificationError extends Error {
  constructor(
    readonly reason: GameCenterVerificationFailure,
    message: string,
  ) {
    super(message);
    this.name = "GameCenterVerificationError";
  }
}

export type VerifiedGameCenterPlayer = {
  playerId: string;
  /** Hash of the signature, used to reject replays of the same proof. */
  proofHash: string;
};

export type GameCenterVerifier = (proof: GameCenterIdentityProof) => Promise<VerifiedGameCenterPlayer>;

export type GameCenterVerifierOptions = {
  bundleIds: string[];
  now?: () => number;
  maxAgeMs?: number;
  maxFutureSkewMs?: number;
  cacheTtlMs?: number;
  /** Fetches a DER or PEM certificate. Defaults to an HTTPS/HTTP fetch with size and time limits. */
  fetchCertificate?: (url: string) => Promise<Buffer>;
  trustedRoots?: X509Certificate[];
  publicKeyHostSuffixes?: string[];
  issuerHosts?: string[];
  /** Required subject organization for the signing certificate. */
  signerOrganization?: string;
};

const DEFAULT_MAX_AGE_MS = 5 * 60_000;
const DEFAULT_MAX_FUTURE_SKEW_MS = 60_000;
const DEFAULT_CACHE_TTL_MS = 60 * 60_000;
const MAX_CERTIFICATE_BYTES = 16 * 1024;
const MAX_CACHE_ENTRIES = 32;

export const DEFAULT_GAME_CENTER_BUNDLE_ID = "app.replit.sketchduel";

let defaultRoots: X509Certificate[] | null = null;
function getDefaultRoots(): X509Certificate[] {
  defaultRoots ??= rootCertificates.map((pem) => new X509Certificate(pem));
  return defaultRoots;
}

async function defaultFetchCertificate(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Certificate request failed with status ${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_CERTIFICATE_BYTES) {
    throw new Error("Certificate is too large");
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0 || body.length > MAX_CERTIFICATE_BYTES) {
    throw new Error("Certificate has an invalid size");
  }
  return body;
}

function hostMatches(hostname: string, suffixes: string[]): boolean {
  const host = hostname.toLowerCase();
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCurrentlyValid(certificate: X509Certificate, nowMs: number): boolean {
  const from = Date.parse(certificate.validFrom);
  const to = Date.parse(certificate.validTo);
  return Number.isFinite(from) && Number.isFinite(to) && from <= nowMs && nowMs <= to;
}

function subjectOrganization(certificate: X509Certificate): string | null {
  for (const line of certificate.subject.split("\n")) {
    if (line.startsWith("O=")) return line.slice(2).replace(/\\,/g, ",");
  }
  return null;
}

function issuedBy(child: X509Certificate, issuer: X509Certificate): boolean {
  try {
    return child.checkIssued(issuer) && child.verify(issuer.publicKey);
  } catch {
    return false;
  }
}

function decodeBase64(value: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64");
  return decoded.length > 0 ? decoded : null;
}

export function encodeSignedPayload(
  playerId: string,
  bundleId: string,
  timestamp: bigint,
  salt: Buffer,
): Buffer {
  const timestampBytes = Buffer.alloc(8);
  timestampBytes.writeBigUInt64BE(timestamp);
  return Buffer.concat([
    Buffer.from(playerId, "utf8"),
    Buffer.from(bundleId, "utf8"),
    timestampBytes,
    salt,
  ]);
}

export function createGameCenterVerifier(options: GameCenterVerifierOptions): GameCenterVerifier {
  const bundleIds = options.bundleIds.filter((id) => id.length > 0);
  if (bundleIds.length === 0) throw new Error("At least one bundle ID is required");
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const maxFutureSkewMs = options.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const fetchCertificate = options.fetchCertificate ?? defaultFetchCertificate;
  const publicKeyHostSuffixes = options.publicKeyHostSuffixes ?? ["apple.com"];
  const issuerHosts = options.issuerHosts ?? ["cacerts.digicert.com"];
  const signerOrganization = options.signerOrganization ?? "Apple Inc.";
  const signerCache = new Map<string, { certificate: X509Certificate; expiresAt: number }>();

  async function loadCertificate(url: string): Promise<X509Certificate> {
    let raw: Buffer;
    try {
      raw = await fetchCertificate(url);
    } catch (error) {
      throw new GameCenterVerificationError(
        "certificate_unavailable",
        `Could not download certificate: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      return new X509Certificate(raw);
    } catch {
      throw new GameCenterVerificationError("untrusted_certificate", "Certificate could not be parsed");
    }
  }

  async function getTrustedSigner(publicKeyUrl: string): Promise<X509Certificate> {
    const nowMs = now();
    const cached = signerCache.get(publicKeyUrl);
    if (cached && cached.expiresAt > nowMs && isCurrentlyValid(cached.certificate, nowMs)) {
      return cached.certificate;
    }

    const leaf = await loadCertificate(publicKeyUrl);
    if (!isCurrentlyValid(leaf, nowMs)) {
      throw new GameCenterVerificationError("untrusted_certificate", "Signing certificate is expired or not yet valid");
    }
    if (subjectOrganization(leaf) !== signerOrganization) {
      throw new GameCenterVerificationError("untrusted_certificate", "Signing certificate does not belong to Apple");
    }
    if (leaf.publicKey.asymmetricKeyType !== "rsa") {
      throw new GameCenterVerificationError("untrusted_certificate", "Signing certificate does not use an RSA key");
    }

    const roots = options.trustedRoots ?? getDefaultRoots();
    let chained = roots.some((root) => isCurrentlyValid(root, nowMs) && issuedBy(leaf, root));

    if (!chained) {
      const issuerUrlText = /CA Issuers - URI:(\S+)/.exec(leaf.infoAccess ?? "")?.[1];
      const issuerUrl = issuerUrlText ? parseUrl(issuerUrlText) : null;
      if (
        !issuerUrl ||
        (issuerUrl.protocol !== "https:" && issuerUrl.protocol !== "http:") ||
        issuerUrl.username ||
        issuerUrl.password ||
        !issuerHosts.includes(issuerUrl.hostname.toLowerCase())
      ) {
        throw new GameCenterVerificationError("untrusted_certificate", "Signing certificate has no trusted issuer location");
      }
      const intermediate = await loadCertificate(issuerUrl.toString());
      if (!intermediate.ca || !isCurrentlyValid(intermediate, nowMs) || !issuedBy(leaf, intermediate)) {
        throw new GameCenterVerificationError("untrusted_certificate", "Signing certificate was not issued by its intermediate");
      }
      chained = roots.some((root) => isCurrentlyValid(root, nowMs) && issuedBy(intermediate, root));
    }

    if (!chained) {
      throw new GameCenterVerificationError("untrusted_certificate", "Signing certificate does not chain to a trusted root");
    }

    if (signerCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = signerCache.keys().next().value;
      if (oldestKey !== undefined) signerCache.delete(oldestKey);
    }
    signerCache.set(publicKeyUrl, { certificate: leaf, expiresAt: nowMs + cacheTtlMs });
    return leaf;
  }

  return async function verifyGameCenterProof(proof) {
    const playerId = proof.playerId;
    const signature = decodeBase64(proof.signature);
    const salt = decodeBase64(proof.salt);
    if (!playerId || playerId.length > 128 || !signature || !salt || !/^\d{1,16}$/.test(proof.timestamp)) {
      throw new GameCenterVerificationError("invalid_proof", "Identity proof is malformed");
    }

    const publicKeyUrl = parseUrl(proof.publicKeyUrl);
    if (
      !publicKeyUrl ||
      publicKeyUrl.protocol !== "https:" ||
      publicKeyUrl.username ||
      publicKeyUrl.password ||
      (publicKeyUrl.port !== "" && publicKeyUrl.port !== "443") ||
      !hostMatches(publicKeyUrl.hostname, publicKeyHostSuffixes)
    ) {
      throw new GameCenterVerificationError("untrusted_key_url", "Identity proof key URL is not an Apple HTTPS address");
    }

    const timestamp = BigInt(proof.timestamp);
    const ageMs = now() - Number(timestamp);
    if (ageMs > maxAgeMs || ageMs < -maxFutureSkewMs) {
      throw new GameCenterVerificationError("stale_proof", "Identity proof is too old or from the future");
    }

    const signer = await getTrustedSigner(publicKeyUrl.toString());
    const verified = bundleIds.some((bundleId) => {
      try {
        return verifySignature(
          "sha256",
          encodeSignedPayload(playerId, bundleId, timestamp, salt),
          signer.publicKey,
          signature,
        );
      } catch {
        return false;
      }
    });
    if (!verified) {
      throw new GameCenterVerificationError("bad_signature", "Identity proof signature is invalid");
    }

    return {
      playerId,
      proofHash: createHash("sha256").update(signature).digest("hex"),
    };
  };
}

export function createDefaultGameCenterVerifier(): GameCenterVerifier {
  const configured = process.env.GAME_CENTER_BUNDLE_IDS
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return createGameCenterVerifier({
    bundleIds: configured && configured.length > 0 ? configured : [DEFAULT_GAME_CENTER_BUNDLE_ID],
  });
}
