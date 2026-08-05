import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

// Centralizes every one-way password/PIN hash + compare used by the employee auth system,
// so the same work factor and semantics are used everywhere instead of each route rolling
// its own bcrypt calls. See app/api/login/route.js, app/api/auth/*, app/api/employees/*.
const SALT_ROUNDS = 10;

/** Hashes a plaintext password/PIN for storage. Never store the plaintext itself. */
export async function hashSecret(plainText) {
  if (!plainText) return null;
  return bcrypt.hash(String(plainText), SALT_ROUNDS);
}

/**
 * Compares a plaintext value against a stored bcrypt hash. Safe against missing/legacy
 * data: returns false (never throws) if either side is empty, or if `storedHash` isn't a
 * valid bcrypt hash (e.g. an employee whose password was never migrated yet).
 */
export async function verifySecret(plainText, storedHash) {
  if (!plainText || !storedHash) return false;
  try {
    return await bcrypt.compare(String(plainText), String(storedHash));
  } catch (e) {
    return false;
  }
}

/**
 * The last 4 characters of a real plaintext password - the short code usable only from a
 * trusted device. Deliberately NOT derivable from the password's hash (hashing is one-way),
 * so this must be computed once, at the moment we still hold the plaintext (on migration,
 * or whenever an employee sets a new real password), and stored separately as `pinHash`.
 */
export function last4Of(plainPassword) {
  if (!plainPassword) return null;
  const s = String(plainPassword);
  return s.length <= 4 ? s : s.slice(-4);
}

/** Generates a random, human-typeable temporary password for the forgot-password flow. */
export function generateTempPassword() {
  // Avoid ambiguous characters (0/O, 1/I/l) since this gets typed in by hand off an email.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}
