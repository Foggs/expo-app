import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { X509Certificate, createPrivateKey, sign, type KeyObject } from "node:crypto";
import { encodeSignedPayload } from "../../gameCenterVerifier";

export const TEST_INTERMEDIATE_URL = "http://cacerts.digicert.com/SketchDuelTestIntermediate.crt";
export const TEST_PUBLIC_KEY_URL = "https://static.gc.apple.com/public-key/gc-test.cer";

export type TestSigner = {
  /** DER bytes, as Apple serves them. */
  der: Buffer;
  certificate: X509Certificate;
  privateKey: KeyObject;
};

export type TestCertificateSet = {
  root: X509Certificate;
  intermediateDer: Buffer;
  appleSigner: TestSigner;
  wrongOrganizationSigner: TestSigner;
  untrustedIssuerHostSigner: TestSigner;
  untrustedRoot: X509Certificate;
  untrustedChainSigner: TestSigner;
  untrustedChainIntermediateDer: Buffer;
  cleanup: () => void;
};

/**
 * Generates throwaway certificate chains with openssl: a trusted root, an
 * intermediate (fetched through the leaf's AIA URL like DigiCert's), and
 * several Game Center–style leaf certificates, valid or deliberately flawed.
 */
export function generateTestCertificates(): TestCertificateSet {
  const dir = mkdtempSync(join(tmpdir(), "sketchduel-gc-certs-"));
  const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
  const write = (name: string, contents: string) => writeFileSync(join(dir, name), contents);

  const makeRoot = (name: string, subject: string) => {
    run(
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256",
      "-keyout", `${name}.key`, "-out", `${name}.pem`, "-days", "30",
      "-subj", subject,
      "-addext", "basicConstraints=critical,CA:TRUE",
      "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    );
  };

  const makeIssued = (name: string, subject: string, issuer: string, days: number, extensions: string) => {
    run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.csr`, "-subj", subject);
    write(`${name}.ext`, extensions);
    run(
      "x509", "-req", "-sha256", "-in", `${name}.csr`,
      "-CA", `${issuer}.pem`, "-CAkey", `${issuer}.key`, "-CAcreateserial",
      "-out", `${name}.pem`, "-days", String(days), "-extfile", `${name}.ext`,
    );
  };

  const caExtensions = "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n";
  const leafExtensions = (issuerUrl: string) =>
    `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nauthorityInfoAccess=caIssuers;URI:${issuerUrl}\n`;

  const loadSigner = (name: string): TestSigner => {
    const certificate = new X509Certificate(readFileSync(join(dir, `${name}.pem`)));
    return {
      der: certificate.raw,
      certificate,
      privateKey: createPrivateKey(readFileSync(join(dir, `${name}.key`))),
    };
  };

  try {
    makeRoot("root", "/O=SketchDuel Test Root/CN=SketchDuel Test Root CA");
    makeIssued("intermediate", "/O=SketchDuel Test CA/CN=SketchDuel Test Code Signing CA", "root", 30, caExtensions);
    makeIssued("apple", "/C=US/O=Apple Inc./CN=Apple Inc.", "intermediate", 1, leafExtensions(TEST_INTERMEDIATE_URL));
    makeIssued("wrong-org", "/C=US/O=Not Apple Ltd/CN=Not Apple", "intermediate", 1, leafExtensions(TEST_INTERMEDIATE_URL));
    makeIssued(
      "bad-issuer-host",
      "/C=US/O=Apple Inc./CN=Apple Inc.",
      "intermediate",
      1,
      leafExtensions("http://attacker.example.com/intermediate.crt"),
    );

    makeRoot("untrusted-root", "/O=Untrusted Root/CN=Untrusted Root CA");
    makeIssued("untrusted-intermediate", "/O=Untrusted CA/CN=Untrusted Intermediate", "untrusted-root", 30, caExtensions);
    makeIssued("untrusted-leaf", "/C=US/O=Apple Inc./CN=Apple Inc.", "untrusted-intermediate", 1, leafExtensions(TEST_INTERMEDIATE_URL));

    return {
      root: new X509Certificate(readFileSync(join(dir, "root.pem"))),
      intermediateDer: new X509Certificate(readFileSync(join(dir, "intermediate.pem"))).raw,
      appleSigner: loadSigner("apple"),
      wrongOrganizationSigner: loadSigner("wrong-org"),
      untrustedIssuerHostSigner: loadSigner("bad-issuer-host"),
      untrustedRoot: new X509Certificate(readFileSync(join(dir, "untrusted-root.pem"))),
      untrustedChainSigner: loadSigner("untrusted-leaf"),
      untrustedChainIntermediateDer: new X509Certificate(readFileSync(join(dir, "untrusted-intermediate.pem"))).raw,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

export function signTestProof(options: {
  signer: TestSigner;
  playerId: string;
  bundleId: string;
  timestamp: number;
  publicKeyUrl?: string;
  salt?: Buffer;
}) {
  const salt = options.salt ?? Buffer.from(`salt-${options.timestamp}-${Math.random()}`);
  const timestamp = BigInt(options.timestamp);
  const signature = sign(
    "sha256",
    encodeSignedPayload(options.playerId, options.bundleId, timestamp, salt),
    options.signer.privateKey,
  );
  return {
    playerId: options.playerId,
    publicKeyUrl: options.publicKeyUrl ?? TEST_PUBLIC_KEY_URL,
    signature: signature.toString("base64"),
    salt: salt.toString("base64"),
    timestamp: timestamp.toString(),
  };
}
