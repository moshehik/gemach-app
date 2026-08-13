// SystemSetting keys whose value is a real credential, not configuration - stored
// encrypted (lib/secretCrypto.js) and never sent to any client as plaintext.
// Shared between app/api/settings/route.js (masks on GET, encrypts on POST) and
// app/admin/settings/SettingsClient.js (renders as a password field) so the two
// never drift out of sync.
export const SECRET_SETTING_KEYS = ['nedarim_plus_token', 'neon_api_key'];
export const SECRET_MASK = '••••••••';

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
};
