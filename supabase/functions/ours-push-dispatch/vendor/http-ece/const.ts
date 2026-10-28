// @ts-nocheck
/**
 * Size (in bytes) of salt block in encryption content-coding header.
 */
export const SALT_LENGTH = 16;
/**
 * Size (in bytes) of record size block in encryption content-coding header.
 */
export const RS_LENGTH = 4;

/**
 * Size (in bytes) of idlen block in encryption content-coding header.
 */
export const IDLEN_LENGTH = 1;

/**
 * Size (in bytes) of content-encryption key.
 */
export const KEY_LENGTH = 16;

/**
 * Size of authentication tag block in encryption content-coding header.
 */
export const TAG_LENGTH = 16;

/**
 * Size of a nonce.
 */
export const NONCE_LENGTH = 12;

/**
 * Minimum size of an encryption content-coding header.
 */
export const HEADER_LENGTH_MIN = SALT_LENGTH + RS_LENGTH + IDLEN_LENGTH;

/**
 * Default size of a record.
 */
export const DEFAULT_RECORD_SIZE = 1024 * 64;
/**
 * Minimum size of a record.
 */
export const RECORD_SIZE_MIN = 18;
/**
 * Maximum size of a record.
 */
export const RECORD_SIZE_MAX = 2 ** 36 - 31;

const encoder: TextEncoder = new TextEncoder();

/**
 * Content-encryption key info as in https://www.rfc-editor.org/rfc/rfc8188#section-2.2
 */
export const CEK_INFO: Uint8Array = encoder.encode(
  "Content-Encoding: aes128gcm\0",
);

/**
 * Nonce info as in https://www.rfc-editor.org/rfc/rfc8188#section-2.3
 */
export const NONCE_INFO: Uint8Array = encoder.encode(
  "Content-Encoding: nonce\0",
);
/**
 * Uint8Array of size 1 containing a single byte of value 1.
 * This is mostly used for concatenation with others Uint8Array.
 */
export const ONE_BYTE: Uint8Array = encoder.encode("\x01");

// denoCacheMetadata={"headers":{"set-cookie":"__cf_bm=SR_3AFDlIllFMgZmfaF2KGdUdhRW3J1N2aeoQIqAKZE-1793178536.508379-1.0.1.1-F50q3IDmTMwJECcUJr0RnxGotHSWkyffotZHLN7niB1VUCt3uc8_Vl_x_PgL4BxNNJboMv5V2O1Qh38XyYRGDQR.MpiYBEL_1dXgXqDUQUp3aAmRQlu.vEh5Ge7jOI7Y; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","alt-svc":"h3=\":443\"; ma=86400","access-control-expose-headers":"*","x-jsr-backend":"modules","content-length":"1565","cf-ray":"a518cc7d1bf36c93-LAX","age":"3137","content-type":"text/typescript","cross-origin-resource-policy":"cross-origin","x-robots-tag":"noindex","cache-control":"public, max-age=31536000, immutable","cf-cache-status":"HIT","accept-ranges":"bytes","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","server":"cloudflare","etag":"\"114894af4c885d946286abd1c297cc42\"","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=aAbZvH9Tfqo%2Fk%2FTkiyambbSHZwK09Yk6yoK%2FmHRNeVN6CWWv8DGluN9uVgDFfmzkI9GsB5E90GuJNlA%2BNldk63TDWJRuYEzuWwgobLcH9IuahEzfcD0XfWo%3D\"}]}","x-content-type-options":"nosniff","access-control-allow-origin":"*","vary":"Origin","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';"},"url":"https://jsr.io/@negrel/http-ece/0.7.0/const.ts","time":1793178536}