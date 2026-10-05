// דיווח f1f46d04: /messages נחסם כשמערכת ההודעות הפנימית כבויה (hide_internal_messaging = 'true'), גם בכתובת ישירה.
// משתמש בתשתית של בדיקות הלו״ז (Prisma בזיכרון, בלי DB ובלי שרת): node --import ./scripts/schedule-tests/register.mjs --test scripts/schedule-tests/messages-gate.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const read = (rel) => readFileSync(process.env.PROJ + '/' + rel, 'utf8').replace(/\r\n/g, '\n');
const { isInternalMessagingOff } = await L('lib/messagingGate.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');

const install = (rows) => { globalThis.__MOCK_DB = { systemSetting: rows }; globalThis.__MOCK_CALLS = []; invalidateSettingsCache(); };
beforeEach(() => install([]));

test('isInternalMessagingOff: "true" = כבוי (גם " True "); "false" / חסר = פעיל (ההתנהגות הקיימת)', async () => {
  install([{ key: 'hide_internal_messaging', value: 'true' }]);
  assert.equal(await isInternalMessagingOff(), true);
  install([{ key: 'hide_internal_messaging', value: ' True ' }]);
  assert.equal(await isInternalMessagingOff(), true);
  install([{ key: 'hide_internal_messaging', value: 'false' }]);
  assert.equal(await isInternalMessagingOff(), false);
  install([]);
  assert.equal(await isInternalMessagingOff(), false);
});
test('isInternalMessagingOff: שגיאת DB = לא כבוי (נכשל פתוח; ההרשאה נבדקת אחרי זה)', async () => {
  globalThis.__MOCK_DB = {}; // אין טבלת systemSetting - הדמיה לשגיאה
  invalidateSettingsCache();
  assert.equal(await isInternalMessagingOff(), false);
});
test('app/messages/layout.js: הבדיקה לפני PageGate, מציג MessagingOff, וההרשאה page:messages נשארת', () => {
  const s = read('app/messages/layout.js');
  assert.match(s, /if \(await isInternalMessagingOff\(\)\) return <MessagingOff \/>;\s*return <PageGate pageKey="page:messages">\{children\}<\/PageGate>;/);
  assert.match(s, /import \{ isInternalMessagingOff \} from '@\/lib\/messagingGate';/);
  const m = read('app/messages/MessagingOff.js');
  assert.match(m, /מערכת ההודעות הפנימית כבויה/);
  assert.ok(!/'use client'/.test(m), 'רכיב שרת');
});
test('התפריטים שכבר מסתירים את ההודעות לא השתנו (הפעמון, "פתח מרכז הודעות", תפריט המשתמש)', () => {
  assert.match(read('lib/menu/buildMenuTree.js'), /'n-center': \{[^}]*gate: 'internalMessaging'/);
  assert.match(read('app/components/AppShell.js'), /authToken && !hideInternalMessaging && <NotificationBell/);
  assert.match(read('app/components/UserMenu.js'), /\{!hideInternalMessaging && \(/);
});
test('סקריפט ההרשאות: org 1 בלבד, dry-run כברירת מחדל (כותב רק עם --write), בדיקת host וזהות, ומסרב כששורת "פתוחים לכל עובד" אינה אחת בדיוק', () => {
  const s = read('scripts/seed_remove_messages_from_open_to_all_row.js');
  assert.match(s, /if \(org !== 1\) throw new Error\('SAFETY ABORT/);
  assert.match(s, /const write = rest\.includes\('--write'\);/);
  assert.match(s, /connectOrg\(org, write\)/);
  assert.match(s, /host\.startsWith\(ORG1_HOST_PREFIX\)/);
  assert.match(s, /candidates\.length !== 1/);
  assert.match(s, /if \(!write\) \{ console\.log\('dry-run - pass --write to apply'\); return; \}/);
  // כל הכתיבות מתחת לשורת ה-dry-run
  const idx = s.indexOf("if (!write) {");
  const writesBefore = s.slice(0, idx).match(/\.(update|delete|upsert|create)\(/g) || [];
  assert.equal(writesBefore.length, 0, 'אין כתיבה לפני בדיקת --write');
});
