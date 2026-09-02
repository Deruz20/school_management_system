import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM

/**
 * Derives a 32-byte key from the environment secret or fallback.
 */
function getMasterKey(): Buffer {
  const secret = process.env.FINANCE_ENCRYPTION_KEY || process.env.JWT_SECRET || 'nova-finance-secure-default-key-32chars!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Output format: enc:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted secret.
 */
export function decryptSecret(cipherBundle: string | null | undefined): string | null {
  if (!cipherBundle) return null;
  if (!cipherBundle.startsWith('enc:')) return cipherBundle; // Legacy/unencrypted fallback if present

  try {
    const parts = cipherBundle.split(':');
    if (parts.length !== 4) return null;

    const [, ivHex, authTagHex, cipherHex] = parts;
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt secret:', err);
    return null;
  }
}

/**
 * Computes an HMAC-SHA256 signature for a payload and timestamp.
 */
export function generateHmacSha256(rawBody: string, timestamp: string | number, secret: string): string {
  const payload = `${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Constant-time verification of HMAC-SHA256 webhook signatures.
 */
export function verifyHmacSha256(
  rawBody: string,
  timestamp: string | number,
  secret: string,
  providedSignature: string
): boolean {
  if (!rawBody || !timestamp || !secret || !providedSignature) return false;

  try {
    const expectedSignature = generateHmacSha256(rawBody, timestamp, secret);
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const providedBuffer = Buffer.from(providedSignature, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verifies that the webhook timestamp is within the allowable clock drift (default 5 minutes / 300s).
 */
export function isTimestampWithinDrift(timestampInput: string | number | Date, maxDriftSeconds = 300): boolean {
  try {
    let timestampMs: number;
    if (typeof timestampInput === 'number') {
      // If seconds (10 digits), convert to ms
      timestampMs = timestampInput < 10000000000 ? timestampInput * 1000 : timestampInput;
    } else if (typeof timestampInput === 'string') {
      const parsedNum = Number(timestampInput);
      if (!isNaN(parsedNum)) {
        timestampMs = parsedNum < 10000000000 ? parsedNum * 1000 : parsedNum;
      } else {
        timestampMs = new Date(timestampInput).getTime();
      }
    } else if (timestampInput instanceof Date) {
      timestampMs = timestampInput.getTime();
    } else {
      return false;
    }

    if (isNaN(timestampMs)) return false;

    const nowMs = Date.now();
    const driftMs = Math.abs(nowMs - timestampMs);
    return driftMs <= maxDriftSeconds * 1000;
  } catch {
    return false;
  }
}
