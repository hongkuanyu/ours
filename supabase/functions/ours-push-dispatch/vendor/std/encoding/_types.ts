// @ts-nocheck
// Copyright 2018-2026 the Deno authors. MIT license.

/**
 * Proxy type of {@code Uint8Array<ArrayBuffer>} or {@code Uint8Array} in TypeScript 5.7 or below respectively.
 *
 * This type is internal utility type and should not be used directly.
 *
 * @internal @private
 */

export type Uint8Array_ = ReturnType<Uint8Array["slice"]>;

// denoCacheMetadata={"headers":{"cache-control":"public, max-age=31536000, immutable","accept-ranges":"bytes","alt-svc":"h3=\":443\"; ma=86400","server":"cloudflare","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","vary":"accept-encoding, Origin","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","cf-cache-status":"HIT","access-control-expose-headers":"*","access-control-allow-origin":"*","content-length":"334","etag":"\"5c33cb6ba71e2370ee3a0f30a98c22e4\"","content-encoding":"identity","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-type":"text/typescript","cross-origin-resource-policy":"cross-origin","x-content-type-options":"nosniff","x-jsr-backend":"modules","cf-ray":"a518cc7d1bd86c93-LAX","set-cookie":"__cf_bm=pzn10YRvdyAIwGWCSGraIHR6G4666_MGiPHC9G58uqE-1793178536.5020154-1.0.1.1-3slBm48Wu10a7p8vn2iuZAXlDhJwUQ4_.sEr58ybH_6MCxH5EAiNlsMKi2IyaQmHx6PV4Bl2WN.zQbooRT3ZQa.FupwI6AtLr9D_C5pa0hBsAhKtvE7nFoClKocfIgY4; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","age":"586045","x-robots-tag":"noindex","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=BDHmYD%2FufZEkW6xCPH%2BKEEWelVNPK%2Ff7HSgZ4HJ6ossNFAKc3AxXUZkjHXs7aCdW3QwPZNOMQOXp4FLuFE7cF%2FJZQXL3sjOG9Vu0GCu77uozGI2MPSx80jI%3D\"}]}"},"url":"https://jsr.io/@std/encoding/1.0.11/_types.ts","time":1793178536}