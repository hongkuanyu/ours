// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.
// This module is browser compatible.

/**
 * Returns `true` if the suffix array appears at the end of the source array,
 * `false` otherwise.
 *
 * The complexity of this function is `O(suffix.length)`.
 *
 * @param source Source array to check.
 * @param suffix Suffix array to check for.
 * @returns `true` if the suffix array appears at the end of the source array,
 * `false` otherwise.
 *
 * @example Basic usage
 * ```ts
 * import { endsWith } from "@std/bytes/ends-with";
 * import { assertEquals } from "@std/assert";
 *
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const suffix = new Uint8Array([1, 2, 3]);
 *
 * assertEquals(endsWith(source, suffix), true);
 * ```
 */
export function endsWith(source: Uint8Array, suffix: Uint8Array): boolean {
  const diff = source.length - suffix.length;
  if (diff < 0) {
    return false;
  }
  for (let i = suffix.length - 1; i >= 0; i--) {
    if (source[diff + i] !== suffix[i]) {
      return false;
    }
  }
  return true;
}

// denoCacheMetadata={"headers":{"report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=rnKCaH8lwqJu7AW0fGCpSJd88k7v88FyL92qdSkfnMzLRb6rpnT3o3xb3B54To15tZcXdDY5rHSdkQYxm0YWWMoc2dUe9yOrA%2FkWNtLnu9UG7kYluqBnAZM%3D\"}]}","access-control-expose-headers":"*","x-content-type-options":"nosniff","age":"1635848","access-control-allow-origin":"*","server":"cloudflare","date":"Wed, 28 Oct 2026 09:08:56 GMT","cf-cache-status":"HIT","set-cookie":"__cf_bm=oMSg4FtDBLlQVaI56Da9rEOkV7pfd.9FsZ8zn.32ZPg-1793178536.5031395-1.0.1.1-LIGNeoGQ9_Wvs2aGLVYOttV5LdRorfqbJ3gOwlYQqQE1JKHro6OnECI3WTguiuTdKCuuSih0bjt2Aag5e4CVJ2ncMlfouQIcz5aQ7OX2n7Sr16iZmRtqTIs1LFqK0wqI; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","x-jsr-backend":"modules","content-type":"text/typescript","x-robots-tag":"noindex","content-length":"1052","etag":"\"8d95d174e09ef25a6c3bc2987a7dd600\"","cf-ray":"a518cc7d1be36c93-LAX","vary":"Origin","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","alt-svc":"h3=\":443\"; ma=86400","cache-control":"public, max-age=31536000, immutable","accept-ranges":"bytes","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","cross-origin-resource-policy":"cross-origin"},"url":"https://jsr.io/@std/bytes/1.0.6/ends_with.ts","time":1793178536}