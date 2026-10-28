// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Helper functions for working with
 * {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array | Uint8Array}
 * byte slices.
 *
 * ```ts
 * import { concat, indexOfNeedle, endsWith } from "@std/bytes";
 * import { assertEquals } from "@std/assert";
 *
 * const a = new Uint8Array([0, 1, 2]);
 * const b = new Uint8Array([3, 4, 5]);
 *
 * const c = concat([a, b]);
 *
 * assertEquals(c, new Uint8Array([0, 1, 2, 3, 4, 5]));
 *
 * assertEquals(indexOfNeedle(c, new Uint8Array([2, 3])), 2);
 *
 * assertEquals(endsWith(c, b), true);
 * ```
 *
 * @module
 */
export * from "./concat.ts";
export * from "./copy.ts";
export * from "./ends_with.ts";
export * from "./equals.ts";
export * from "./includes_needle.ts";
export * from "./index_of_needle.ts";
export * from "./last_index_of_needle.ts";
export * from "./repeat.ts";
export * from "./starts_with.ts";

// denoCacheMetadata={"headers":{"etag":"\"716ab5a4d36af1ce9423584fadbcd6c6\"","cf-cache-status":"HIT","cache-control":"public, max-age=31536000, immutable","vary":"Origin","server":"cloudflare","alt-svc":"h3=\":443\"; ma=86400","date":"Wed, 28 Oct 2026 09:08:56 GMT","access-control-allow-origin":"*","set-cookie":"__cf_bm=9cFi6S6XLnGkpvoy60VNhqJq2OcWO0M8MaU66J7tpL8-1793178536.5007346-1.0.1.1-OT0Mez5J1BcYYarimCjyVgHR7O2vDH79IbO2Vv2nFrTNTuDnIaFbk45TWTQvBq.T6w11UcuI._HdWOX7wCjLTcodeK4NOwiaylUszwzhGOgtPJGieG.Gd3sJ6mj6bRWA; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","cross-origin-resource-policy":"cross-origin","x-jsr-backend":"modules","content-length":"999","cf-ray":"a518cc7d1bcc6c93-LAX","access-control-expose-headers":"*","age":"2287","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=DSO9t0SPseYEXHj03q2TLi3tqd6U9RfOtXMypgTMvs31T6RzXoY%2BzUTC5Dqkki%2F7K%2BEJPx%2Fw5reZEjjZu%2FEV%2BH25IYEXpUdcmXo3g9CtfvMFsAwX8IqQECg%3D\"}]}","accept-ranges":"bytes","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","content-type":"text/typescript","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-content-type-options":"nosniff","x-robots-tag":"noindex"},"url":"https://jsr.io/@std/bytes/1.0.6/mod.ts","time":1793178536}