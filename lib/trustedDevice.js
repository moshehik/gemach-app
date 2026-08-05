import { randomBytes, createHash } from 'crypto';
import prisma from '@/app/lib/prisma';

// "Trusted system computer" (מחשב מערכת) support for the fast 4-digit login path.
//
// Trust model (see app/api/login/route.js for how this gates the PIN path):
//   - A manager marks a computer trusted (POST /api/auth/trusted-device). The server
//     generates a random 256-bit token, stores only its SHA-256 hash in TrustedDevice,
//     and sets the raw token in an httpOnly cookie on that browser.
//   - The 4-digit PIN path at login is only ever attempted if the request carries a
//     cookie whose hash matches a non-revoked TrustedDevice row. Knowing an employee's
//     4-digit code alone is worthless without also holding that cookie - the security
//     boundary is "possession of this specific browser's trusted_device cookie", not the
//     PIN. The PIN is low-entropy by design (4 digits) but is never accepted on its own.
//   - The cookie is httpOnly + sameSite=lax so it can't be read or set by page script,
//     and is scoped to this origin - a different machine/browser never has it, so it
//     can't be "known" or guessed the way a password can, only stolen off that specific
//     device (an accepted tradeoff for a small gemach's own shared front-desk computers).

export const TRUSTED_DEVICE_COOKIE = 'trusted_device';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // ~400 days: the practical cap most browsers enforce on Set-Cookie Max-Age anyway

export function generateDeviceToken() {
  return randomBytes(32).toString('hex');
}

export function hashDeviceToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function trustedDeviceCookieOptions() {
  return {
    name: TRUSTED_DEVICE_COOKIE,
    httpOnly: true,
    sameSite: 'lax',
    // Only requires HTTPS in production - the gemach's own LAN dev/testing may be plain http.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS
  };
}

/**
 * Looks up the TrustedDevice row matching the raw token from the trusted_device cookie
 * (if any). Returns null if there's no cookie, no matching row, or the row was revoked -
 * callers should treat all of those identically ("this computer is not trusted").
 */
export async function getTrustedDeviceFromCookieStore(cookieStore) {
  const token = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return null;
  try {
    const tokenHash = hashDeviceToken(token);
    const device = await prisma.trustedDevice.findUnique({ where: { tokenHash } });
    if (!device || device.revokedAt) return null;
    return device;
  } catch (e) {
    console.error('Trusted device lookup error:', e);
    return null;
  }
}

export async function markDeviceUsed(deviceId) {
  try {
    await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { lastUsedAt: new Date() }
    });
  } catch (e) {
    // Best-effort only - never let this block a login.
    console.error('Failed to update trusted device lastUsedAt:', e);
  }
}
