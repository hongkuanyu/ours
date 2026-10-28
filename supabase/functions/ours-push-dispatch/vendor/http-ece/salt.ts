// @ts-nocheck
import { bytes } from "./deps.ts";

import { SALT_LENGTH } from "./const.ts";

/**
 * SaltLengthError is thrown when salt length is of the wrong size.
 */
export class SaltLengthError extends Error {}

/**
 * Salt define crypto salt used for HTTP Encryption Coding.
 */
export class Salt extends Uint8Array {
  constructor(salt?: Uint8Array | ArrayBuffer) {
    if (salt === undefined) {
      super(SALT_LENGTH);
      crypto.getRandomValues(this);
      return;
    }

    if (salt.byteLength != SALT_LENGTH) {
      throw new SaltLengthError(
        `salt length must be ${SALT_LENGTH}: got ${salt.byteLength}`,
      );
    }

    if (salt instanceof ArrayBuffer) {
      const copy = new Uint8Array(SALT_LENGTH);
      bytes.copy(new Uint8Array(salt), copy);
      super(copy);
      return;
    }

    super(SALT_LENGTH);
    this.set(salt, 0);
  }

  public equals(other: Salt): boolean {
    return bytes.equals(this, other);
  }
}

// denoCacheMetadata={"headers":{"report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=wpmAsVFCSyPOvfjh1W7uTpKnd2DOKkXd2U9iI2UEDrqgKybToUqF%2BSZEQlyLP1CtGyHjRL5tPpOVQdb4tCCm8j64o21lYWzxjwz70MJAvCQvq1oiVBXbUe4%3D\"}]}","cross-origin-resource-policy":"cross-origin","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","x-jsr-backend":"modules","set-cookie":"__cf_bm=Yc49eYlo_U3rk7suJTff0aTPPqhZTb65NZRY0maa1FU-1793178536.5083985-1.0.1.1-gYqiZSqmqAyE5k6fZ3ciOM0NyBYjejQL4wDK3a9MRHAqSUt.sqC44xX9Nb7RyPR9O6BP_EWXcl2yoss7AaEYlb6qeScLR6M0F_MlOGAL_aUvlZDcX1f.hboCy4w7I3zQ; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","cache-control":"public, max-age=31536000, immutable","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-length":"941","cf-ray":"a518cc7d1bef6c93-LAX","accept-ranges":"bytes","access-control-allow-origin":"*","server":"cloudflare","x-content-type-options":"nosniff","alt-svc":"h3=\":443\"; ma=86400","content-type":"text/typescript","cf-cache-status":"HIT","etag":"\"112ad363a051b57e7f6bf00cbb59d5ba\"","vary":"Origin","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-robots-tag":"noindex","age":"2474650","access-control-expose-headers":"*"},"url":"https://jsr.io/@negrel/http-ece/0.7.0/salt.ts","time":1793178536}