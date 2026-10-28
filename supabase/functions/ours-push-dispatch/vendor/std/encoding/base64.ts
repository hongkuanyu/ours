// @ts-nocheck
// Copyright 2018-2026 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Utilities for
 * {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-4 | base64}
 * encoding and decoding.
 *
 * ```ts
 * import {
 *   encodeBase64,
 *   decodeBase64,
 * } from "@std/encoding/base64";
 * import { assertEquals } from "@std/assert";
 *
 * const foobar = new TextEncoder().encode("foobar");
 *
 * assertEquals(encodeBase64(foobar), "Zm9vYmFy");
 * assertEquals(decodeBase64("Zm9vYmFy"), foobar);
 * ```
 *
 * @module
 */

import { calcSizeBase64, decode, encode } from "./_common64.ts";
import { detach } from "./_common_detach.ts";
import type { Uint8Array_ } from "./_types.ts";
export type { Uint8Array_ };

const padding = "=".charCodeAt(0);
const alphabet = new TextEncoder()
  .encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
const rAlphabet = new Uint8Array(128).fill(64); // alphabet.length
alphabet.forEach((byte, i) => rAlphabet[byte] = i);

/**
 * Converts data into a base64-encoded string.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-4}
 *
 * @param data The data to encode.
 * @returns The base64-encoded string.
 *
 * @example Usage
 * ```ts
 * import { encodeBase64 } from "@std/encoding/base64";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(encodeBase64("foobar"), "Zm9vYmFy");
 * ```
 */
export function encodeBase64(data: ArrayBuffer | Uint8Array | string): string {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data) as Uint8Array_;
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(
    data as Uint8Array_,
    calcSizeBase64((data as Uint8Array_).length),
  );
  encode(output, i, 0, alphabet, padding);
  return new TextDecoder().decode(output);
}

/**
 * Decodes a base64-encoded string.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc4648.html#section-4}
 *
 * @param b64 The base64-encoded string to decode.
 * @returns The decoded data.
 *
 * @example Usage
 * ```ts
 * import { decodeBase64 } from "@std/encoding/base64";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(
 *   decodeBase64("Zm9vYmFy"),
 *   new TextEncoder().encode("foobar")
 * );
 * ```
 */
export function decodeBase64(b64: string): Uint8Array_ {
  const output = new TextEncoder().encode(b64) as Uint8Array_;
  // deno-lint-ignore no-explicit-any
  return new Uint8Array((output.buffer as any)
    .transfer(decode(output, 0, 0, rAlphabet, padding)));
}

// denoCacheMetadata={"headers":{"vary":"accept-encoding, Origin","accept-ranges":"bytes","access-control-allow-origin":"*","etag":"\"0372c686dc00b64b6cef3169d2586d95\"","cf-ray":"a518cc7d1bf96c93-LAX","x-jsr-backend":"modules","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=f%2FvbxfxY%2BdNlD6jyzO1oRucnP%2FFw%2BYzZq1EBK0EHErRPAoekq3IsjtWjNI4PBAi%2Fe9CN7%2FJMxDVFHdQxa8QhlBG128uemk9WIU%2BDA0MirXD9KdcNzymAH0U%3D\"}]}","x-content-type-options":"nosniff","content-encoding":"identity","content-type":"text/typescript","cf-cache-status":"HIT","server":"cloudflare","access-control-expose-headers":"*","cross-origin-resource-policy":"cross-origin","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","set-cookie":"__cf_bm=EeG92xje1Nzx2nRhbq4WXryk_WcfzE1tp8jccA3haUc-1793178536.509395-1.0.1.1-Is3Txm3SJYKSIAhWJV.DdzIcUshLpzQ9E_ayDZ4wKXg_9qmzEJqywGxyFzWSznsuVHm_4kwvN30kcqFpgcufQKU1xSlapwOQ74WPaTUr2oXxZfoFcr6aCYi4F2P6SXju; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","age":"946010","alt-svc":"h3=\":443\"; ma=86400","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-length":"2585","x-robots-tag":"noindex","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","cache-control":"public, max-age=31536000, immutable"},"url":"https://jsr.io/@std/encoding/1.0.11/base64.ts","time":1793178536}