// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

import { indexOfNeedle } from "./index_of_needle.ts";

/**
 * Determines whether the source array contains the needle array.
 *
 * The complexity of this function is `O(source.length * needle.length)`.
 *
 * @param source Source array to check.
 * @param needle Needle array to check for.
 * @param start Start index in the source array to begin the search. Defaults to
 * 0.
 * @returns `true` if the source array contains the needle array, `false`
 * otherwise.
 *
 * @example Basic usage
 * ```ts
 * import { includesNeedle } from "@std/bytes/includes-needle";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * assertEquals(includesNeedle(source, needle), true);
 * ```
 *
 * @example Start index
 * ```ts
 * import { includesNeedle } from "@std/bytes/includes-needle";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 *
 * assertEquals(includesNeedle(source, needle, 3), true);
 * assertEquals(includesNeedle(source, needle, 6), false);
 * ```
 * The search will start at the specified index in the source array.
 */
export function includesNeedle(
  source: Uint8Array,
  needle: Uint8Array,
  start = 0,
): boolean {
  return indexOfNeedle(source, needle, start) !== -1;
}

// denoCacheMetadata={"headers":{"set-cookie":"__cf_bm=8poSLVKU7uxUfLqULCLE7BCL1tNJqQ9Fjz2Y.BL1YCs-1793178536.5041285-1.0.1.1-2kEcUS.5YWoBhU1hA1RKntgqZBxeKxveZl.1OxWGFXl9QHIH7Ye6L5ABovxw.lmc8EXE_SMb2iXbqtRRY6jWo2Gmo4ngrpZlHCBvKLbLcIHeKUsm6DTOmo1PZiVxL1iG; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","content-type":"text/typescript","x-content-type-options":"nosniff","cf-cache-status":"HIT","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=GRKH44qYxPhGUBbOc%2FzCJLmZkEs2CCP3GRTdKRoj1nQCob8jPYJqpXoUMGyjV8DmTEt2w%2B7KP6yY1088Jrsej5mdz7JVCEl1yShOd9JimgHV9lCiwopMccg%3D\"}]}","content-length":"1484","accept-ranges":"bytes","date":"Wed, 28 Oct 2026 09:08:56 GMT","cross-origin-resource-policy":"cross-origin","server":"cloudflare","etag":"\"347cb55166db2ce7493e5c0dd2ff4ca4\"","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","x-jsr-backend":"modules","alt-svc":"h3=\":443\"; ma=86400","vary":"Origin","cf-ray":"a518cc7d1be56c93-LAX","x-robots-tag":"noindex","cache-control":"public, max-age=31536000, immutable","age":"2480315","access-control-allow-origin":"*","access-control-expose-headers":"*"},"url":"https://jsr.io/@std/bytes/1.0.6/includes_needle.ts","time":1793178536}