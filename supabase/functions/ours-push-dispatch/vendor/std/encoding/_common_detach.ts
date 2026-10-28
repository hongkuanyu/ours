// @ts-nocheck
// Copyright 2018-2026 the Deno authors. MIT license.

import type { Uint8Array_ } from "./_types.ts";
export type { Uint8Array_ };

export function detach(
  buffer: Uint8Array_,
  maxSize: number,
): [Uint8Array_, number] {
  const originalSize = buffer.length;
  if (buffer.byteOffset) {
    const b = new Uint8Array(buffer.buffer);
    b.set(buffer);
    buffer = b.subarray(0, originalSize);
  }
  // deno-lint-ignore no-explicit-any
  buffer = new Uint8Array((buffer.buffer as any).transfer(maxSize));
  buffer.set(buffer.subarray(0, originalSize), maxSize - originalSize);
  return [buffer, maxSize - originalSize];
}

// denoCacheMetadata={"headers":{"set-cookie":"__cf_bm=GSp.XQgN7xAb2SVGS_tI4yrfPwbgdb7QhIagAEsQ668-1793178536.5012176-1.0.1.1-.Xsdk0Ie_kY4dhnZsP541otfzcXUEBpEeFTx3iRH1WQCU7DIqQPtqgwdnCs1DfXHOBTWW5zZnbc7aLnMKydpy17.NV31AeAbf7BvEHNDTAk1lxZ14gIrun8QG5jUBtTY; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","cache-control":"public, max-age=31536000, immutable","content-encoding":"identity","alt-svc":"h3=\":443\"; ma=86400","content-type":"text/typescript","cf-ray":"a518cc7d1bd36c93-LAX","cf-cache-status":"HIT","content-length":"625","access-control-allow-origin":"*","etag":"\"e7be835986ec1b3ea2ea33be98f7f092\"","x-jsr-backend":"modules","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","age":"244249","access-control-expose-headers":"*","x-content-type-options":"nosniff","x-robots-tag":"noindex","server":"cloudflare","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=TeaoxtVhal6AgaSNM%2FX4w0fUw3iLCa%2BO3fLKekX0qv2O%2FNcr0TKkJh7ancb7sGCZ9kc4ST0UqZ8vvg96ys0Rjbib%2F5i0HEofzaoXPuf3euiQmIR6jNv6NxA%3D\"}]}","cross-origin-resource-policy":"cross-origin","accept-ranges":"bytes","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","vary":"accept-encoding, Origin","date":"Wed, 28 Oct 2026 09:08:56 GMT"},"url":"https://jsr.io/@std/encoding/1.0.11/_common_detach.ts","time":1793178536}