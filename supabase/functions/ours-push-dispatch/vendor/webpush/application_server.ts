// @ts-nocheck
import { PushSubscriber, PushSubscription } from "./subscriber.ts";

/**
 * ApplicationServer define a Push application server as specified in RFC 8291.
 *
 * See https://www.rfc-editor.org/rfc/rfc8291#section-1
 */
export class ApplicationServer {
  public readonly crypto: SubtleCrypto;

  // Application Server (AS) keys.
  public readonly keys: CryptoKeyPair;

  // AS public key in raw format.
  private publicKeyRaw: Uint8Array | null = null;

  // VAPID AS contact information.
  public readonly contactInformation: string;
  public readonly vapidKeys: CryptoKeyPair;
  private publicVapidKeyRaw: Uint8Array | null = null;

  constructor(
    {
      crypto = globalThis.crypto.subtle,
      keys,
      contactInformation,
      vapidKeys,
    }: {
      crypto?: SubtleCrypto;
      keys: CryptoKeyPair;
      contactInformation: string;
      vapidKeys: CryptoKeyPair;
    },
  ) {
    this.crypto = crypto;
    this.contactInformation = contactInformation;
    this.keys = keys;
    this.vapidKeys = vapidKeys;
  }

  static async new(
    { crypto = globalThis.crypto.subtle, contactInformation, vapidKeys }: {
      crypto?: SubtleCrypto;
      contactInformation: string;
      vapidKeys: CryptoKeyPair;
    },
  ): Promise<ApplicationServer> {
    const keys = await crypto.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      false,
      ["deriveKey"],
    );

    return new ApplicationServer({
      crypto,
      keys,
      contactInformation,
      vapidKeys,
    });
  }

  async getPublicKeyRaw(): Promise<Uint8Array> {
    if (this.publicKeyRaw === null) {
      this.publicKeyRaw = new Uint8Array(
        await this.crypto.exportKey(
          "raw",
          this.keys.publicKey,
        ),
      );
    }

    return this.publicKeyRaw;
  }

  async getVapidPublicKeyRaw(): Promise<Uint8Array> {
    if (this.publicVapidKeyRaw === null) {
      this.publicVapidKeyRaw = new Uint8Array(
        await this.crypto.exportKey(
          "raw",
          this.vapidKeys.publicKey,
        ),
      );
    }

    return this.publicVapidKeyRaw;
  }

  subscribe(sub: PushSubscription): PushSubscriber {
    return new PushSubscriber(this, sub);
  }
}

// denoCacheMetadata={"headers":{"nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","cf-cache-status":"HIT","date":"Wed, 28 Oct 2026 09:08:56 GMT","age":"2322137","cross-origin-resource-policy":"cross-origin","x-content-type-options":"nosniff","cache-control":"public, max-age=31536000, immutable","etag":"\"e1e7f43d7da92c8eb0bdf8d449f0cb9e\"","server":"cloudflare","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=IXspzFvyKCKvpDmEHmzEqNf9eW7YYxqb2CNFRbPEKrHhtIh%2B9B0QWCgliV9UfKU58akU%2Bi5CPOCjBNAbaI0D0tEKLW8VqPgiTxV0XRwR2DSaWE%2FgOjVdKnY%3D\"}]}","alt-svc":"h3=\":443\"; ma=86400","access-control-allow-origin":"*","vary":"Origin","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","content-type":"text/typescript","access-control-expose-headers":"*","set-cookie":"__cf_bm=0z62Lu.wWNjETaNpMaEuHars.ozLkDUx4KTGo9LdXzQ-1793178536.4981718-1.0.1.1-T24d.ycaq9QlMxLCwuGdW6ZckGjCMTY.koy8Q_59yev1twQ7vSPTmT0tV14TPvOaJXku5H.IjNsKJuwOH2XdbuVAv8x5GUZxqvSRVh3GE5SAphgndVklxooAJcHcaVPx; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","content-length":"2207","accept-ranges":"bytes","x-robots-tag":"noindex","cf-ray":"a518cc7d1bc66c93-LAX","x-jsr-backend":"modules"},"url":"https://jsr.io/@negrel/webpush/0.5.0/application_server.ts","time":1793178536}