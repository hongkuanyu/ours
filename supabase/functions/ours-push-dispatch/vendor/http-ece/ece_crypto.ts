// @ts-nocheck
import { Header, HeaderOptions } from "./header.ts";
import {
  CEK_INFO,
  KEY_LENGTH,
  NONCE_INFO,
  NONCE_LENGTH,
  ONE_BYTE,
} from "./const.ts";
import { bytes } from "./deps.ts";

/**
 * Options for ECECrypto.
 */
export interface ECECryptoOptions {
  header?: Header | HeaderOptions;
  info?: Uint8Array;
  nonceInfo?: Uint8Array;
  subtleCrypto?: SubtleCrypto;
}

/**
 * ECECrypto define an helper class that handle the
 * encryption and decryption of records one by one.
 * This class is stateless and is used as a building
 * block for encrypt & decrypt function.
 */
export class ECECrypto {
  public readonly info: Uint8Array;
  public readonly nonceInfo: Uint8Array;
  public readonly header: Header;
  public readonly crypto: SubtleCrypto;

  // Input Keying Material
  private readonly ikm: ArrayBuffer;

  // Pseudo Random Key
  private prk: ArrayBuffer | null = null;

  // Content Encryption Key
  private cek: CryptoKey | null = null;

  // Number once
  private nonce: ArrayBuffer | null = null;

  constructor(
    ikm: ArrayBuffer,
    {
      header = new Header({}),
      info = CEK_INFO,
      nonceInfo = NONCE_INFO,
      subtleCrypto = crypto.subtle,
    }: ECECryptoOptions,
  ) {
    this.ikm = ikm;
    this.info = bytes.concat([info, ONE_BYTE]);
    this.header = header instanceof Header ? header : new Header(header);
    this.crypto = subtleCrypto;
    this.nonceInfo = bytes.concat([nonceInfo, ONE_BYTE]);
  }

  protected async getPRK(): Promise<ArrayBuffer> {
    if (this.prk === null) {
      this.prk = await this.hmacSha256(
        this.header.salt.buffer,
        this.ikm,
      );
    }

    return this.prk;
  }

  protected async getCEK(): Promise<CryptoKey> {
    let rawCEK: ArrayBuffer | null = null;
    if (this.cek === null) {
      rawCEK = await this.hmacSha256(
        await this.getPRK(),
        this.info,
        KEY_LENGTH,
      );

      this.cek = await this.crypto.importKey(
        "raw",
        rawCEK,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );
    }

    return this.cek;
  }

  protected async getNonce(): Promise<ArrayBuffer> {
    if (this.nonce === null) {
      this.nonce = await this.hmacSha256(
        await this.getPRK(),
        this.nonceInfo,
        NONCE_LENGTH,
      );
    }

    return this.nonce;
  }

  protected async deriveNonce(seq: number): Promise<Uint8Array> {
    if (seq > 0xffffffff) {
      throw new ExceedRecordSequenceNumberError(seq);
    }

    const nonce = new DataView((await this.getNonce()).slice(0));
    const m = nonce.getUint32(nonce.byteLength - 4);
    // forces unsigned int xor
    const xor = (m ^ seq) >>> 0;
    nonce.setUint32(nonce.byteLength - 4, xor);
    return new Uint8Array(nonce.buffer);
  }

  protected async hmacSha256(
    secret: CryptoKey | ArrayBuffer,
    body: ArrayBuffer,
    length?: number,
  ): Promise<ArrayBuffer> {
    if (secret instanceof ArrayBuffer) {
      secret = await this.crypto.importKey(
        "raw",
        secret,
        {
          name: "HMAC",
          hash: "SHA-256",
        },
        false,
        ["sign"],
      );
    }

    const result = await this.crypto.sign("HMAC", secret, body);

    if (length !== null) return result.slice(0, length);

    return result;
  }

  /** Encrypt a single record.
   * @param data is padded data of size rs to encrypt
   * @param seq is the record sequence number
   * @returns encrypted data
   */
  public async encryptRecord(
    data: ArrayBuffer,
    seq: number,
  ): Promise<ArrayBuffer> {
    return this._encryptRecord(data, seq, await this.getCEK());
  }

  private async _encryptRecord(
    data: ArrayBuffer,
    seq: number,
    cek: CryptoKey,
  ): Promise<ArrayBuffer> {
    const crypted = await this.crypto.encrypt(
      {
        name: "AES-GCM",
        iv: await this.deriveNonce(seq),
        tagLength: 128,
      },
      cek,
      data,
    );

    return crypted;
  }

  /** Decrypt a single record.
   * @param crypted is the crypted record
   * @param seq is the record sequence number
   * @returns decrypted record
   */
  public async decryptRecord(
    crypted: ArrayBuffer,
    seq: number,
  ): Promise<ArrayBuffer> {
    return this._decryptRecord(crypted, seq, await this.getCEK());
  }

  private async _decryptRecord(
    crypted: ArrayBuffer,
    seq: number,
    cek: CryptoKey,
  ): Promise<ArrayBuffer> {
    const data = await this.crypto.decrypt(
      {
        name: "AES-GCM",
        iv: await this.deriveNonce(seq),
        tagLength: 128,
      },
      cek,
      crypted,
    );

    return data;
  }
}

export class ExceedRecordSequenceNumberError extends Error {
  constructor(seq: number) {
    super(`record sequence number exceed limit (${0xffffffff}): got ${seq}`);
  }
}

// denoCacheMetadata={"headers":{"cache-control":"public, max-age=31536000, immutable","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","content-length":"4793","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","accept-ranges":"bytes","server":"cloudflare","cf-cache-status":"HIT","etag":"\"0cff717d80617245b4c6b7cc695dc3ad\"","vary":"Origin","cf-ray":"a518cc7d1bf16c93-LAX","age":"1118631","access-control-expose-headers":"*","x-jsr-backend":"modules","set-cookie":"__cf_bm=uH8wypQCpvK0w_i0i8UQgiBUdtOQOoozJsvsQqinJt0-1793178536.5082772-1.0.1.1-qdJfCWj6TkuSrYV7d5_huefOzokRVbNMqBn7g0TMXlnLuMf6mJH8nuxFMYlFufji2FTClZWG4Pb0u2agEGEENbnwh.Y3HEVZKFz1Y6MUlGBOrZP054cJD3f8mIGvxK2w; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","alt-svc":"h3=\":443\"; ma=86400","date":"Wed, 28 Oct 2026 09:08:56 GMT","content-type":"text/typescript","cross-origin-resource-policy":"cross-origin","access-control-allow-origin":"*","x-content-type-options":"nosniff","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=PmsAM2U4aRsxBv4GN1A5qPCBvJ9utT9NMOQS54UK%2BeLvWTf36VlVyAbDU3duBe6nO9GQKVRGsEL18DQm8X%2BQBLs74M13DR6Pp4ZxTRx%2BUp50yojte2CZ2so%3D\"}]}","x-robots-tag":"noindex"},"url":"https://jsr.io/@negrel/http-ece/0.7.0/ece_crypto.ts","time":1793178536}