import crypto from 'crypto';
import { encryptSecret, decryptSecret } from './crypto';

/**
 * Derives a deterministic branch-salted HMAC-SHA256 blind index for exact search on encrypted values.
 */
export function computeBlindIndex(value: string | null | undefined, salt: string): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s\-_]/g, '');
  if (!normalized) return null;

  const key = crypto.createHash('sha256').update(`nova-kyc-salt:${salt}`).digest();
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

/**
 * Partially masks a National Identification Number (NIN) or Passport Number.
 * Example: 'CM890123456789K' -> 'CM89******789K'
 */
export function maskIdentifier(identifier: string | null | undefined): string {
  if (!identifier) return '';
  const trimmed = identifier.trim();
  if (trimmed.length <= 6) {
    return '***';
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}${'*'.repeat(Math.max(4, trimmed.length - 8))}${suffix}`;
}

/**
 * Partially masks a phone number.
 * Example: '+256700112233' -> '+256 700 *** *33'
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length <= 6) return '***';
  const prefix = clean.slice(0, 7);
  const suffix = clean.slice(-2);
  return `${prefix} *** *${suffix}`;
}

/**
 * Normalizes Ugandan and international phone numbers to E.164.
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+256' + cleaned.slice(1);
  } else if (cleaned.startsWith('256') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export { encryptSecret, decryptSecret };
