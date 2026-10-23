import crypto from 'crypto';

/**
 * Embed token verification for Banglai Cloud integration.
 *
 * When BornoOCR is embedded inside the Banglai Cloud iframe, the frontend receives
 * a signed token from Banglai Cloud's /api/bornoocr/embed-token endpoint. The token
 * is an HMAC-SHA256-signed JSON payload (base64url(payload).base64url(signature)).
 *
 * The frontend sends this token as a Bearer token. This utility verifies the
 * signature using the shared BORNOOCR_EMBED_SECRET env var.
 *
 * Token payload: { uid, email, name, plan, exp }
 */

const EMBED_SECRET = process.env.BORNOOCR_EMBED_SECRET || 'dev-bornoocr-embed-secret-change-me';

export interface EmbedPayload {
  uid: string;
  email: string;
  name: string;
  plan: string;
  exp: number;
}

function b64urlDecode(b64: string): Buffer {
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify an embed token. Returns the payload if valid, or null if the signature
 * is invalid or the token has expired.
 *
 * Heuristic: embed tokens have exactly one '.' separator and the first part is
 * valid base64url JSON. JWTs have three '.'-separated parts, so this won't
 * accidentally accept a JWT.
 */
export function verifyEmbedToken(token: string): EmbedPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null; // JWTs have 3 parts; embed tokens have 2

  const [payloadB64, sigB64] = parts;
  let payload: EmbedPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.uid || !payload.email || typeof payload.exp !== 'number') return null;

  // Check expiry
  if (Date.now() > payload.exp) return null;

  // Verify HMAC-SHA256 signature
  const expectedSig = crypto.createHmac('sha256', EMBED_SECRET).update(payloadB64).digest();
  const providedSig = b64urlDecode(sigB64);

  if (expectedSig.length !== providedSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

  return payload;
}
