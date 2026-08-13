import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM at-rest encryption for secret SystemSetting values (e.g. the Nedarim
// Plus API token) that would otherwise sit as plaintext in the DB - unlike the rest
// of SystemSetting, these are never meant to round-trip back to any client, public
// or admin (see app/api/settings/route.js, which masks rather than decrypts them
// in GET). Key: SETTINGS_ENCRYPTION_KEY env var, 32 bytes as hex (64 chars) -
// generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
// Losing/rotating this key makes every previously-encrypted value undecryptable -
// there is no re-encryption path, so treat it like a DB credential, not a toggle.
const ENC_PREFIX = 'enc:v1:';

function getKey() {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is not configured (expected 64 hex chars / 32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypts plaintext into a self-contained "enc:v1:<iv>:<authTag>:<ciphertext>" string (all base64). */
export function encryptSecret(plainText) {
  const key = getKey();
  const iv = randomBytes(12); // GCM standard IV length
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + [iv, authTag, ciphertext].map(b => b.toString('base64')).join(':');
}

/** True if a stored SystemSetting value was produced by encryptSecret(). */
export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/** Reverses encryptSecret(). Throws if the value isn't a well-formed encrypted secret. */
export function decryptSecret(storedValue) {
  if (!isEncryptedSecret(storedValue)) {
    throw new Error('Value is not an encrypted secret');
  }
  const [ivB64, authTagB64, ciphertextB64] = storedValue.slice(ENC_PREFIX.length).split(':');
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plain.toString('utf8');
}
