// גיבוי + שחזור של scripts/clean_placeholder_model_names.js מול לקוח pg מדומה (בלי DB): --apply בלי --backup-file נדחה, הגיבוי נכתב לפני ה-UPDATE הראשון
// (קובץ חדש בלבד), מכיל את הרשימה המלאה id / לפני / אחרי, והסקריפט הנלווה clean_placeholder_model_names_rollback.js מחזיר רק שורות שעדיין בערך "אחרי".
// הרצה: node scripts/test_model_name_cleanup_backup.mjs   (בלי DB, בלי רשת)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const clean = require('./clean_placeholder_model_names.js');
const lib = await import(pathToFileURL(path.join(ROOT, 'lib', 'modelNameCleanup.js')).href);

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', String(e.message).slice(0, 500)); process.exitCode = 1; } };

// DB מדומה: שלושה דגמים (שניים עם "ללא שם - N") ופריט אחד עם dressName ישן
const db = {
  settings: [{ key: 'gmach_name', value: 'נווה יעקב' }, { key: 'useModelNames', value: 'false' }],
  models: [
    { id: 'm1', name: 'ללא שם - 1243', barcodePrefix: 522, isDeleted: false },
    { id: 'm2', name: 'ללא שם - 77', barcodePrefix: 530, isDeleted: false },
    { id: 'm3', name: '600', barcodePrefix: 600, isDeleted: false },
  ],
  items: [{ id: 'i1', dressName: 'ללא שם - 1243', barcodePrefix: 522 }],
  updates: [],
};
function fakeClient() {
  return {
    async query(sql, params = []) {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/FROM "SystemSetting"/.test(sql)) return { rows: db.settings };
      if (/FROM "DressModel"/.test(sql) && /^\s*SELECT/i.test(sql)) return { rows: db.models.map((m) => ({ ...m })) };
      if (/FROM "DressItem" i/.test(sql)) return { rows: db.items.map((i) => ({ ...i })) };
      if (/^\s*UPDATE "DressModel"/.test(sql)) { const m = db.models.find((x) => x.id === params[1] && x.name === params[2]); if (m) { db.updates.push(['model', m.id, m.name, params[0]]); m.name = params[0]; } return { rowCount: m ? 1 : 0, rows: [] }; }
      if (/^\s*UPDATE "DressItem"/.test(sql)) { const i = db.items.find((x) => x.id === params[1] && x.dressName === params[2]); if (i) { db.updates.push(['item', i.id, i.dressName, params[0]]); i.dressName = params[0]; } return { rowCount: i ? 1 : 0, rows: [] }; }
      throw new Error('unexpected SQL in the fake client: ' + sql.slice(0, 80));
    },
  };
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpn-'));
const backupFile = path.join(tmp, 'backup.json');

await t('--apply בלי --backup-file נדחה בפרסור הארגומנטים; dry-run לא דורש', () => {
  assert.throws(() => clean.parseArgs(['--confirm-host', 'ep-x', '--org=2', '--apply']), /--backup-file/);
  assert.doesNotThrow(() => clean.parseArgs(['--confirm-host', 'ep-x', '--org=2']));
  assert.doesNotThrow(() => clean.parseArgs(['--confirm-host', 'ep-x', '--org=2', '--apply', `--backup-file=${backupFile}`]));
});

await t('dry-run: לא נכתב גיבוי ולא בוצע UPDATE', async () => {
  const log = [];
  const r = await clean.run(fakeClient(), { apply: false }, lib, (m) => log.push(m));
  assert.ok(r.total >= 3, `planned ${r.total}`);
  assert.equal(db.updates.length, 0);
  assert.equal(fs.existsSync(backupFile), false);
});

await t('--apply: הגיבוי נכתב (id / לפני / אחרי) לפני העדכונים, והעדכונים בוצעו', async () => {
  const origLog = console.log; console.log = () => {};
  let r;
  try { r = await clean.run(fakeClient(), { apply: true, 'backup-file': backupFile }, lib, () => {}); } finally { console.log = origLog; }
  assert.equal(r.applied, r.total);
  const b = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  assert.equal(b.version, 1);
  assert.deepEqual(b.models.map((m) => [m.id, m.from, m.to]), [['m1', 'ללא שם - 1243', '522'], ['m2', 'ללא שם - 77', '530']]);
  assert.deepEqual(b.items.map((i) => [i.id, i.from, i.to]), [['i1', 'ללא שם - 1243', '522']]);
  assert.deepEqual(db.models.map((m) => m.name), ['522', '530', '600']);
});

await t('הגיבוי לא דורס קובץ קיים (wx): הרצה נוספת עם אותו קובץ נכשלת לפני כל כתיבה', async () => {
  db.models[0].name = 'ללא שם - 1243'; // כאילו הנתונים חזרו, כדי שתהיה תוכנית
  db.updates.length = 0;
  const origLog = console.log; console.log = () => {};
  try { await assert.rejects(() => clean.run(fakeClient(), { apply: true, 'backup-file': backupFile }, lib, () => {}), /EEXIST/); } finally { console.log = origLog; }
  assert.equal(db.updates.length, 0);
});

await t('סקריפט השחזור: CAS לפי "אחרי" (IS NOT DISTINCT FROM), dry-run כברירת מחדל, בלי DDL/מחיקה, אותה בדיקת host', () => {
  const src = fs.readFileSync(path.join(here, 'clean_placeholder_model_names_rollback.js'), 'utf8');
  assert.match(src, /IS NOT DISTINCT FROM \$3/);
  assert.match(src, /if \(opts\.apply\) await client\.query\('COMMIT'\); else await client\.query\('ROLLBACK'\)/);
  assert.match(src, /checkHost\(/);
  assert.match(src, /--confirm-host <full DB host or ep-xxxx endpoint id> is required/);
  assert.doesNotMatch(src, /\b(DROP|ALTER|CREATE|TRUNCATE|DELETE)\b\s+(TABLE|COLUMN|INDEX|FROM)/i);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
