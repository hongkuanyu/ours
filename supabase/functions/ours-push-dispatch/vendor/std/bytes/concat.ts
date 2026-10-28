// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

import type { Uint8Array_ } from "./_types.ts";
export type { Uint8Array_ };

/**
 * Concatenate an array of byte slices into a single slice.
 *
 * @param buffers Array of byte slices to concatenate.
 * @returns A new byte slice containing all the input slices concatenated.
 *
 * @example Basic usage
 * ```ts
 * import { concat } from "@std/bytes/concat";
 * import { assertEquals } from "@std/assert";
 *
 * const a = new Uint8Array([0, 1, 2]);
 * const b = new Uint8Array([3, 4, 5]);
 *
 * assertEquals(concat([a, b]), new Uint8Array([0, 1, 2, 3, 4, 5]));
 * ```
 */
export function concat(buffers: readonly Uint8Array[]): Uint8Array_ {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }

  return output;
}

// denoCacheMetadata={"headers":{"cf-cache-status":"HIT","vary":"Origin","content-length":"994","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","cache-control":"public, max-age=31536000, immutable","cf-ray":"a518cc7d1bdc6c93-LAX","x-content-type-options":"nosniff","etag":"\"a7e3ac5308ba030f83d2918e550650e3\"","x-jsr-backend":"modules","x-robots-tag":"noindex","content-type":"text/typescript","age":"429049","access-control-expose-headers":"*","access-control-allow-origin":"*","cross-origin-resource-policy":"cross-origin","set-cookie":"__cf_bm=OdyHIUD0jrBaLmgP9YPNe9.lVwby._vIUCu5wOiMuNI-1793178536.5021684-1.0.1.1-Kvtw_IOL6DnhKikkF5vCquxM76PMUXC2jwJeSIz9P6i28bfE3_hI77ANq6pFASOxqVn0fOKaYsYPKJsc0E4mxZ5iuY2tSvxKM0WFYMxrSou.sQb.ji5pF2uCLyJM2kGx; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=jezwMj%2FUxOpOzLfIjZ1G%2B3c%2Be0Z77WEeXrqrjqwg%2FxxywOYwNK6Q5ok0%2BtuxTWwAfY5jHJyODjzWESzJf%2BZ%2FM8hIx3BgdBO3Jr0jQg35gQRE5h%2BVNnENg%2BY%3D\"}]}","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","alt-svc":"h3=\":443\"; ma=86400","date":"Wed, 28 Oct 2026 09:08:56 GMT","accept-ranges":"bytes","server":"cloudflare"},"url":"https://jsr.io/@std/bytes/1.0.6/concat.ts","time":1793178536}