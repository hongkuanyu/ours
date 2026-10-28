// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Check whether byte slices are equal to each other using 8-bit comparisons.
 *
 * @param a First array to check equality
 * @param b Second array to check equality
 * @returns `true` if the arrays are equal, `false` otherwise
 *
 * @private
 */
function equalsNaive(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < b.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Check whether byte slices are equal to each other using 32-bit comparisons.
 *
 * @param a First array to check equality.
 * @param b Second array to check equality.
 * @returns `true` if the arrays are equal, `false` otherwise.
 *
 * @private
 */
function equals32Bit(a: Uint8Array, b: Uint8Array): boolean {
  const len = a.length;
  const compactOffset = 3 - ((a.byteOffset + 3) % 4);
  const compactLen = Math.floor((len - compactOffset) / 4);
  const compactA = new Uint32Array(
    a.buffer,
    a.byteOffset + compactOffset,
    compactLen,
  );
  const compactB = new Uint32Array(
    b.buffer,
    b.byteOffset + compactOffset,
    compactLen,
  );
  for (let i = 0; i < compactOffset; i++) {
    if (a[i] !== b[i]) return false;
  }
  for (let i = 0; i < compactA.length; i++) {
    if (compactA[i] !== compactB[i]) return false;
  }
  for (let i = compactOffset + compactLen * 4; i < len; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Byte length threshold for when to use 32-bit comparisons, based on
 * benchmarks.
 *
 * @see {@link https://github.com/denoland/std/pull/4635}
 */
const THRESHOLD_32_BIT = 160;

/**
 * Check whether byte slices are equal to each other.
 *
 * @param a First array to check equality.
 * @param b Second array to check equality.
 * @returns `true` if the arrays are equal, `false` otherwise.
 *
 * @example Basic usage
 * ```ts
 * import { equals } from "@std/bytes/equals";
 * import { assertEquals } from "@std/assert";
 *
 * const a = new Uint8Array([1, 2, 3]);
 * const b = new Uint8Array([1, 2, 3]);
 * const c = new Uint8Array([4, 5, 6]);
 *
 * assertEquals(equals(a, b), true);
 * assertEquals(equals(a, c), false);
 * ```
 */
export function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.length >= THRESHOLD_32_BIT &&
      (a.byteOffset % 4) === (b.byteOffset % 4)
    ? equals32Bit(a, b)
    : equalsNaive(a, b);
}

// denoCacheMetadata={"headers":{"server":"cloudflare","etag":"\"3584e0752bdd99d26a138de79e02816d\"","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","date":"Wed, 28 Oct 2026 09:08:56 GMT","cross-origin-resource-policy":"cross-origin","x-jsr-backend":"modules","set-cookie":"__cf_bm=6IlulXQ8TOiz8YEBpunwyqYBj9ZJ9RU1Qf1meQLdIzM-1793178536.5033765-1.0.1.1-2Yp.Gw8zd6jiUevSbL0IcHK5eFe4UkEm9P2wPwkoOlP7Vkq3.PpINMNI_TKpwgr.kl4JSrx37m_bM9u0kEji.7yhY.JF.xxg2i6XBCjpxOHx1g6.mNx1161N686rHbC6; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=nSME42alBJKvS%2FRqZ5Mwj971ZI58uXFkQP7wK00TBFudtfcK8sn6hUcDPWEImdNo7O1jLAOwNEXbr2hXJRmpJu8BdsHwPaRn6GrpPHcghPPxhAaBWqwyKxg%3D\"}]}","access-control-expose-headers":"*","cf-cache-status":"HIT","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","content-length":"2469","x-robots-tag":"noindex","alt-svc":"h3=\":443\"; ma=86400","x-content-type-options":"nosniff","accept-ranges":"bytes","content-type":"text/typescript","vary":"Origin","cf-ray":"a518cc7d1be46c93-LAX","cache-control":"public, max-age=31536000, immutable","access-control-allow-origin":"*","age":"1123463"},"url":"https://jsr.io/@std/bytes/1.0.6/equals.ts","time":1793178536}