// @ts-nocheck
// Copyright 2018-2026 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Utilities for
 * {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-5 | base64url}
 * encoding and decoding.
 *
 * @module
 */

import { calcSizeBase64, decode, encode } from "./_common64.ts";
import { detach } from "./_common_detach.ts";
import type { Uint8Array_ } from "./_types.ts";
export type { Uint8Array_ };

const padding = "=".charCodeAt(0);
const alphabet = new TextEncoder()
  .encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");
const rAlphabet = new Uint8Array(128).fill(64); // alphabet.length
alphabet.forEach((byte, i) => rAlphabet[byte] = i);

/**
 * Convert data into a base64url-encoded string.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-5}
 *
 * @param data The data to encode.
 * @returns The base64url-encoded string.
 *
 * @example Usage
 * ```ts
 * import { encodeBase64Url } from "@std/encoding/base64url";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(encodeBase64Url("foobar"), "Zm9vYmFy");
 * ```
 */
export function encodeBase64Url(
  data: ArrayBuffer | Uint8Array | string,
): string {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data) as Uint8Array_;
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(
    data as Uint8Array_,
    calcSizeBase64((data as Uint8Array_).length),
  );
  let o = encode(output, i, 0, alphabet, padding);
  o = output.indexOf(padding, o - 2);
  return new TextDecoder().decode(
    // deno-lint-ignore no-explicit-any
    o > 0 ? new Uint8Array((output.buffer as any).transfer(o)) : output,
  );
}

/**
 * Decodes a given base64url-encoded string.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-5}
 *
 * @param b64url The base64url-encoded string to decode.
 * @returns The decoded data.
 *
 * @example Usage
 * ```ts
 * import { decodeBase64Url } from "@std/encoding/base64url";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(
 *   decodeBase64Url("Zm9vYmFy"),
 *   new TextEncoder().encode("foobar")
 * );
 * ```
 */
export function decodeBase64Url(b64url: string): Uint8Array_ {
  const output = new TextEncoder().encode(b64url) as Uint8Array_;
  // deno-lint-ignore no-explicit-any
  return new Uint8Array((output.buffer as any)
    .transfer(decode(output, 0, 0, rAlphabet, padding)));
}

// denoCacheMetadata={"headers":{"cf-cache-status":"HIT","cross-origin-resource-policy":"cross-origin","cache-control":"public, max-age=31536000, immutable","content-encoding":"identity","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","content-length":"2487","access-control-allow-origin":"*","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-jsr-backend":"modules","set-cookie":"__cf_bm=uKKXM2KcLBCPpAu9cD_hqumQJJn8Px.QKDPlZ5.X4vo-1793178536.4993274-1.0.1.1-_Ta05sUGiV0_QuN0Woakq0bMC59lDqvZwOEXO39y_.bv.paiG7NdckfEExLLV7WLNWc_En6z5WYKvoxgco7yE3wrB_tiU5EwfMPzn3NONLQ03fvuiklzdayM7434AUE6; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","x-content-type-options":"nosniff","content-type":"text/typescript","cf-ray":"a518cc7d1bcb6c93-LAX","age":"1049814","vary":"accept-encoding, Origin","x-robots-tag":"noindex","alt-svc":"h3=\":443\"; ma=86400","etag":"\"3c3b12102aa2e1139900753de5662fba\"","accept-ranges":"bytes","server":"cloudflare","access-control-expose-headers":"*","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=lDkApb6DwvXSD1i6lMjOui1m0gpD8TawqaUZFO1b8Xg3qWAF7%2BNbiC89o9OAe3UXA3rAcEALKt9quWBx2DO4C4N753W%2B0vADMfK1%2Fw4qE6ExcnH718trzkU%3D\"}]}"},"url":"https://jsr.io/@std/encoding/1.0.11/base64url.ts","time":1793178536}