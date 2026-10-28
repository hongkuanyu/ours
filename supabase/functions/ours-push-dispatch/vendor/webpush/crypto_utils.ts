// @ts-nocheck
import { bytes, encodeBase64Url } from "./deps.ts";

export async function hmacSha256Digest(
  crypto: SubtleCrypto,
  secret: CryptoKey | ArrayBuffer,
  body: BufferSource,
  length?: number,
): Promise<ArrayBuffer> {
  if (secret instanceof ArrayBuffer) {
    secret = await crypto.importKey(
      "raw",
      secret,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );
  }

  const result = await crypto.sign("HMAC", secret, body);

  if (length !== null) return result.slice(0, length);

  return result;
}

export function hkdfSha256Extract(
  crypto: SubtleCrypto,
  salt: ArrayBuffer,
  ikm: ArrayBuffer,
) {
  if (salt.byteLength === 0) {
    salt = new Uint8Array(256).fill(0).buffer.slice(0);
  }

  return hmacSha256Digest(crypto, salt, ikm);
}

export async function hkdfSha256Expand(
  crypto: SubtleCrypto,
  prk: ArrayBuffer,
  info: ArrayBuffer,
  length: number,
) {
  const infoBytes = new Uint8Array(info);

  let t = new Uint8Array(0);
  let okm = new Uint8Array(0);
  let i = 0;
  while (okm.byteLength < length) {
    i++;
    t = new Uint8Array(
      await hmacSha256Digest(crypto, prk, bytes.concat([t, infoBytes])),
    );
    okm = bytes.concat([okm, t]);
  }

  return okm.slice(0, length);
}

export async function ecdh(
  crypto: SubtleCrypto,
  { privateKey, publicKey }: CryptoKeyPair,
) {
  const ecdhKey = await crypto.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );

  return crypto.exportKey("raw", ecdhKey);
}

const encoder = new TextEncoder();

export async function forgeJwt(
  key: CryptoKey,
  // deno-lint-ignore no-explicit-any
  payload: Record<string, any>,
  { crypto = globalThis.crypto.subtle }: { crypto?: SubtleCrypto } = {},
): Promise<string> {
  const jwt = [{ typ: "JWT", alg: "ES256" }, payload].map((p) =>
    encodeBase64Url(JSON.stringify(p))
  ).join(".");

  const digest = await crypto.sign(
    { "name": "ECDSA", "hash": "SHA-256" },
    key,
    encoder.encode(jwt),
  );

  const signature = encodeBase64Url(digest);

  return jwt + "." + signature;
}

// denoCacheMetadata={"headers":{"etag":"\"1f36e65e20f83ada985e96e7e670d86f\"","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","alt-svc":"h3=\":443\"; ma=86400","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","access-control-expose-headers":"*","x-robots-tag":"noindex","x-jsr-backend":"modules","cf-cache-status":"HIT","server":"cloudflare","date":"Wed, 28 Oct 2026 09:08:56 GMT","cache-control":"public, max-age=31536000, immutable","cross-origin-resource-policy":"cross-origin","age":"768846","vary":"Origin","set-cookie":"__cf_bm=3JxBfDt5XuN.zTfiOv61TTzGwy5i6BB1VP0KQ0loPNU-1793178536.4989266-1.0.1.1-JOBKY7vVdVv.GUJbLlZaU1FVPoIsN1Ae.V2SHuAUb.SNwEuv7OrqCXxsSfcwoxWjaHZpu3x9BTFs4pA3lTRjMb5iGbYIjSbYm3UAh9omE82vo.qRZ9cV50oS6mtLTWN2; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","content-type":"text/typescript","cf-ray":"a518cc7d1bca6c93-LAX","content-length":"2186","access-control-allow-origin":"*","x-content-type-options":"nosniff","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=MdeeCPG0VFCQ6o%2F60qOfl7509WhPT3MtEYKGzt7bPrA1C8VSIQo%2FWftvWtXkQPpCAXvZs%2FREIyuDVhdXYCjI0Sm6egg%2Fi0NaVBtfiLPmVvbGO3%2FNc3o3VVI%3D\"}]}","accept-ranges":"bytes"},"url":"https://jsr.io/@negrel/webpush/0.5.0/crypto_utils.ts","time":1793178536}