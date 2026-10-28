// @ts-nocheck
// Copyright 2018-2026 the Deno authors. MIT license.

import type { Uint8Array_ } from "./_types.ts";
export type { Uint8Array_ };

export const padding = "=".charCodeAt(0);
export const alphabet: Record<Base64Alphabet, Uint8Array> = {
  base64: new TextEncoder()
    .encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"),
  base64url: new TextEncoder()
    .encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"),
};
export const rAlphabet: Record<Base64Alphabet, Uint8Array> = {
  base64: new Uint8Array(128).fill(64), // alphabet.base64.length
  base64url: new Uint8Array(128).fill(64),
};
alphabet.base64
  .forEach((byte, i) => rAlphabet.base64[byte] = i);
alphabet.base64url
  .forEach((byte, i) => rAlphabet.base64url[byte] = i);

/**
 * Options for encoding and decoding base64 strings.
 */
export interface Base64Options {
  /** The base64 alphabet. Defaults to "base64" */
  alphabet?: Base64Alphabet;
}

/**
 * The base64 alphabets.
 */
export type Base64Alphabet = "base64" | "base64url";

/**
 * Calculate the output size needed to encode a given input size for
 * {@linkcode encodeIntoBase64}.
 *
 * @param originalSize The size of the input buffer.
 * @returns The size of the output buffer.
 *
 * @example Basic Usage
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { calcSizeBase64 } from "@std/encoding/unstable-base64";
 *
 * assertEquals(calcSizeBase64(1), 4);
 * ```
 */
export function calcSizeBase64(originalSize: number): number {
  return ((originalSize + 2) / 3 | 0) * 4;
}

export function encode(
  buffer: Uint8Array_,
  i: number,
  o: number,
  alphabet: Uint8Array,
  padding: number,
): number {
  i += 2;
  for (; i < buffer.length; i += 3) {
    const x = (buffer[i - 2]! << 16) | (buffer[i - 1]! << 8) | buffer[i]!;
    buffer[o++] = alphabet[x >> 18]!;
    buffer[o++] = alphabet[x >> 12 & 0x3F]!;
    buffer[o++] = alphabet[x >> 6 & 0x3F]!;
    buffer[o++] = alphabet[x & 0x3F]!;
  }
  switch (i) {
    case buffer.length + 1: {
      const x = buffer[i - 2]! << 16;
      buffer[o++] = alphabet[x >> 18]!;
      buffer[o++] = alphabet[x >> 12 & 0x3F]!;
      buffer[o++] = padding;
      buffer[o++] = padding;
      break;
    }
    case buffer.length: {
      const x = (buffer[i - 2]! << 16) | (buffer[i - 1]! << 8);
      buffer[o++] = alphabet[x >> 18]!;
      buffer[o++] = alphabet[x >> 12 & 0x3F]!;
      buffer[o++] = alphabet[x >> 6 & 0x3F]!;
      buffer[o++] = padding;
      break;
    }
  }
  return o;
}

export function decode(
  buffer: Uint8Array_,
  i: number,
  o: number,
  alphabet: Uint8Array,
  padding: number,
): number {
  for (let x = buffer.length - 2; x < buffer.length; ++x) {
    if (buffer[x] === padding) {
      for (let y = x + 1; y < buffer.length; ++y) {
        if (buffer[y] !== padding) {
          throw new TypeError(
            `Cannot decode input as base64: Invalid character (${
              String.fromCharCode(buffer[y]!)
            })`,
          );
        }
      }
      buffer = buffer.subarray(0, x);
      break;
    }
  }
  if ((buffer.length - o) % 4 === 1) {
    throw new RangeError(
      `Cannot decode input as base64: Length (${
        buffer.length - o
      }), excluding padding, must not have a remainder of 1 when divided by 4`,
    );
  }

  i += 3;
  for (; i < buffer.length; i += 4) {
    const x = (getByte(buffer[i - 3]!, alphabet) << 18) |
      (getByte(buffer[i - 2]!, alphabet) << 12) |
      (getByte(buffer[i - 1]!, alphabet) << 6) |
      getByte(buffer[i]!, alphabet);
    buffer[o++] = x >> 16;
    buffer[o++] = x >> 8 & 0xFF;
    buffer[o++] = x & 0xFF;
  }
  switch (i) {
    case buffer.length + 1: {
      const x = (getByte(buffer[i - 3]!, alphabet) << 18) |
        (getByte(buffer[i - 2]!, alphabet) << 12);
      buffer[o++] = x >> 16;
      break;
    }
    case buffer.length: {
      const x = (getByte(buffer[i - 3]!, alphabet) << 18) |
        (getByte(buffer[i - 2]!, alphabet) << 12) |
        (getByte(buffer[i - 1]!, alphabet) << 6);
      buffer[o++] = x >> 16;
      buffer[o++] = x >> 8 & 0xFF;
      break;
    }
  }
  return o;
}

function getByte(char: number, alphabet: Uint8Array): number {
  const byte = alphabet[char] ?? 64;
  if (byte === 64) { // alphabet.Base64.length
    throw new TypeError(
      `Cannot decode input as base64: Invalid character (${
        String.fromCharCode(char)
      })`,
    );
  }
  return byte;
}

// denoCacheMetadata={"headers":{"content-type":"text/typescript","vary":"accept-encoding, Origin","accept-ranges":"bytes","cf-ray":"a518cc7d1bd26c93-LAX","access-control-expose-headers":"*","content-length":"4447","server":"cloudflare","content-security-policy":"default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; sandbox; form-action 'none';","cross-origin-resource-policy":"cross-origin","x-jsr-backend":"modules","set-cookie":"__cf_bm=Ue8pJWn664AgFEhoEpHGhAVvvjQPQ5CIHI2MJD1Jffc-1793178536.5010283-1.0.1.1-1j4P_8RzNi6HnOudqt9gCOBhGLKSfvDWuvPxCntq4NMJ00WwbGOI3cA_12Wb23eH8s6behaLZfKSzwNy5nUK8O0RYtOt6IzdcGyOd.rzaI6PDlO6wqkaRcWoSBHB0XM4; HttpOnly; SameSite=None; Secure; Path=/; Domain=jsr.io; Expires=Wed, 28 Oct 2026 09:38:56 GMT","date":"Wed, 28 Oct 2026 09:08:56 GMT","cf-cache-status":"HIT","access-control-allow-origin":"*","cache-control":"public, max-age=31536000, immutable","content-encoding":"identity","x-robots-tag":"noindex","alt-svc":"h3=\":443\"; ma=86400","etag":"\"595862cf4a3948f79eecb730eedd6a9e\"","x-content-type-options":"nosniff","report-to":"{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=vVZ%2BmEN0Vpj8Ni8cq4EA6He2KE4xAs6GO3Iwhq%2B1S%2B7IesVYcA%2BHiqAi9mP45QynIShgoz0xcB1qLKSI0kIiNVpD4KczAU2cF1sQUAmyP2RZHu9AkTj%2BdOM%3D\"}]}","nel":"{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}","age":"685785"},"url":"https://jsr.io/@std/encoding/1.0.11/_common64.ts","time":1793178536}