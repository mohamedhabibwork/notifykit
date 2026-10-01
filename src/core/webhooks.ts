/**
 * Runtime-neutral webhook signature plumbing shared by delivery-status helpers.
 * Uses Web Crypto (Node 20+, Bun, Deno) so drivers keep zero dependencies and
 * no Node builtins.
 */

const encoder = new TextEncoder();

export type HmacAlgorithm = "SHA-256" | "SHA-1";

export async function computeHmac(
  algorithm: HmacAlgorithm,
  secret: string,
  payload: string,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(payload));
}

export const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const toBase64 = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

/**
 * Length-independent constant-time comparison of two ASCII signature
 * encodings; mismatched lengths compare all bytes and never short-circuit
 * on content.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const mismatch = left.length === right.length ? 0 : 1;
  const length = Math.max(left.length, right.length);
  let diff = 0;
  for (let index = 0; index < length; index++) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0 && diff === 0;
}
