// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Returns the index of the last occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * The complexity of this function is `O(source.length * needle.length)`.
 *
 * @param source Source array to check.
 * @param needle Needle array to check for.
 * @param start Start index in the source array to begin the search. Defaults to
 * `source.length - 1`.
 * @returns Index of the last occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * @example Basic usage
 * ```ts
 * import { lastIndexOfNeedle } from "@std/bytes/last-index-of-needle";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * const notNeedle = new Uint8Array([5, 0]);
 *
 * assertEquals(lastIndexOfNeedle(source, needle), 5);
 * assertEquals(lastIndexOfNeedle(source, notNeedle), -1);
 * ```
 *
 * @example Start index
 * ```ts
 * import { lastIndexOfNeedle } from "@std/bytes/last-index-of-needle";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * assertEquals(lastIndexOfNeedle(source, needle, 2), 1);
 * assertEquals(lastIndexOfNeedle(source, needle, 6), 5);
 * ```
 * Defining a start index will begin the search at the specified index in the
 * source array.
 */
export function lastIndexOfNeedle(
  source: Uint8Array,
  needle: Uint8Array,
  start: number = source.length - 1,
): number {
  if (start < 0) {
    return -1;
  }
  if (start >= source.length) {
    start = source.length - 1;
  }
  const e = needle[needle.length - 1];
  for (let i = start; i >= 0; i--) {
    if (source[i] !== e) continue;
    let matched = 1;
    let j = i;
    while (
      matched < needle.length &&
      source[--j] === needle[needle.length - 1 - (i - j)]
    ) {
      matched++;
    }
    if (matched === needle.length) {
      return i - needle.length + 1;
    }
  }
  return -1;
}

// denoCacheMetadata={"headers":{"content-type":"text/typescript","accept-ranges":"bytes","cross-origin-resource-policy":"cross-origin","age":"598164","set-cookie":"__cf_bm=Nl_7_kCRAcbSYHTi158Ncdn0X5A1sNZAtSrYA1ImFNM-1793178536.5050063-1.0.1.1-C9cMwITGTnX2wLQIeuEwojO.lysqoYlMjS8djsWtNdet2zPoQblx4jN5_GL1SwK.yVNblO9csqkd_JvC5St69y_fXEmDTE99.ieiNAtV6PBhgO_2dj3EsZcEIN8_ZH.E; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","access-control-expose-headers":"*","x-content-type-options":"nosniff","date":"Wed, 28 Oct 2026 09:08:56 GMT","access-control-allow-origin":"*","etag":"\"bd17a1c287677bf783cfcf56b65c9c22\"","vary":"Origin","content-length":"2121","cache-control":"public, max-age=31536000, immutable","cf-ray":"a518cc7d1be86c93-LAX","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-robots-tag":"noindex","cf-cache-status":"HIT","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=FZxokOjLLi9ZBTBothx7Xqaw%2BYeKFqrnoaGlDuXIVpml44dAkRzAWPiBYO8ALccpJ3CVticPje6Jwa6S5QvAGCPCJK%2F3zB%2FkLxPPALeZbU8No%2FQB9Z6pEnc%3D\"}]}","server":"cloudflare","x-jsr-backend":"modules","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","alt-svc":"h3=\":443\"; ma=86400"},"url":"https://jsr.io/@std/bytes/1.0.6/last_index_of_needle.ts","time":1793178536}