// @ts-nocheck
import { encodeBase64Url } from "./deps.ts";

/**
 * Output of exportVapidKeys() that can be stored serialized in JSON and stored.
 */
export interface ExportedVapidKeys {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

const vapidKeysAlgo = {
  name: "ECDSA",
  namedCurve: "P-256",
};

/**
 * Generates a new pair of VAPID keys.
 * See https://www.rfc-editor.org/rfc/rfc8292.
 */
export async function generateVapidKeys(
  { extractable = false, crypto = globalThis.crypto.subtle }: {
    extractable?: boolean;
    crypto?: SubtleCrypto;
  } = {},
): Promise<CryptoKeyPair> {
  return await crypto.generateKey(
    vapidKeysAlgo,
    extractable,
    ["sign", "verify"],
  );
}

/**
 * Import VAPID keys previously exported using exportVapidKeys() (JWK format).
 */
export async function importVapidKeys(
  exportedKeys: ExportedVapidKeys,
  { crypto = globalThis.crypto.subtle, extractable = false }: {
    crypto?: SubtleCrypto;
    extractable?: boolean;
  } = {},
): Promise<CryptoKeyPair> {
  return {
    publicKey: await crypto.importKey(
      "jwk",
      exportedKeys.publicKey,
      vapidKeysAlgo,
      true,
      ["verify"],
    ),
    privateKey: await crypto.importKey(
      "jwk",
      exportedKeys.privateKey,
      vapidKeysAlgo,
      extractable,
      ["sign"],
    ),
  };
}

/**
 * Export VAPID keys in JWK format.
 */
export async function exportVapidKeys(
  keys: CryptoKeyPair,
  { crypto = globalThis.crypto.subtle }: { crypto?: SubtleCrypto } = {},
): Promise<ExportedVapidKeys> {
  return {
    publicKey: await crypto.exportKey("jwk", keys.publicKey),
    privateKey: await crypto.exportKey("jwk", keys.privateKey),
  };
}

/**
 * Export application server key (VAPID public key) as an URL encoded base64
 * string.
 */
export async function exportApplicationServerKey(
  keys: CryptoKeyPair,
  { crypto = globalThis.crypto.subtle }: { crypto?: SubtleCrypto } = {},
): Promise<string> {
  const k = await crypto.exportKey("raw", keys.publicKey);
  return encodeBase64Url(k);
}

// denoCacheMetadata={"headers":{"etag":"\"02d894cbc2031051dedd30c828a8fdcc\"","vary":"Origin","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","set-cookie":"__cf_bm=XQrENjQztu_yNHfSjQUzohoQ4ZZrhibeEt6Ncqp22_0-1793178536.497334-1.0.1.1-E5NFvmt75cPgk38B5kMzIIrERbgjzS6V7CxYYB1z9dPB946lloM2XFp5.gdAUh7hs9vsP7v789MvkzIxk_8sEV5pFdDn2JQhD9wQ_hqQ8L.VOykuMYR4wjaL1tlze3hg; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","cache-control":"public, max-age=31536000, immutable","date":"Wed, 28 Oct 2026 09:08:56 GMT","age":"2322137","server":"cloudflare","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=odsJxPOsKdv4MJMZhxWINRAk%2BKc5Z4%2FlfQ2K3lO4UazSt%2FVvDZCAgdaq2IgDXk7X60Z9Kal4cW%2Bd5dtMV91Atjs%2F2Dj%2B3Tt6dMLIBoJjWq5V%2Fd4io1FZxzk%3D\"}]}","alt-svc":"h3=\":443\"; ma=86400","cf-ray":"a518cc7d1bc46c93-LAX","accept-ranges":"bytes","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-jsr-backend":"modules","content-type":"text/typescript","x-robots-tag":"noindex","cross-origin-resource-policy":"cross-origin","cf-cache-status":"HIT","access-control-allow-origin":"*","access-control-expose-headers":"*","content-length":"2020"},"url":"https://jsr.io/@negrel/webpush/0.5.0/vapid.ts","time":1793178536}