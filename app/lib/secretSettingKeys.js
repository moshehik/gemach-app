// SystemSetting keys whose value is a real credential, not configuration - stored
// encrypted (lib/secretCrypto.js) and never sent to any client as plaintext.
// Shared between app/api/settings/route.js (masks on GET, encrypts on POST) and
// app/admin/settings/SettingsClient.js (renders as a password field) so the two
// never drift out of sync.
export const SECRET_SETTING_KEYS = ['nedarim_plus_token', 'neon_api_key', 'yemot_api_token'];
export const SECRET_MASK = '••••••••';

// Clearing a stored secret is an EXPLICIT action: an empty string for a secret key always
// means "not touched" (a focused-then-blurred password field must never wipe a credential),
// so the UI sends this distinct marker (settings-sim: "נקה ערך" + confirm dialog) to really
// erase it. Used by app/api/settings/route.js through secretWriteAction().
export const SECRET_CLEAR_MARKER = '__CLEAR_SECRET__';

/**
 * What POST /api/settings must do with one item: 'skip' (leave the stored value alone),
 * 'clear' (store an empty value) or 'write' (encrypt + store). Non-secret keys always 'write'.
 */
export function secretWriteAction(key, value) {
  if (!SECRET_SETTING_KEYS.includes(key)) return 'write';
  if (value === SECRET_CLEAR_MARKER) return 'clear';
  if (value === undefined || value === null || value === '' || value === SECRET_MASK) return 'skip';
  return 'write';
}

// Where each secret is issued/managed - shown as a link under its input on the
// settings page (SettingsClient.js).
export const SECRET_SETTING_LINKS = {
  nedarim_plus_token: {
    url: 'https://reports.matara.pro/',
    label: 'reports.matara.pro',
    prefix: 'הטוקן מונפק ונמצא בפורטל הניהול של נדרים פלוס:',
  },
  neon_api_key: {
    url: 'https://neon.com/faqs/find-or-generate-neon-api-keys',
    label: 'איך מוצאים/מנפיקים מפתח API בנאון',
    prefix: 'משמש את כרטיס "צריכת מסד הנתונים" למעלה. איך מנפיקים מפתח חדש:',
  },
  yemot_api_token: {
    url: 'https://www.ymot.co.il/',
    label: 'ymot.co.il - פורטל הניהול',
    prefix: 'טוקן ימות המשיח - נמצא בפורטל הניהול:',
  },
};
