// בדיקת יחידה ללוגיקה הטהורה של ריבוי הסניפים: lib/branches.js (הגדרות, ולידציה, יכולות) ו-lib/ lib/branchNeeds.js (שלב ג) (חישוב צרכים).
// לא נוגעת ב-DB. הרצה: node scripts/test_branches.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  activeBranches, branchConfigFromSettings, branchesWith, branchListString, effectiveUnitBranch, findBranchByName, isMultiBranchEnabled, mainBranch,
  orderTargetBranch, parseBranchesConfig, parseBranchList, pickDefaultBranch, renamedBranches, resolveBranchNoticeSettings, sanitizeBranchesInput, settingsFromBranches,
} from '../lib/branches.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const B = (id, name, o = {}) => ({ id, name, isMain: false, measure: true, pickup: true, return: true, active: true, ...o });

console.log('הפעלה והגדרות');
t('חסר / false / שגוי = כבוי (כמו היום)', () => {
  assert.equal(isMultiBranchEnabled({}), false);
  assert.equal(isMultiBranchEnabled(null), false);
  assert.equal(isMultiBranchEnabled({ multi_branch_enabled: 'false' }), false);
  assert.equal(isMultiBranchEnabled({ multi_branch_enabled: 'yes' }), false);
  assert.equal(isMultiBranchEnabled({ multi_branch_enabled: 'true' }), true);
});
t('התראות: כבוי כשהריבוי כבוי, גם אם הדגלים דולקים', () => {
  const r = resolveBranchNoticeSettings({ branch_transfer_banner_enabled: 'true', branch_return_alert_enabled: 'true' });
  assert.equal(r.bannerEnabled, false); assert.equal(r.returnAlert, false); assert.equal(r.enabled, false);
});
t('התראות: ברירות מחדל כשהריבוי דלוק', () => {
  const r = resolveBranchNoticeSettings({ multi_branch_enabled: 'true' });
  assert.deepEqual([r.bannerEnabled, r.bannerDays, r.bannerScope, r.horizonDays, r.returnAlert], [false, 3, 'both', 14, true]);
});
t('התראות: ערכים חריגים נחתכים', () => {
  const r = resolveBranchNoticeSettings({ multi_branch_enabled: 'true', branch_transfer_banner_enabled: 'true', branch_transfer_banner_days: '999', branch_transfer_banner_scope: 'zzz', branch_transfer_horizon_days: '0', branch_return_alert_enabled: 'false' });
  assert.deepEqual([r.bannerEnabled, r.bannerDays, r.bannerScope, r.horizonDays, r.returnAlert], [true, 60, 'both', 1, false]);
});

console.log('פענוח הגדרת הסניפים');
t('parseBranchList', () => assert.deepEqual(parseBranchList(' א ,ב, ,ג'), ['א', 'ב', 'ג']));
t('בלי קונפיגורציה: נגזר מ-branch_list, הראשון ראשי, כולם פעילים עם כל היכולות', () => {
  const c = branchConfigFromSettings({ branch_list: 'נווה יעקב, בית שמש' });
  assert.equal(c.derived, true);
  assert.deepEqual(c.branches.map((b) => [b.name, b.isMain, b.measure, b.pickup, b.return, b.active]), [['נווה יעקב', true, true, true, true, true], ['בית שמש', false, true, true, true, true]]);
});
t('בלי כלום: אין סניפים', () => { const c = branchConfigFromSettings({}); assert.equal(c.branches.length, 0); assert.equal(mainBranch(c), null); });
t('JSON תקין נקרא; JSON שבור נופל לרשימה הישנה', () => {
  const cfg = JSON.stringify({ v: 1, branches: [B('x', 'א', { isMain: true, return: false }), B('y', 'ב', { active: false })] });
  const c = parseBranchesConfig(cfg, 'ישן');
  assert.equal(c.derived, false); assert.equal(c.branches.length, 2); assert.equal(c.branches[0].return, false);
  assert.equal(parseBranchesConfig('{broken', 'ישן, חדש').branches.length, 2);
});
t('יכולות: branchesWith מחזיר פעילים בלבד', () => {
  const c = { branches: [B('1', 'א', { isMain: true }), B('2', 'ב', { pickup: false }), B('3', 'ג', { active: false })] };
  assert.deepEqual(branchesWith(c, 'pickup').map((b) => b.name), ['א']);
  assert.deepEqual(branchesWith(c, 'return').map((b) => b.name), ['א', 'ב']);
  assert.deepEqual(activeBranches(c).map((b) => b.name), ['א', 'ב']);
});
t('ראשי: המסומן, ואם הוא מושבת - הפעיל הראשון', () => {
  assert.equal(mainBranch({ branches: [B('1', 'א'), B('2', 'ב', { isMain: true })] }).name, 'ב');
  assert.equal(mainBranch({ branches: [B('1', 'א'), B('2', 'ב', { isMain: true, active: false })] }).name, 'א');
});
t('effectiveUnitBranch: ריק = הראשי', () => {
  const c = { branches: [B('1', 'א'), B('2', 'ב', { isMain: true })] };
  assert.equal(effectiveUnitBranch('', c), 'ב'); assert.equal(effectiveUnitBranch(null, c), 'ב'); assert.equal(effectiveUnitBranch('א', c), 'א');
  assert.equal(effectiveUnitBranch('', { branches: [] }), null);
});
t('orderTargetBranch: איסוף קודם לביצוע', () => {
  assert.equal(orderTargetBranch({ branch: 'א', pickupBranch: 'ב' }), 'ב');
  assert.equal(orderTargetBranch({ branch: 'א', pickupBranch: '' }), 'א');
  assert.equal(orderTargetBranch({}), null); assert.equal(orderTargetBranch(null), null);
});
t('findBranchByName / pickDefaultBranch', () => {
  const c = { branches: [B('1', 'א', { isMain: true }), B('2', 'ב'), B('3', 'ג', { active: false })] };
  assert.equal(findBranchByName(c, ' ב ').id, '2'); assert.equal(findBranchByName(c, 'לא'), null);
  assert.equal(pickDefaultBranch(c, 'ב'), 'ב'); assert.equal(pickDefaultBranch(c, 'ג'), 'א'); assert.equal(pickDefaultBranch(c, ''), 'א');
});

console.log('ולידציה ושמירה');
t('תקין: ראשי יחיד, מזהים נשמרים/נוצרים', () => {
  const r = sanitizeBranchesInput([{ id: 'k', name: 'א', isMain: true }, { name: ' ב  ב ', pickup: false }], { idGen: (i) => `gen${i}` });
  assert.equal(r.ok, true); assert.deepEqual(r.branches.map((b) => [b.id, b.name, b.isMain, b.pickup]), [['k', 'א', true, true], ['gen1', 'ב ב', false, false]]);
});
t('שגיאות: שם ריק, כפול, פסיק, בלי ראשי, שני ראשיים, ריק לגמרי עובר', () => {
  assert.equal(sanitizeBranchesInput([{ name: '' }]).ok, false);
  assert.match(sanitizeBranchesInput([{ name: 'א', isMain: true }, { name: 'א' }]).errors.join('|'), /פעמיים/);
  assert.match(sanitizeBranchesInput([{ name: 'א,ב', isMain: true }]).errors.join('|'), /תו אסור/);
  assert.match(sanitizeBranchesInput([{ name: 'א' }, { name: 'ב' }]).errors.join('|'), /ראשי אחד/);
  assert.match(sanitizeBranchesInput([{ name: 'א', isMain: true }, { name: 'ב', isMain: true }]).errors.join('|'), /רק סניף ראשי אחד/);
  assert.equal(sanitizeBranchesInput([]).ok, true);
  assert.equal(sanitizeBranchesInput('x').ok, false);
});
t('סניף מושבת לא נחשב ראשי', () => {
  const r = sanitizeBranchesInput([{ name: 'א', isMain: true }, { name: 'ב', isMain: true, active: false }]);
  assert.equal(r.ok, true); assert.equal(r.branches[1].isMain, false);
});
t('שם ארוך / יותר מדי סניפים', () => {
  assert.equal(sanitizeBranchesInput([{ name: 'א'.repeat(41), isMain: true }]).ok, false);
  assert.equal(sanitizeBranchesInput(Array.from({ length: 13 }, (_, i) => ({ name: `ס${i}`, isMain: i === 0 }))).ok, false);
});
t('settingsFromBranches: branch_list משתקף, ראשי ראשון, מושבתים לא נכללים', () => {
  const branches = [B('1', 'ב'), B('2', 'א', { isMain: true }), B('3', 'ג', { active: false })];
  const w = settingsFromBranches(branches);
  assert.equal(w.branch_list, 'א, ב');
  assert.equal(JSON.parse(w.branches_config).branches.length, 3);
  assert.equal(branchListString({ branches }), 'א, ב');
});
t('renamedBranches: רק שינוי שם של מזהה קיים', () => {
  const prev = [B('1', 'א'), B('2', 'ב')];
  assert.deepEqual(renamedBranches(prev, [B('1', 'א2'), B('2', 'ב'), B('3', 'חדש')]), [{ id: '1', from: 'א', to: 'א2' }]);
});

console.log(`\n${passed} בדיקות עברו${process.exitCode ? ', יש כשלים' : ''}`);
