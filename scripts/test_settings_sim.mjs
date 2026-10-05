// בדיקות לוגיקה טהורות למסכי ההגדרות בעיצוב "סימולציה" (lib/settingsSimLayout.js) — בלי DB, בלי רשת, בלי דפדפן.
// הרצה: node scripts/test_settings_sim.mjs   (קוד יציאה 1 אם משהו נכשל)
// מה נבדק: כיסוי (כל מפתח שמוצג היום נגיש במסך החדש, באותו מסך sys/site), מטען שמירה זהה לישן (SettingsClient.js),
// מתגים הפוכים, זוגות מסונכרנים, שדות חובה / קבוצות / מחלקות / אמצעי תשלום, ולידציה, שעה, חיפוש, קישור עמוק,
// והשוואה מילולית של העתקים (CUSTOMER_FIELDS, DEFAULT_LABELS) מול הקבצים הישנים.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { register } from 'node:module';

// '@/x' → שורש הריפו (כמו jsconfig paths), כדי לייבא את lib/settingsMetadata.js שמייבא '@/app/lib/...'
const ROOT = new URL('../', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    let url = ${JSON.stringify(ROOT)} + spec.slice(2);
    if (!/\\.(m?js|json)$/.test(url)) url += '.js';
    return next(url, ctx);
  }
  return next(spec, ctx);
}`));

const L = await import('../lib/settingsSimLayout.js');
const M = await import('../lib/settingsMetadata.js');
const V = await import('../app/lib/settingsValidation.js');
const { SECRET_SETTING_KEYS, SECRET_MASK } = await import('../app/lib/secretSettingKeys.js');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

/* ---------- כל המפתחות שהמטא-דאטה מכיר ---------- */
const metaSrc = read('../lib/settingsMetadata.js');
const metaKeys = new Set();
{
  const ob = metaSrc.slice(metaSrc.indexOf('export const SETTINGS_ORDER'), metaSrc.indexOf('export const SETTINGS_DEVELOPER_CATEGORIES'));
  for (const m of ob.matchAll(/'([A-Za-z_0-9]+)'/g)) metaKeys.add(m[1]);
  Object.keys(M.SETTINGS_HEBREW_NAMES).forEach((k) => metaKeys.add(k));
  M.SETTINGS_BOOLEAN_KEYS.forEach((k) => metaKeys.add(k));
  M.SETTINGS_NUMBER_KEYS.forEach((k) => metaKeys.add(k));
}
// הקטגוריה של כל מפתח לפי SETTINGS_ORDER (המקום שבו הישן מציג אותו)
const keyCategory = {};
for (const [cat, keys] of Object.entries(M.SETTINGS_ORDER)) for (const k of keys) keyCategory[k] = cat;

// שורות DB מדומות: כל מפתח מוכר בקטגוריה שלו (או 'כללי'), + קטגוריות שאינן במטא-דאטה
const fakeRows = [...metaKeys].map((key, i) => ({ id: i + 1, key, value: M.SETTINGS_BOOLEAN_KEYS.includes(key) ? 'false' : '', category: keyCategory[key] || 'כללי', name: key, type: null, notes: null }));
fakeRows.push(
  { key: 'backup_enabled', value: 'true', category: 'גיבויים', name: 'גיבוי אוטומטי לדרייב פעיל', type: 'boolean' },
  { key: 'backup_interval_hours', value: '24', category: 'גיבויים', name: 'תדירות גיבוי אוטומטי (שעות)', type: 'number' },
  { key: 'backup_drive_folder_id', value: 'x', category: 'גיבויים', name: 'שם תיקיית דרייב לגיבויים', type: 'text' },
  { key: 'backup_owner_email', value: 'a@b.c', category: 'גיבויים', name: 'כתובת מייל לצפייה בגיבויים', type: 'text' },
  { key: 'inventory_hold_minutes', value: '30', category: 'מלאי', name: 'inventory_hold_minutes', type: null },
  { key: 'standard_pickup_hours', value: '20:00-21:30', category: 'הדפסה', name: 'standard_pickup_hours', type: null },
  { key: 'neon_api_key', value: SECRET_MASK, category: 'מסד נתונים', name: 'neon_api_key', type: null },
  { key: 'ui_labels_mapping', value: '{"a":"b"}', category: 'ui_label', name: 'כיתובי מערכת (UI)', type: 'json' },
  { key: 'some_future_key', value: 'v', category: 'קטגוריה חדשה', name: 'some_future_key', type: null },
  { key: 'future_dev_key', value: 'v', category: 'מערכת', name: 'future_dev_key', type: null },
  { key: 'orphan_no_category', value: 'v', category: null, name: 'orphan', type: null },
);

// מה הישן מציג: כל שורה עם קטגוריה, חוץ מ-NEDARIM_MOSAD; מסך לפי filterCategoriesForMode
function legacyVisible(rows, mode) {
  return rows.filter((r) => r.category && r.key !== 'NEDARIM_MOSAD' && (mode === 'developer'
    ? M.SETTINGS_DEVELOPER_CATEGORIES.includes(r.category)
    : !M.SETTINGS_DEVELOPER_CATEGORIES.includes(r.category))).map((r) => r.key);
}
function newVisible(rows, view) {
  const model = L.buildViewModel(view, rows);
  return model.tabs.flatMap((tb) => tb.sections.flatMap((s) => s.rows.map((r) => r.key)));
}

console.log('coverage (parity of keys)');
t('כל שורה שהישן מציג ב-/admin/settings מוצגת במסך sys החדש', () => {
  const legacy = legacyVisible(fakeRows, 'general');
  const now = new Set(newVisible(fakeRows, 'sys'));
  const missing = legacy.filter((k) => !now.has(k));
  assert.deepEqual(missing, []);
});
t('כל שורה שהישן מציג ב-/admin/site-settings מוצגת במסך site החדש', () => {
  const legacy = legacyVisible(fakeRows, 'developer');
  const now = new Set(newVisible(fakeRows, 'site'));
  assert.deepEqual(legacy.filter((k) => !now.has(k)), []);
});
t('אין שורה שמופיעה פעמיים, ואין זליגה בין sys ל-site', () => {
  const sys = newVisible(fakeRows, 'sys');
  const site = newVisible(fakeRows, 'site');
  assert.equal(new Set(sys).size, sys.length, 'כפילות ב-sys');
  assert.equal(new Set(site).size, site.length, 'כפילות ב-site');
  assert.deepEqual(sys.filter((k) => site.includes(k)), []);
});
t('NEDARIM_MOSAD ושורה בלי קטגוריה לא מוצגות (כמו היום)', () => {
  const all = [...newVisible(fakeRows, 'sys'), ...newVisible(fakeRows, 'site')];
  assert.ok(!all.includes('NEDARIM_MOSAD'));
  assert.ok(!all.includes('orphan_no_category'));
});
t('קטגוריה לא מוכרת → לשונית "הגדרות נוספות"; קטגוריה מוכרת לא ממופה → סעיף "הגדרות נוספות" בלשונית שלה', () => {
  const sys = L.buildViewModel('sys', fakeRows);
  const more = sys.tabs.find((tb) => tb.id === 'more');
  assert.ok(more && more.sections[0].rows.some((r) => r.key === 'some_future_key') && more.sections[0].rows.some((r) => r.key === 'ui_labels_mapping'));
  const site = L.buildViewModel('site', fakeRows);
  const sysTab = site.tabs.find((tb) => tb.id === 'sys');
  assert.ok(sysTab.sections.some((s) => s.title === L.EXTRA_SECTION_TITLE && s.rows.some((r) => r.key === 'future_dev_key')));
  const inv = sys.tabs.find((tb) => tb.id === 'inv');
  assert.ok(inv.sections.some((s) => s.title === L.EXTRA_SECTION_TITLE && s.rows.some((r) => r.key === 'non_working_days_extra')), 'non_working_days_extra (יומן) נגיש');
  const disp = sys.tabs.find((tb) => tb.id === 'disp');
  assert.ok(disp.sections.some((s) => s.rows.some((r) => r.key === 'login_page_new')), 'login_page_new (תצוגה) נגיש');
});
t('כל מפתח ממופה קיים במטא-דאטה או ברשימת "ידועים בלי שם עברי"', () => {
  const known = new Set([...metaKeys, 'backup_enabled', 'backup_interval_hours', 'backup_drive_folder_id', 'backup_owner_email', 'inventory_hold_minutes', 'standard_pickup_hours', 'neon_api_key']);
  const mapped = L.SECTIONS.flatMap((s) => s.keys);
  assert.deepEqual(mapped.filter((k) => !known.has(k)), []);
  assert.equal(new Set(mapped).size, mapped.length, 'מפתח ממופה פעמיים');
});
t('כל מפתח במטא-דאטה ממופה במפורש, חוץ מהרשימה המתועדת (לא בעיצוב)', () => {
  const mapped = new Set(L.SECTIONS.flatMap((s) => s.keys));
  const notInDesign = [...metaKeys].filter((k) => !mapped.has(k)).sort();
  assert.deepEqual(notInDesign, ['NEDARIM_MOSAD', 'alteration_details_optional', 'customer_required_fields', 'full_refund_days', 'login_page_new', 'non_working_days_extra'].sort());
});
t('מפתחות המתכנת (מסד נתונים/מערכת/מיילים) ממופים רק למסך site, והשאר רק ל-sys', () => {
  for (const s of L.SECTIONS) for (const k of s.keys) {
    const cat = keyCategory[k];
    if (!cat) continue;
    assert.equal(s.view, M.SETTINGS_DEVELOPER_CATEGORIES.includes(cat) ? 'site' : 'sys', k);
  }
});
t('לשונית בלי שורות ובלי בלוק לא מוצגת; לוגו / הרשאות / מצב מסד / Neon תמיד מוצגים', () => {
  const sys = L.buildViewModel('sys', []);
  assert.deepEqual(sys.tabs.map((tb) => tb.id), ['brand', 'disp']);
  const site = L.buildViewModel('site', []);
  assert.deepEqual(site.tabs.map((tb) => tb.id), ['db']);
});
t('הסדר בתוך סעיף = הסדר בעיצוב (לא סדר ה-DB)', () => {
  const rows = [...fakeRows].reverse();
  const sys = L.buildViewModel('sys', rows);
  const org = sys.tabs.find((tb) => tb.id === 'cfg').sections.find((s) => s.id === 'org');
  assert.deepEqual(org.rows.map((r) => r.key), ['gmach_name', 'gmach_phone', 'main_email', 'gmach_address']);
});

console.log('controls (same field classification as legacy)');
t('פקד לכל סוג: מתג / מספר / שעה / סוד / חותמת זמן / select / שדות חובה / קבוצות / מחלקות / אמצעי תשלום / טקסט ארוך', () => {
  assert.equal(L.controlOf('require_login', null, 'true'), 'toggle');
  assert.equal(L.controlOf('max_items_per_order', null, '5'), 'number');
  assert.equal(L.controlOf('hok_auto_charge_hour', null, '19:00'), 'time');
  assert.equal(L.controlOf('nedarim_plus_token', null, SECRET_MASK), 'secret');
  assert.equal(L.controlOf('agent_fix_loop_last_activity', null, '2026-10-01T10:00:00Z'), 'timestamp');
  assert.equal(L.controlOf('PAYMENT_APPROVAL_LEVEL', null, ''), 'select-opts');
  assert.equal(L.controlOf('gap_size_price_rule', null, ''), 'select-seg');
  assert.equal(L.controlOf('order_new_redirect_screen', null, ''), 'select-pills');
  assert.equal(L.controlOf('email_routing_strategy', null, ''), 'select-opts');
  assert.equal(L.controlOf('mandatory_fields', null, ''), 'mandatory');
  assert.equal(L.controlOf('mandatory_field_groups', null, ''), 'groups');
  assert.equal(L.controlOf('cancel_order_permission', null, 'הנהלה ראשית'), 'dept');
  assert.equal(L.controlOf('ALLOWED_PAYMENT_METHODS', null, 'מזומן'), 'methods');
  assert.equal(L.controlOf('print_rental_box1', null, ''), 'textarea');
  assert.equal(L.controlOf('gmach_name', null, 'x'), 'text');
  // ערך 'true'/'false' הופך כל מפתח למתג (כמו isBoolean בישן)
  assert.equal(L.controlOf('some_future_key', null, 'true'), 'toggle');
});
t('הפקד תואם ל-classifySettingField של הישן לכל מפתח מוכר', () => {
  const map = { boolean: 'toggle', mandatoryFields: 'mandatory', fieldGroups: 'groups', department: 'dept', secret: 'secret', timestamp: 'timestamp', number: 'number' };
  for (const r of fakeRows) {
    const f = M.classifySettingField(r.key, r.type, r.value);
    const c = L.controlOf(r.key, r.type, r.value);
    if (map[f]) assert.equal(c, map[f], r.key);
    else if (f === 'select') assert.ok(c.startsWith('select-'), r.key);
    else assert.ok(['text', 'textarea', 'time', 'methods'].includes(c), `${r.key}: ${f} -> ${c}`);
  }
});

console.log('toggles (inverted hide_* keys)');
t('מתגים הפוכים מוצגים ונכתבים בדיוק כמו בישן', () => {
  // הישן: uiValue = isHide ? (raw==='true'?'false':'true') : raw ; handleToggle: isHide ? (uiValue==='true'?'true':'false') : (uiValue==='true'?'false':'true')
  const legacyShown = (k, raw) => (M.INVERTED_DISPLAY_KEYS.includes(k) ? (raw === 'true' ? 'false' : 'true') : raw) === 'true';
  const legacyNext = (k, raw) => {
    const isHide = M.INVERTED_DISPLAY_KEYS.includes(k);
    const ui = isHide ? (raw === 'true' ? 'false' : 'true') : raw;
    return isHide ? (ui === 'true' ? 'true' : 'false') : (ui === 'true' ? 'false' : 'true');
  };
  for (const k of ['hide_ai_features', 'hide_dress_images', 'hide_custom_spacing', 'require_login', 'hide_taken_orders_from_orders_list']) {
    for (const raw of ['true', 'false', '', undefined]) {
      assert.equal(L.toggleShownOn(k, raw), legacyShown(k, raw), `${k} shown ${raw}`);
      assert.equal(L.toggleNextRaw(k, raw), legacyNext(k, raw), `${k} next ${raw}`);
    }
  }
});
t('"תאריכים עבריים בלבד" = hide_gregorian_calendar בקוטביות ישירה (פעיל = הלועזי מוסתר), וכותב את אותו ערך גולמי', () => {
  assert.equal(L.toggleShownOn('hide_gregorian_calendar', 'true'), true);
  assert.equal(L.toggleShownOn('hide_gregorian_calendar', 'false'), false);
  assert.equal(L.toggleNextRaw('hide_gregorian_calendar', 'true'), 'false');
  assert.equal(L.toggleNextRaw('hide_gregorian_calendar', 'false'), 'true');
});

console.log('save payload (identical to legacy)');
t('מטען = Object.entries(modified).map(({key,value})) כמו הישן', () => {
  let m = {};
  m = L.applyChange(m, 'require_login', 'true');
  m = L.applyChange(m, 'gmach_name', 'גמ"ח חדש');
  assert.deepEqual(L.buildPayload(m), [{ key: 'require_login', value: 'true' }, { key: 'gmach_name', value: 'גמ"ח חדש' }]);
});
t('זוגות מסונכרנים נשמרים יחד (BUFFER_DAYS↔inventory_buffer_days, NEDARIM_MOSAD↔nedarim_plus_terminal)', () => {
  assert.deepEqual(L.applyChange({}, 'BUFFER_DAYS', '4'), { BUFFER_DAYS: '4', inventory_buffer_days: '4' });
  assert.deepEqual(L.applyChange({}, 'inventory_buffer_days', '2'), { inventory_buffer_days: '2', BUFFER_DAYS: '2' });
  assert.deepEqual(L.applyChange({}, 'nedarim_plus_terminal', '77'), { nedarim_plus_terminal: '77', NEDARIM_MOSAD: '77' });
  assert.deepEqual(L.revertChange({ BUFFER_DAYS: '4', inventory_buffer_days: '4', x: '1' }, 'inventory_buffer_days'), { x: '1' });
});
t('חזרה ידנית לערך המקורי מוחקת את השינוי (גם בזוג)', () => {
  const orig = { BUFFER_DAYS: '3', inventory_buffer_days: '3', gmach_name: 'א' };
  assert.deepEqual(L.pruneUnchanged({ gmach_name: 'א' }, orig), {});
  assert.deepEqual(L.pruneUnchanged({ BUFFER_DAYS: '3', inventory_buffer_days: '3' }, orig), {});
  assert.deepEqual(L.pruneUnchanged({ gmach_name: 'ב' }, orig), { gmach_name: 'ב' });
});
t('סוד שלא נגעו בו לא נכנס למטען (השרת גם מסנן את SECRET_MASK)', () => {
  assert.deepEqual(L.buildPayload({}), []);
  assert.ok(SECRET_SETTING_KEYS.includes('nedarim_plus_token'));
});
t('ולידציה = אותן פונקציות של הישן ושל השרת', () => {
  assert.equal(L.validationError('max_items_per_order', '0'), V.validateNumericSetting('max_items_per_order', '0'));
  assert.ok(L.validationError('max_items_per_order', '0'));
  assert.equal(L.validationError('max_items_per_order', '5'), null);
  assert.ok(L.validationError('gap_size_price_rule', 'zzz'));
  assert.equal(L.validationError('swap_min_days_before_event', ''), null, 'ריק מותר בהגדרות מדיניות');
  assert.deepEqual(L.firstValidationError({ gmach_name: 'x', REFUND_PERCENTAGE: '150' }).key, 'REFUND_PERCENTAGE');
});
t('הקלדת מספר: ספרות בלבד (נקודה רק בעשרוני), +/- בגבולות', () => {
  assert.equal(L.cleanNumberInput('max_items_per_order', '1a2.5'), '125');
  assert.equal(L.cleanNumberInput('REFUND_PERCENTAGE', '12.5%'), '12.5');
  assert.equal(L.stepNumber('max_items_per_order', '100', 1), '100');
  assert.equal(L.stepNumber('max_items_per_order', '1', -1), '1');
  assert.equal(L.stepNumber('REFUND_PERCENTAGE', '50', 1), '50.1');
  assert.equal(L.stepNumber('delivery_days_before', '', 1), '1');
  assert.match(L.numberPlaceholder('swap_min_days_before_event'), /ריק = בלי הגבלה/);
});

console.log('mandatory fields / groups / departments / payment methods');
const legacyClient = read('../app/admin/settings/SettingsClient.js');
t('CUSTOMER_FIELDS ו-ENFORCEABLE_FIELD_KEYS זהים לישן', () => {
  for (const f of L.CUSTOMER_FIELDS) assert.ok(legacyClient.includes(`{ key: '${f.key}', name: '${f.name}', alias: '${f.alias}' }`), f.key);
  assert.ok(legacyClient.includes(`const ENFORCEABLE_FIELD_KEYS = [${L.ENFORCEABLE_FIELD_KEYS.map((k) => `'${k}'`).join(', ')}];`));
});
t('שדות חובה: בחירה מוסיפה alias, ביטול מסיר כל צורה (key/שם/alias), ערכים לא מוכרים נשמרים', () => {
  const phone = L.ENFORCEABLE_FIELDS.find((f) => f.key === 'phone1');
  assert.equal(L.mandatoryToggle('', phone), 'טלפון_1');
  assert.equal(L.mandatoryToggle('שם_פרטי, phone1, משהו', phone), 'שם_פרטי, משהו');
  assert.equal(L.mandatoryToggle('PHONE1', phone), '');
  assert.equal(L.mandatoryIsSelected('טלפון ראשי (נייד)', phone), true);
  assert.deepEqual(L.mandatoryUnknown('שם_פרטי, משהו'), ['משהו']);
});
t('קבוצות: JSON כמו FieldGroupsEditor, קבוצות ריקות נמחקות, ערך שבור = אין קבוצות', () => {
  assert.deepEqual(L.parseGroups('[["phone2","email"]]'), [['phone2', 'email']]);
  assert.deepEqual(L.parseGroups('xx'), []);
  assert.deepEqual(L.parseGroups('{"a":1}'), []);
  assert.equal(L.serializeGroups([['phone2', 'email'], []]), '[["phone2","email"]]');
});
t('מחלקות: אותו toggleDept (join ", ")', () => {
  assert.equal(L.deptToggle('', 'מנהל סניף'), 'מנהל סניף');
  assert.equal(L.deptToggle('הנהלה ראשית, מנהל סניף', 'הנהלה ראשית'), 'מנהל סניף');
});
t('אמצעי תשלום: לחצני הערכים השמורים + ברירות המחדל של הקוד, שמירת סדר, הוספת ערך חופשי', () => {
  const choices = L.methodChoices('מזומן,העברה', 'מזומן,העברה');
  assert.deepEqual(choices, ['מזומן', 'העברה', 'אשראי (דרך נדרים פלוס)', 'יציאה באישור מנהל']);
  assert.equal(L.methodsToggle(choices, 'מזומן,העברה', 'העברה'), 'מזומן');
  assert.equal(L.methodsToggle(choices, 'מזומן', 'אשראי (דרך נדרים פלוס)'), 'מזומן,אשראי (דרך נדרים פלוס)');
  assert.equal(L.methodsAdd(choices, 'מזומן', 'צ׳ק'), 'מזומן,צ׳ק');
  assert.equal(L.methodsAdd(choices, 'מזומן', 'a,b'), 'מזומן,a b', 'פסיק בתוך שם לא שובר את הרשימה');
  // הקורא (app/orders/new) מפצל לפי ',' ומנקה רווחים
  assert.deepEqual('מזומן,אשראי (דרך נדרים פלוס)'.split(',').map((s) => s.trim()), ['מזומן', 'אשראי (דרך נדרים פלוס)']);
});

console.log('time / text helpers');
t('שעה: השלמה כמו בעיצוב, ערך לא תקין לא נכתב', () => {
  assert.equal(L.commitTime('9'), '09:00');
  assert.equal(L.commitTime('930'), '09:30');
  assert.equal(L.commitTime('1745'), '17:45');
  assert.equal(L.commitTime('7:05'), '07:05');
  assert.equal(L.commitTime('2560'), null);
  assert.equal(L.commitTime('abc'), null);
});
t('שורת משנה = המשפט הראשון, נחתך לפני סוגריים / " - " (כמו בעיצוב)', () => {
  assert.equal(L.subline('הפעלת סניפים (בוצעה בנוה יעקב / איסוף בבית שמש).'), 'הפעלת סניפים');
  assert.equal(L.subline('ביציאת כובסת - מקפיץ משפחות שלא החזירו.'), 'ביציאת כובסת');
  assert.equal(L.subline('המתג הראשי של החלפת מידה. כשהוא דולק, ...'), 'המתג הראשי של החלפת מידה.');
  assert.equal(L.subline('כשמופעל (ברירת המחדל), כל עוד'), 'כשמופעל');
  assert.equal(L.subline(''), '');
});
t('שמות ותוויות: שם אמיתי מהמטא-דאטה, ותווית העיצוב רק למקבילים באותה משמעות', () => {
  const row = (key, extra = {}) => L.makeRow({ key, value: '', category: 'כללי', name: key, ...extra });
  assert.equal(row('gmach_address').label, M.SETTINGS_HEBREW_NAMES.gmach_address);
  assert.equal(row('gmach_name').label, 'שם הגמ״ח');
  assert.equal(row('BUFFER_DAYS').label, M.SETTINGS_HEBREW_NAMES.BUFFER_DAYS, 'מקביל חלקי (M005) — שם אמיתי');
  assert.equal(row('enable_rental_extension').label, M.SETTINGS_HEBREW_NAMES.enable_rental_extension);
  assert.equal(row('inventory_hold_minutes').label, 'החזקת פריט בהזמנה (דקות)');
  assert.equal(row('backup_enabled', { name: 'גיבוי אוטומטי לדרייב פעיל' }).label, 'גיבוי אוטומטי לדרייב פעיל');
  assert.equal(row('nedarim_plus_token').sub, 'הערך נשמר מוצפן ולא מוצג שוב לאחר השמירה.');
});
t('ערך מוצג בפאנל השינויים', () => {
  const r = L.makeRow({ key: 'PAYMENT_APPROVAL_LEVEL', value: '', category: 'תשלומים' });
  assert.equal(L.shownValue(r, ''), 'כולם (ללא הגבלה - ברירת מחדל)');
  assert.equal(L.shownValue(L.makeRow({ key: 'hide_ai_features', value: 'true', category: 'בינה מלאכותית' }), 'true'), 'כבוי');
  assert.equal(L.shownValue(L.makeRow({ key: 'gmach_name', value: '', category: 'כללי' }), ''), 'ריק');
  assert.equal(L.cutTxt('א'.repeat(30)).length, 26);
});

console.log('search / deep link');
t('חיפוש לפי שם, הערה, מפתח וכותרת סעיף (בלי גרשיים)', () => {
  const r = L.makeRow({ key: 'gmach_address', value: '', category: 'כללי' });
  assert.ok(L.rowMatches(r, 'פרטי הגמ״ח', 'כתובת'));
  assert.ok(L.rowMatches(r, 'פרטי הגמ״ח', 'gmach_address'));
  assert.ok(L.rowMatches(r, 'פרטי הגמ״ח', 'גמח'));
  assert.ok(!L.rowMatches(r, 'פרטי הגמ״ח', 'משלוח'));
  assert.ok(L.rowMatches(r, '', ''));
});
t('קישור עמוק ?tab=<קטגוריה>&highlight=<key> (SettingQuickPanel / AI) נפתח בלשונית הנכונה', () => {
  const sys = L.buildViewModel('sys', fakeRows);
  assert.equal(L.tabForDeepLink(sys, 'כללי', 'item_locations'), 'cfg');
  assert.equal(L.tabForDeepLink(sys, 'אוטומציה', 'late_return_email_text'), 'msg');
  assert.equal(L.tabForDeepLink(sys, 'יומן', null), 'inv');
  assert.equal(L.tabForDeepLink(sys, 'nonsense', null), null);
});

console.log('copies of legacy constants');
t('DEFAULT_LABELS וקבוצות הכיתובים זהים לדף הכיתובים הישן', () => {
  const legacy = read('../app/admin/labels/LegacyLabelsPage.js');
  for (const [k, v] of Object.entries(L.DEFAULT_LABELS)) assert.ok(legacy.includes(`${k}: '${v}'`), k);
  const block = legacy.slice(legacy.indexOf('const DEFAULT_LABELS'), legacy.indexOf('export default function'));
  const m = block.match(/^\s+[a-zA-Z_0-9]+: '/gm) || [];
  assert.equal(m.length, Object.keys(L.DEFAULT_LABELS).length, 'מספר כיתובי ברירת המחדל');
  for (const tab of L.NAMES_TABS) assert.ok(legacy.includes(`keys: [${tab.keys.map((k) => `'${k}'`).join(', ')}]`), tab.id);
});

console.log('architecture / guards');
t('שלושת הנתיבים בוחרים ישן / חדש לפי מסך settings, והישן נשמר כמו שהוא', () => {
  for (const [p, view, legacy] of [['../app/admin/settings/page.js', 'sys', 'LegacySettingsPage'], ['../app/admin/site-settings/page.js', 'site', 'LegacySiteSettingsPage'], ['../app/admin/labels/page.js', 'names', 'LegacyLabelsPage']]) {
    const src = read(p);
    assert.match(src, /getRequestUiVariant\('settings'\)/, p);
    assert.match(src, new RegExp(`<SettingsSimSwitch view="${view}" />`), p);
    assert.match(src, new RegExp(`<${legacy} />`), p);
  }
  assert.ok(existsSync(new URL('../app/admin/settings/SettingsClient.js', import.meta.url)));
});
t('הרכיב החדש: שורש gm-ds gm-st home-bg dlg-dark, בלי gm-home, בלי alert/confirm/title=, בלי "טוגל"', () => {
  const dir = '../app/components/settings-sim/';
  const files = ['SettingsSimPage.js', 'SettingRow.js', 'SettingsDialogs.js', 'SettingsSimSwitch.js'];
  const all = files.map((f) => read(dir + f)).join('\n');
  assert.match(all, /className="gm-ds gm-st home-bg dlg-dark"/);
  assert.ok(!/gm-home/.test(all), 'gm-home');
  assert.ok(!/window\.(alert|confirm|prompt)\(|\balert\(|\bconfirm\(/.test(all), 'alert/confirm');
  assert.ok(!/\stitle=/.test(all), 'title= (טולטיפים רק דרך data-tip)');
  assert.ok(!/טוגל/.test(all + read(dir + 'settings-sim.css')), 'טוגל');
  assert.ok(!/toLocale(Date)?String\(['"]he-IL['"]/.test(all), 'תאריך לועזי');
});
t('settings-sim.css: כל כלל בהיקף .gm-ds.gm-st (או .tpop של בוחר השעה בתוך השורש)', () => {
  const css = read('../app/components/settings-sim/settings-sim.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = [];
  const re = /([^{}@]+)\{[^{}]*\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    if (!sel || /^(from|to|\d+%)/.test(sel)) continue;
    for (const s of sel.split(/,(?![^(]*\))/)) if (!/\.gm-ds\.gm-st|\.app-shell \.main \.content:has\(> \.gm-ds\.gm-st\)/.test(s)) bad.push(s.trim());
  }
  assert.deepEqual(bad, []);
});

console.log('review fixes (2026-10-04)');
const SK = await import('../app/lib/secretSettingKeys.js');
t('#1 סוד ריק = ללא שינוי: לא נשמר ב-pruneUnchanged ולא במטען; מחיקה רק עם הסימן המפורש', () => {
  const orig = { nedarim_plus_token: SECRET_MASK, gmach_name: 'א' };
  assert.deepEqual(L.pruneUnchanged({ nedarim_plus_token: '' }, orig), {});
  assert.deepEqual(L.pruneUnchanged({ nedarim_plus_token: SK.SECRET_CLEAR_MARKER }, orig), { nedarim_plus_token: SK.SECRET_CLEAR_MARKER });
  assert.deepEqual(L.buildPayload({ yemot_api_token: '', neon_api_key: SECRET_MASK, gmach_name: '' }), [{ key: 'gmach_name', value: '' }], 'שדה רגיל ריק כן נשלח');
  assert.equal(L.shownValue({ secret: true, ctl: 'secret' }, SK.SECRET_CLEAR_MARKER), 'יימחק');
});
t('#1 שרת: secretWriteAction - ריק/מסכה/undefined מדולגים, סימן מחיקה מנקה, ערך אמיתי נכתב; מפתח רגיל תמיד נכתב', () => {
  for (const k of SECRET_SETTING_KEYS) {
    assert.equal(SK.secretWriteAction(k, ''), 'skip');
    assert.equal(SK.secretWriteAction(k, SECRET_MASK), 'skip');
    assert.equal(SK.secretWriteAction(k, undefined), 'skip');
    assert.equal(SK.secretWriteAction(k, SK.SECRET_CLEAR_MARKER), 'clear');
    assert.equal(SK.secretWriteAction(k, 'abc'), 'write');
  }
  assert.equal(SK.secretWriteAction('gmach_name', ''), 'write');
  const route = read('../app/api/settings/route.js');
  assert.ok(/secretWriteAction\(item\.key, item\.value\) !== 'skip'/.test(route), 'הנתיב משתמש ב-secretWriteAction לסינון');
  assert.ok(/action === 'clear' \? ''/.test(route), 'סימן המחיקה נשמר כריק');
});

t('#2 CSS: .st-row[hidden] מנצח את display:flex של הפלטה', () => {
  const css = read('../app/components/settings-sim/settings-sim.css');
  assert.ok(/\.gm-ds\.gm-st \.st-row\[hidden\]\{display:none!important\}/.test(css.replace(/\s+/g, ' ').replace(/ ?([{};]) ?/g, '$1')));
});
t('#3 web_backup_mode (דגל המעבר החי) מוסתר: לא מוצב באף מסך', () => {
  assert.ok(L.HIDDEN_KEYS.includes('web_backup_mode'));
  assert.equal(L.placeRow({ key: 'web_backup_mode', category: 'מסד נתונים' }), null);
  const vm = L.buildViewModel('site', [{ id: 1, key: 'web_backup_mode', value: 'false', category: 'מסד נתונים', type: 'boolean' }]);
  assert.ok(!JSON.stringify(vm).includes('web_backup_mode'));
});

t('#4 db-mode: POST מוגבל למתכנת בלבד (DEVELOPER_ONLY_ROLES), לא הנהלה ראשית', () => {
  const route = read('../app/api/admin/db-mode/route.js');
  const post = route.slice(route.indexOf('export async function POST'));
  assert.ok(/checkAuth\('מתכנת'\)/.test(post) && !/הנהלה ראשית/.test(post.replace(/\/\/.*$/gm, '')));
  const auth = read('../lib/auth.js');
  const roles = read('../lib/roles.js'); // DEVELOPER_ONLY_ROLES עבר ל-lib/roles.js (lib/auth.js מייצא אותו מחדש)
  assert.ok(/'מתכנת':\s*\[2\]/.test(auth) && /DEVELOPER_ONLY_ROLES\s*=\s*\[2\]/.test(roles), "ROLE_LEVELS['מתכנת'] = DEVELOPER_ONLY_ROLES");
  assert.ok(!/checkAuth/.test(route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'))), 'GET ציבורי: רק mode');
});

t('#7 סטפר "-" על שדה ריק נשאר ריק בשדות שבהם ריק משמעותי (ולא הופך ל-0)', () => {
  for (const k of ['instant_undo_minutes', 'swap_min_days_before_event', 'swap_pairing_window_minutes', 'size_edit_until_days_before_event']) {
    assert.equal(L.stepNumber(k, '', -1), '', k);
    assert.equal(L.stepNumber(k, '', 1), '1', k + ' +');
    assert.equal(L.stepNumber(k, '0', -1), '0', k + ' 0 נשאר 0');
  }
  assert.equal(L.stepNumber('delivery_days_before', '', -1), '0', 'שדה רגיל: ריק נחשב 0');
});

t('#8 אמצעי תשלום: אי אפשר לכבות את האחרון (נשאר לפחות אחד)', () => {
  const choices = ['מזומן', 'העברה'];
  assert.equal(L.methodsToggle(choices, 'מזומן', 'מזומן'), 'מזומן', 'האחרון לא נכבה');
  assert.equal(L.methodsWouldEmpty('מזומן', 'מזומן'), true);
  assert.equal(L.methodsWouldEmpty('מזומן,העברה', 'מזומן'), false);
  assert.equal(L.methodsToggle(choices, '', 'מזומן'), 'מזומן', 'מרשימה ריקה אפשר להדליק');
});

t('#9 gmach_subtitle (נקרא ב-layout / buildMenuTree / loginFlow) מוצג בלשונית המיתוג ולא ב"לא בשימוש"', () => {
  assert.deepEqual(L.placeRow({ key: 'gmach_subtitle', category: 'לא בשימוש' }), { view: 'sys', tab: 'brand', sectionId: 'identity' });
  const dead = L.SECTIONS.find((s) => s.id === 'dead');
  assert.ok(!dead.keys.includes('gmach_subtitle'));
  const usedBy = ['../app/layout.js', '../lib/menu/buildMenuTree.js', '../lib/loginFlow.js'].filter((f) => existsSync(new URL(f, import.meta.url)) && /gmach_subtitle/.test(read(f)));
  assert.ok(usedBy.length >= 1, 'עדיין נקרא בקוד: ' + usedBy.join(','));
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
