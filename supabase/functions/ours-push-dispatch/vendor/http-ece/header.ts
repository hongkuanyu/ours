// @ts-nocheck
import {
  bytes,
  decodeBase64,
  decodeBase64Url,
  encodeBase64,
  encodeBase64Url,
} from "./deps.ts";

import {
  DEFAULT_RECORD_SIZE,
  HEADER_LENGTH_MIN,
  IDLEN_LENGTH,
  RECORD_SIZE_MAX,
  RECORD_SIZE_MIN,
  RS_LENGTH,
  SALT_LENGTH,
} from "./const.ts";
import { Salt } from "./salt.ts";

/**
 * Options for Header class.
 */
export interface HeaderOptions {
  salt?: Salt | Uint8Array | ArrayBuffer;
  rs?: number;
  keyid?: Uint8Array;
}

/**
 * Header define Encryption Content-Coding Header (https://www.rfc-editor.org/rfc/rfc8188#section-2.1)
 */
export class Header {
  public readonly salt: Salt;
  public readonly rs: number;
  public readonly keyid: Uint8Array;

  public get idlen(): number {
    return this.keyid.byteLength;
  }

  public get byteLength(): number {
    return HEADER_LENGTH_MIN + this.idlen;
  }

  constructor(
    {
      salt = new Salt(),
      rs = DEFAULT_RECORD_SIZE,
      keyid = new Uint8Array(),
    }: HeaderOptions,
  ) {
    if (rs < RECORD_SIZE_MIN || rs > RECORD_SIZE_MAX) {
      throw new RecordSizeError(rs);
    }

    this.salt = salt instanceof Salt ? salt : new Salt(salt);
    this.rs = rs;
    this.keyid = keyid;
  }

  public static fromBytes(buf: ArrayBuffer): Header {
    if (buf.byteLength < HEADER_LENGTH_MIN) {
      throw new HeaderSizeError(buf);
    }

    const dv = new DataView(buf);

    let cur = 0;
    const salt = dv.buffer.slice(0, SALT_LENGTH);
    cur += SALT_LENGTH;

    const rs = dv.getUint32(cur);
    cur += RS_LENGTH;

    const idlen = dv.getUint8(cur);
    cur += IDLEN_LENGTH;

    const keyid = dv.buffer.slice(cur, cur + idlen);
    cur += idlen;

    return new Header({
      salt: new Salt(salt),
      rs,
      keyid: new Uint8Array(keyid),
    });
  }

  public static fromBase64(b: string): Header {
    return Header.fromBytes(decodeBase64(b).buffer);
  }

  public static fromBase64Url(b: string): Header {
    return Header.fromBytes(decodeBase64Url(b).buffer);
  }

  public toBytes(): ArrayBuffer {
    const bytes = new Uint8Array(this.byteLength);
    const dv = new DataView(bytes.buffer);

    bytes.set(this.salt);
    dv.setUint32(SALT_LENGTH, this.rs);
    dv.setUint8(SALT_LENGTH + RS_LENGTH, this.idlen);
    bytes.set(this.keyid, SALT_LENGTH + RS_LENGTH + IDLEN_LENGTH);

    return bytes.buffer;
  }

  public toBase64(): string {
    return encodeBase64(this.toBytes());
  }

  public toBase64Url(): string {
    return encodeBase64Url(this.toBytes());
  }

  public equals(other: Header): boolean {
    return bytes.equals(this.salt, other.salt) &&
      this.rs === other.rs &&
      bytes.equals(this.keyid, other.keyid);
  }
}

/**
 * RecordSizeError is thrown when record size exceed maximum size of is less than
 * minimum record size.
 */
export class RecordSizeError extends Error {
  constructor(rs: number) {
    super(
      `record size must be comprised between ${RECORD_SIZE_MIN} and ${RECORD_SIZE_MAX}: got ${rs}`,
    );
  }
}

/**
 * HeaderSizeError is thrown when encryption content-coding header is less than
 * minimum header size.
 */
export class HeaderSizeError extends Error {
  constructor(bytes: ArrayBuffer) {
    super(
      `header block must be at least ${HEADER_LENGTH_MIN} byte long: got ${bytes.byteLength}`,
    );
  }
}

// denoCacheMetadata={"headers":{"access-control-expose-headers":"*","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","x-jsr-backend":"modules","content-type":"text/typescript","x-content-type-options":"nosniff","cf-cache-status":"HIT","cf-ray":"a518cc7d1bee6c93-LAX","access-control-allow-origin":"*","etag":"\"d8996a94212cb38099c050218c5b8866\"","age":"805472","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=aJpVkIkBosW0Rx3lwbkMRNBCriQdL6GYW8oQqXYT3X1YRL6nu8Dk4NOhkYzl74EQ6ppf0B%2FnZSDdbDs0cR7zEPAybbIPnPisBDB%2BtdEPzjY15Z6dPYwdTX4%3D\"}]}","set-cookie":"__cf_bm=1p6LEwmqQ0Tbm5eKYNfMSEY9kZkhLstwu28VdMxdj3E-1793178536.506767-1.0.1.1-9ZC9OaW96B7pi75EDvxPitCCHJVnfKT56LlOSpTK0TE4_FqcA2nLmHl53FDTym9.P_A3FrmWIIb0jUOcjbvfAY7zL7BEhbqZb5rpzEzxlxeRmenCIFXTLteR2WERL_nW; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","accept-ranges":"bytes","x-robots-tag":"noindex","content-length":"3279","server":"cloudflare","cache-control":"public, max-age=31536000, immutable","alt-svc":"h3=\":443\"; ma=86400","vary":"Origin","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","cross-origin-resource-policy":"cross-origin","date":"Wed, 28 Oct 2026 09:08:56 GMT"},"url":"https://jsr.io/@negrel/http-ece/0.7.0/header.ts","time":1793178536}