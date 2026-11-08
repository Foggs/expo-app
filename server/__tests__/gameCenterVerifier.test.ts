import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createGameCenterVerifier,
  GameCenterVerificationError,
  type GameCenterVerifierOptions,
} from "../gameCenterVerifier";
import {
  generateTestCertificates,
  signTestProof,
  TEST_INTERMEDIATE_URL,
  TEST_PUBLIC_KEY_URL,
  type TestCertificateSet,
  type TestSigner,
} from "./support/testCertificates";

const BUNDLE_ID = "com.sketchduel.app";
const PLAYER_ID = "T:_test-player-1";

let certs: TestCertificateSet;

beforeAll(() => {
  certs = generateTestCertificates();
});

afterAll(() => {
  certs?.cleanup();
});

function makeVerifier(
  leaf: TestSigner,
  overrides: Partial<GameCenterVerifierOptions> & { intermediateDer?: Buffer } = {},
) {
  const { intermediateDer, ...options } = overrides;
  const fetchCertificate = vi.fn(async (url: string) => {
    if (url === TEST_INTERMEDIATE_URL) return intermediateDer ?? certs.intermediateDer;
    return leaf.der;
  });
  const verify = createGameCenterVerifier({
    bundleIds: [BUNDLE_ID],
    trustedRoots: [certs.root],
    fetchCertificate,
    ...options,
  });
  return { verify, fetchCertificate };
}

async function expectRejection(promise: Promise<unknown>, reason: GameCenterVerificationError["reason"]) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(GameCenterVerificationError);
  expect((error as GameCenterVerificationError).reason).toBe(reason);
}

describe("Game Center identity proof verification", () => {
  it("accepts a proof signed by an Apple certificate that chains to a trusted root", async () => {
    const { verify, fetchCertificate } = makeVerifier(certs.appleSigner);
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });

    const result = await verify(proof);

    expect(result.playerId).toBe(PLAYER_ID);
    expect(result.proofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchCertificate.mock.calls.map(([url]) => url)).toEqual([TEST_PUBLIC_KEY_URL, TEST_INTERMEDIATE_URL]);
  });

  it("caches the verified signing certificate between sign-ins", async () => {
    const { verify, fetchCertificate } = makeVerifier(certs.appleSigner);
    for (const playerId of ["T:_a", "T:_b"]) {
      await verify(signTestProof({ signer: certs.appleSigner, playerId, bundleId: BUNDLE_ID, timestamp: Date.now() }));
    }
    expect(fetchCertificate).toHaveBeenCalledTimes(2);
  });

  it("rejects a proof signed for a different app's bundle ID", async () => {
    const { verify } = makeVerifier(certs.appleSigner);
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: "com.other.app", timestamp: Date.now() });
    await expectRejection(verify(proof), "bad_signature");
  });

  it("rejects a tampered signature", async () => {
    const { verify } = makeVerifier(certs.appleSigner);
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    const signature = Buffer.from(proof.signature, "base64");
    signature[10] ^= 0xff;
    await expectRejection(verify({ ...proof, signature: signature.toString("base64") }), "bad_signature");
  });

  it("rejects a valid signature presented for a different player", async () => {
    const { verify } = makeVerifier(certs.appleSigner);
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify({ ...proof, playerId: "T:_someone-else" }), "bad_signature");
  });

  it("rejects stale and future-dated proofs", async () => {
    const { verify, fetchCertificate } = makeVerifier(certs.appleSigner);
    const stale = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() - 6 * 60_000 });
    const future = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() + 2 * 60_000 });
    await expectRejection(verify(stale), "stale_proof");
    await expectRejection(verify(future), "stale_proof");
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it("refuses to download keys from anywhere but Apple over HTTPS", async () => {
    const { verify, fetchCertificate } = makeVerifier(certs.appleSigner);
    for (const publicKeyUrl of [
      "https://attacker.example.com/public-key/gc-prod-12.cer",
      "https://static.gc.apple.com.attacker.example.com/gc.cer",
      "https://notapple.com/gc.cer",
      "http://static.gc.apple.com/public-key/gc-prod-12.cer",
      "https://user:pass@static.gc.apple.com/public-key/gc-prod-12.cer",
      "https://static.gc.apple.com:8443/public-key/gc-prod-12.cer",
      "not a url",
    ]) {
      const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now(), publicKeyUrl });
      await expectRejection(verify(proof), "untrusted_key_url");
    }
    expect(fetchCertificate).not.toHaveBeenCalled();
  });

  it("rejects certificates that do not chain to a trusted root", async () => {
    const { verify } = makeVerifier(certs.untrustedChainSigner, { intermediateDer: certs.untrustedChainIntermediateDer });
    const proof = signTestProof({ signer: certs.untrustedChainSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify(proof), "untrusted_certificate");
  });

  it("rejects a leaf whose intermediate is not the one that issued it", async () => {
    const { verify } = makeVerifier(certs.untrustedChainSigner);
    const proof = signTestProof({ signer: certs.untrustedChainSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify(proof), "untrusted_certificate");
  });

  it("rejects certificates that are not issued to Apple", async () => {
    const { verify } = makeVerifier(certs.wrongOrganizationSigner);
    const proof = signTestProof({ signer: certs.wrongOrganizationSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify(proof), "untrusted_certificate");
  });

  it("does not follow issuer links to untrusted hosts", async () => {
    const { verify, fetchCertificate } = makeVerifier(certs.untrustedIssuerHostSigner);
    const proof = signTestProof({ signer: certs.untrustedIssuerHostSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify(proof), "untrusted_certificate");
    expect(fetchCertificate).toHaveBeenCalledTimes(1);
  });

  it("rejects an expired signing certificate", async () => {
    const later = Date.parse(certs.appleSigner.certificate.validTo) + 24 * 60 * 60_000;
    const { verify } = makeVerifier(certs.appleSigner, { now: () => later });
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: later });
    await expectRejection(verify(proof), "untrusted_certificate");
  });

  it("reports an unreachable certificate host separately from a forged proof", async () => {
    const verify = createGameCenterVerifier({
      bundleIds: [BUNDLE_ID],
      trustedRoots: [certs.root],
      fetchCertificate: async () => {
        throw new Error("network down");
      },
    });
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify(proof), "certificate_unavailable");
  });

  it("rejects malformed proof fields before any network access", async () => {
    const { verify, fetchCertificate } = makeVerifier(certs.appleSigner);
    const proof = signTestProof({ signer: certs.appleSigner, playerId: PLAYER_ID, bundleId: BUNDLE_ID, timestamp: Date.now() });
    await expectRejection(verify({ ...proof, signature: "not base64!" }), "invalid_proof");
    await expectRejection(verify({ ...proof, timestamp: "12.5" }), "invalid_proof");
    await expectRejection(verify({ ...proof, playerId: "" }), "invalid_proof");
    expect(fetchCertificate).not.toHaveBeenCalled();
  });
});
