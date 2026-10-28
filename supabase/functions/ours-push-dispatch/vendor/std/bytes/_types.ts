// @ts-nocheck
// Copyright 2018-2025 the Deno authors. MIT license.

/**
 * Proxy type of {@code Uint8Array<ArrayBuffer} or {@code Uint8Array} in TypeScript 5.7 or below respectively.
 *
 * This type is internal utility type and should not be used directly.
 *
 * @internal @private
 */

export type Uint8Array_ = ReturnType<Uint8Array["slice"]>;

// denoCacheMetadata={"headers":{"cross-origin-resource-policy":"cross-origin","cf-cache-status":"HIT","etag":"\"82430e6b74ddf8ae839923afbd532e9f\"","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","cache-control":"public, max-age=31536000, immutable","server":"cloudflare","access-control-allow-origin":"*","set-cookie":"__cf_bm=6h6msiVbW8z3JjP3V6h3MiYYvR5VCimJag9upQL1zMg-1793178536.5088744-1.0.1.1-JwyjogYICsZ54lQS6x2z4zTKqueFQUuMjFG1rIBIMbAkV3IntfxoI1j4.ofxBHOX9Tsr93LzuIW7SRnTVeIcIGci_a.Plu9k1emljNMb2yGEYZROIBLxN.KV8X9Hm26k; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","content-length":"333","vary":"Origin","age":"1031","accept-ranges":"bytes","access-control-expose-headers":"*","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-robots-tag":"noindex","alt-svc":"h3=\":443\"; ma=86400","content-type":"text/typescript","date":"Wed, 28 Oct 2026 09:08:56 GMT","cf-ray":"a518cc7d1bf56c93-LAX","x-jsr-backend":"modules","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=XXqTn1fNJAHYszLFJ1ilNQ%2BvpKwkcAWGxXagQr59sZ3v3wuRvb6Co%2B%2B3Xypq9HII%2FGR209h5NqZ897EHfzwZKl66pMBeORgF1qPpVEY88yuS1IhGK9iQBy4%3D\"}]}","x-content-type-options":"nosniff"},"url":"https://jsr.io/@std/bytes/1.0.6/_types.ts","time":1793178536}