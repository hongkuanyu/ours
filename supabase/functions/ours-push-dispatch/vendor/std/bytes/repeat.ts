// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.
import { copy } from "./copy.ts";
import type { Uint8Array_ } from "./_types.ts";
export type { Uint8Array_ };

/**
 * Returns a new byte slice composed of `count` repetitions of the `source`
 * array.
 *
 * @param source Source array to repeat.
 * @param count Number of times to repeat the source array.
 * @returns A new byte slice composed of `count` repetitions of the `source`
 * array.
 *
 * @example Basic usage
 * ```ts
 * import { repeat } from "@std/bytes/repeat";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2]);
 *
 * assertEquals(repeat(source, 3), new Uint8Array([0, 1, 2, 0, 1, 2, 0, 1, 2]));
 * ```
 *
 * @example Zero count
 * ```ts
 * import { repeat } from "@std/bytes/repeat";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2]);
 *
 * assertEquals(repeat(source, 0), new Uint8Array());
 * ```
 */
export function repeat(source: Uint8Array, count: number): Uint8Array_ {
  if (count < 0 || !Number.isInteger(count)) {
    throw new RangeError("Count must be a non-negative integer");
  }

  const repeated = new Uint8Array(source.length * count);
  let offset = 0;

  while (offset < repeated.length) {
    offset += copy(source, repeated, offset);
  }

  return repeated;
}

// denoCacheMetadata={"headers":{"nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","set-cookie":"__cf_bm=0i9VyPGpI4fNSyJNW9cq26ubOr7C6XESgpXgdnvgtCA-1793178536.5059686-1.0.1.1-PzhinYphw6_ppSLKQMhjsoWbueDVLs3uvD3uAos4.itDAi9bS6dpCggadhJfmFszIWflGiIwO9ts_fj9UKa8e6XmYnoggoBfiiJg._1EPi73PAYdI43V7gr0.AVe46YD; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","server":"cloudflare","vary":"Origin","cross-origin-resource-policy":"cross-origin","content-length":"1376","etag":"\"d16c4962859eb228fa9854720219781f\"","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=aTrnibKkGxxtgd9ZOzkxoqrlaoDIY%2BRiTnAnWOh0DAUS2XWBGzbX5ZDvyvjEk1g4sWaM577Sf9mTxa7K5kIWiPyjNNqAevehTrgpoxvW4WyQPb%2BPW9LMdmg%3D\"}]}","cf-cache-status":"HIT","access-control-allow-origin":"*","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","accept-ranges":"bytes","date":"Wed, 28 Oct 2026 09:08:56 GMT","access-control-expose-headers":"*","x-content-type-options":"nosniff","cache-control":"public, max-age=31536000, immutable","content-type":"text/typescript","x-robots-tag":"noindex","x-jsr-backend":"modules","cf-ray":"a518cc7d1bea6c93-LAX","age":"2480315","alt-svc":"h3=\":443\"; ma=86400"},"url":"https://jsr.io/@std/bytes/1.0.6/repeat.ts","time":1793178536}