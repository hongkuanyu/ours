// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Returns `true` if the prefix array appears at the start of the source array,
 * `false` otherwise.
 *
 * The complexity of this function is `O(prefix.length)`.
 *
 * @param source Source array to check.
 * @param prefix Prefix array to check for.
 * @returns `true` if the prefix array appears at the start of the source array,
 * `false` otherwise.
 *
 * @example Basic usage
 * ```ts
 * import { startsWith } from "@std/bytes/starts-with";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const prefix = new Uint8Array([0, 1, 2]);
 *
 * assertEquals(startsWith(source, prefix), true);
 * ```
 */
export function startsWith(source: Uint8Array, prefix: Uint8Array): boolean {
  if (prefix.length > source.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    if (source[i] !== prefix[i]) return false;
  }
  return true;
}

// denoCacheMetadata={"headers":{"set-cookie":"__cf_bm=FtpqSvmMWvoJ6BrsJwtHDo9HEmGWE_G4MPtCW6ZG0vA-1793178536.505722-1.0.1.1-liNHKCZ6AGzZkpZnI7pf4cxDejTQFH2yjklHOP6NQGZfYAzde7FsjVr1hnOlM_90WfCKQR._5LQTfCVrfnqoufB6ja320hLL8J3praEYn2x_YpUW_8qqgSYXZljmlr77; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","vary":"Origin","cf-cache-status":"HIT","content-length":"1014","cross-origin-resource-policy":"cross-origin","etag":"\"88783e8f65d4587ef4370ba81b5bcb37\"","x-robots-tag":"noindex","date":"Wed, 28 Oct 2026 09:08:56 GMT","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=D1Uk4UGB0fcPb43bXmD6Tdf4fZAtvFn7e3QfqZ%2FEEMivPiWG9p%2FvNei31SMsQWvcXLrMajT%2BANCp%2FYWa2VMLte7ZOOrgx4RhIOVb5T6jJaDxYJ8ByTyg9YE%3D\"}]}","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","cf-ray":"a518cc7d1bec6c93-LAX","accept-ranges":"bytes","access-control-allow-origin":"*","age":"2322137","cache-control":"public, max-age=31536000, immutable","server":"cloudflare","access-control-expose-headers":"*","alt-svc":"h3=\":443\"; ma=86400","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-jsr-backend":"modules","content-type":"text/typescript","x-content-type-options":"nosniff"},"url":"https://jsr.io/@std/bytes/1.0.6/starts_with.ts","time":1793178536}