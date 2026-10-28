// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Copy bytes from the source array to the destination array and returns the
 * number of bytes copied.
 *
 * If the source array is larger than what the `dst` array can hold, only the
 * amount of bytes that fit in the `dst` array are copied.
 *
 * @param src Source array to copy from.
 * @param dst Destination array to copy to.
 * @param offset Offset in the destination array to start copying to. Defaults
 * to 0.
 * @returns Number of bytes copied.
 *
 * @example Basic usage
 * ```ts
 * import { copy } from "@std/bytes/copy";
 * import { assertEquals } from "@std/assert";
 *
 * const src = new Uint8Array([9, 8, 7]);
 * const dst = new Uint8Array([0, 1, 2, 3, 4, 5]);
 *
 * assertEquals(copy(src, dst), 3);
 * assertEquals(dst, new Uint8Array([9, 8, 7, 3, 4, 5]));
 * ```
 *
 * @example Copy with offset
 * ```ts
 * import { copy } from "@std/bytes/copy";
 * import { assertEquals } from "@std/assert";
 *
 * const src = new Uint8Array([1, 1, 1, 1]);
 * const dst = new Uint8Array([0, 0, 0, 0]);
 *
 * assertEquals(copy(src, dst, 1), 3);
 * assertEquals(dst, new Uint8Array([0, 1, 1, 1]));
 * ```
 * Defining an offset will start copying at the specified index in the
 * destination array.
 */
export function copy(src: Uint8Array, dst: Uint8Array, offset = 0): number {
  offset = Math.max(0, Math.min(offset, dst.byteLength));
  const dstBytesAvailable = dst.byteLength - offset;
  if (src.byteLength > dstBytesAvailable) {
    src = src.subarray(0, dstBytesAvailable);
  }
  dst.set(src, offset);
  return src.byteLength;
}

// denoCacheMetadata={"headers":{"access-control-expose-headers":"*","cf-ray":"a518cc7d1bdf6c93-LAX","cf-cache-status":"HIT","age":"344542","cache-control":"public, max-age=31536000, immutable","cross-origin-resource-policy":"cross-origin","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-jsr-backend":"modules","vary":"Origin","x-content-type-options":"nosniff","x-robots-tag":"noindex","content-length":"1634","server":"cloudflare","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=Ln0URuDqCjQVQaLWa6sImdLovH8q1SBokG0PatC7kAWT9ZLYDGVfCDMHWwv2HnnRI5dCHPPj3K3TqHiArZMah8ygsrT0rSIiuQH3A5YBKDA2pJ91uLUTwuI%3D\"}]}","set-cookie":"__cf_bm=QzFqRViLgTFG2Z0LDYpyJb810gOxEcZdb7USrlWYRAw-1793178536.5026312-1.0.1.1-DaXxjb71hXIwQXkCWidF0zN6eUzbBzf5h5HiuN29OsxRACYlyx1CBNg_pqFkffraKixnXyfO9UYdC6UeSUCojotphMYVIsJsN3cnREAiMlEHZPJgf4b6wMd483kch7l3; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","etag":"\"5d799303f1a82e0f578db0e4640b60ad\"","alt-svc":"h3=\":443\"; ma=86400","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-type":"text/typescript","accept-ranges":"bytes","access-control-allow-origin":"*"},"url":"https://jsr.io/@std/bytes/1.0.6/copy.ts","time":1793178536}