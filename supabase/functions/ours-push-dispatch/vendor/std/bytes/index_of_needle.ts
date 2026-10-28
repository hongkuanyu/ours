// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Returns the index of the first occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * A start index can be specified as the third argument that begins the search
 * at that given index. The start index defaults to the start of the array.
 *
 * The complexity of this function is `O(source.length * needle.length)`.
 *
 * @param source Source array to check.
 * @param needle Needle array to check for.
 * @param start Start index in the source array to begin the search. Defaults to
 * 0.
 * @returns Index of the first occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * @example Basic usage
 * ```ts
 * import { indexOfNeedle } from "@std/bytes/index-of-needle";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * const notNeedle = new Uint8Array([5, 0]);
 *
 * assertEquals(indexOfNeedle(source, needle), 1);
 * assertEquals(indexOfNeedle(source, notNeedle), -1);
 * ```
 *
 * @example Start index
 * ```ts
 * import { indexOfNeedle } from "@std/bytes/index-of-needle";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * assertEquals(indexOfNeedle(source, needle, 2), 3);
 * assertEquals(indexOfNeedle(source, needle, 6), -1);
 * ```
 * Defining a start index will begin the search at the specified index in the
 * source array.
 */
export function indexOfNeedle(
  source: Uint8Array,
  needle: Uint8Array,
  start = 0,
): number {
  if (start < 0) {
    start = Math.max(0, source.length + start);
  }
  if (needle.length > source.length - start) {
    return -1;
  }
  const s = needle[0];
  for (let i = start; i < source.length; i++) {
    if (source[i] !== s) continue;
    let matched = 1;
    let j = i + 1;
    while (matched < needle.length && source[j] === needle[j - i]) {
      matched++;
      j++;
    }
    if (matched === needle.length) {
      return i;
    }
  }
  return -1;
}

// denoCacheMetadata={"headers":{"x-jsr-backend":"modules","x-robots-tag":"noindex","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","access-control-expose-headers":"*","content-type":"text/typescript","content-length":"2182","access-control-allow-origin":"*","cache-control":"public, max-age=31536000, immutable","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","set-cookie":"__cf_bm=LT9_gq2WNKu_J9vGkqIOWoZIBJbaPEG2JMbfO2yCL2E-1793178536.5051649-1.0.1.1-HPp.6aivmwHg3xdKphEscuSWqMjWR.SXs2TJlIc53lMe7SyVLNO5o52BRxzWA3y45q9DBxhs0agZFbOFkao3dl01E.4w0vV1o_UBtSGBTkSONIjsV4H6zSwJPoZw72m6; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","etag":"\"31e8829550cdd08d94584111af59ca0b\"","vary":"Origin","age":"2480315","server":"cloudflare","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=i6JOrEtvjZBOX7dE%2FYxrb2MZgnvwulP35uEiQMu%2FBbS4oIZKu0N7GR20M7s2xsIFNtoKUI%2BxcE0UUqFdZBl0HwlNcWxmVpXx%2ByLknGi9x7jsu2hlw2p5GJY%3D\"}]}","date":"Wed, 28 Oct 2026 09:08:56 GMT","cross-origin-resource-policy":"cross-origin","alt-svc":"h3=\":443\"; ma=86400","cf-ray":"a518cc7d1be76c93-LAX","x-content-type-options":"nosniff","accept-ranges":"bytes","cf-cache-status":"HIT"},"url":"https://jsr.io/@std/bytes/1.0.6/index_of_needle.ts","time":1793178536}