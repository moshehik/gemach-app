// בדיקת יחידה ל"מעבר עצמאי בין העיצוב הישן לחדש" (lib/uiVariantSelfSwitch.js + buildUiVariantOverride):
//   POST /api/me/ui-variant/shell|home — הנהלה ראשית / מתכנת בלבד, לרשומה של עצמם בלבד.
// לא נוגעת ב-DB (לקוח prisma מזויף) ולא ב-Next. הרצה: node scripts/test_ui_variant_self_switch.mjs (קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { applyUiVariantRequest, describeSelfSwitch, isManagementRole, isSelfSwitchScreen, SELF_SWITCH_SCREENS } from '../lib/uiVariantSelfSwitch.js';
import { buildUiVariantOverride, buildLegacyShellOverride } from '../lib/designPrefsSchema.js';
import { resolveUiVariant } from '../lib/uiVariant.js';

let passed = 0;
async function ta(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// לקוח prisma מזויף: רק employee.update; כל שאר הפעולות זורקות. רושם כל קריאה.
function fakePrisma() {
  const calls = [];
  const forbid = (n) => () => { throw new Error(`${n} must not be used`); };
  return {
    calls,
    prisma: {
      employee: {
        async update(args) { calls.push(args); return { id: args.where.id }; },
        findFirst: forbid('employee.findFirst'), updateMany: forbid('employee.updateMany'), create: forbid('employee.create'), delete: forbid('employee.delete'),
      },
      auditLog: { create: forbid('auditLog.create') },
      $transaction: forbid('$transaction'),
    },
  };
}
const emp = (over = {}) => ({ id: 'emp-me', roleId: 0, isActive: true, themeColor: null, ...over });
const call = (screen, body, employee, fp = fakePrisma()) =>
  applyUiVariantRequest({ screen, body, employee, prisma: fp.prisma }).then((r) => ({ ...r, fp }));
const stored = (calls) => JSON.parse(calls[0].data.themeColor);

console.log('תפקידים ומסכים');
await ta('isManagementRole: 0 ו-2 בלבד (כמו isHeadManagement ב-layout); 1 / null / מחרוזות / undefined לא', () => {
  assert.equal(isManagementRole(0), true); assert.equal(isManagementRole(2), true);
  for (const bad of [1, 3, -1, null, undefined, '0', '2', 'admin', NaN, [], {}, true, false]) assert.equal(isManagementRole(bad), false, String(bad));
});
// 4.10.2026: הרשימה נגזרת מ-lib/uiVariantScreens.js (selfSwitch + שתי הגרסאות קיימות) - נוספו 4 המסכים של אותו יום.
await ta('מסכים מותרים: shell, home + המסכים של 4.10.2026 (מהרשומה)', () => {
  assert.deepEqual([...SELF_SWITCH_SCREENS], ['shell', 'home', 'profile', 'admin_hub', 'attendance', 'error_report', 'board', 'settings']);
  for (const s of ['shell', 'home', 'profile', 'admin_hub', 'attendance', 'error_report', 'board', 'settings']) assert.equal(isSelfSwitchScreen(s), true);
  for (const s of ['order_card', 'customer_card', 'employee_card', '', null, undefined, '__proto__', 'constructor', 'SHELL', ['shell'], 5]) assert.equal(isSelfSwitchScreen(s), false, String(s));
});
await ta('describeSelfSwitch: הנהלה / מתכנת רואים את הסעיף; מנהל סניף, עובד, אורח לא', () => {
  assert.deepEqual(describeSelfSwitch(emp({ roleId: 0 })), { canSelfSwitch: true, screens: ['shell', 'home', 'profile', 'admin_hub', 'attendance', 'error_report', 'board', 'settings'] });
  assert.deepEqual(describeSelfSwitch(emp({ roleId: 2 })), { canSelfSwitch: true, screens: ['shell', 'home', 'profile', 'admin_hub', 'attendance', 'error_report', 'board', 'settings'] });
  for (const e of [emp({ roleId: 1 }), emp({ roleId: 5 }), emp({ roleId: null }), null]) assert.deepEqual(describeSelfSwitch(e), { canSelfSwitch: false, screens: [] });
});

console.log('הנהלה ראשית / מתכנת: a5 / legacy / null על shell ו-home');
await ta("הנהלה: shell='a5' מצליח, נכתב ל-themeColor.uiVariants.shell של העובד המאומת בלבד", async () => {
  const r = await call('shell', { value: 'a5' }, emp());
  assert.equal(r.status, 200); assert.equal(r.json.success, true); assert.equal(r.json.value, 'a5'); assert.equal(r.json.shell, 'a5'); assert.equal(r.json.changed, true);
  assert.equal(r.fp.calls.length, 1);
  assert.deepEqual(r.fp.calls[0].where, { id: 'emp-me' }); assert.deepEqual(r.fp.calls[0].select, { id: true });
  assert.deepEqual(Object.keys(r.fp.calls[0].data), ['themeColor']);
  assert.deepEqual(stored(r.fp.calls).uiVariants, { shell: 'a5' });
  assert.deepEqual(r.nextPrefs.uiVariants, { shell: 'a5' });
});
await ta("מתכנת (roleId 2): home='a5' מצליח", async () => {
  const r = await call('home', { value: 'a5' }, emp({ roleId: 2 }));
  assert.equal(r.status, 200); assert.deepEqual(stored(r.fp.calls).uiVariants, { home: 'a5' }); assert.equal(r.json.screen, 'home'); assert.equal(r.json.value, 'a5');
});
await ta('שני המסכים בנפרד: מעבר על home לא נוגע ב-shell ולהפך; שאר ההעדפות נשמרות', async () => {
  const start = JSON.stringify({ v: 1, palette: 'forest', mode: 'dark', uiVariants: { shell: 'a5', order_card: 'legacy' } });
  const r = await call('home', { value: 'a5' }, emp({ themeColor: start }));
  assert.deepEqual(stored(r.fp.calls), { v: 1, palette: 'forest', mode: 'dark', uiVariants: { shell: 'a5', order_card: 'legacy', home: 'a5' } });
  const back = await call('shell', { value: 'legacy' }, emp({ themeColor: r.fp.calls[0].data.themeColor }));
  assert.deepEqual(stored(back.fp.calls).uiVariants, { shell: 'legacy', order_card: 'legacy', home: 'a5' });
});
await ta("חזרה: 'legacy' כותב legacy; null מוחק רק את המסך הזה (ומסיר את המפתח כשנשאר ריק)", async () => {
  const a = await call('shell', { value: 'legacy' }, emp({ themeColor: JSON.stringify({ v: 1, uiVariants: { shell: 'a5' } }) }));
  assert.deepEqual(stored(a.fp.calls).uiVariants, { shell: 'legacy' });
  const b = await call('shell', { value: null }, emp({ themeColor: JSON.stringify({ v: 1, palette: 'wine', uiVariants: { shell: 'a5' } }) }));
  assert.equal(b.status, 200); assert.equal(b.json.value, null); assert.equal(b.json.uiVariants, null);
  assert.deepEqual(stored(b.fp.calls), { v: 1, palette: 'wine' });
});
await ta('אין שינוי = אין כתיבה ל-DB (אידמפוטנטי), אבל התשובה מצליחה ומחזירה nextPrefs (לרענון העוגייה)', async () => {
  const r = await call('shell', { value: 'a5' }, emp({ themeColor: JSON.stringify({ v: 1, uiVariants: { shell: 'a5' } }) }));
  assert.equal(r.status, 200); assert.equal(r.json.changed, false); assert.equal(r.fp.calls.length, 0); assert.deepEqual(r.nextPrefs.uiVariants, { shell: 'a5' });
});
await ta('הערך שנכתב באמת משפיע על resolveUiVariant (a5 → a5, legacy גובר על הגדרת ארגון a5)', async () => {
  const r = await call('shell', { value: 'a5' }, emp());
  assert.equal(resolveUiVariant('shell', { userVariants: r.nextPrefs.uiVariants, settings: {} }), 'a5');
  const l = await call('home', { value: 'legacy' }, emp());
  assert.equal(resolveUiVariant('home', { userVariants: l.nextPrefs.uiVariants, settings: { ui_variant_home: 'a5' } }), 'legacy');
});

console.log('כל מי שאינו הנהלה: כמו היום (shell legacy/null בלבד), בלי דרך ל-a5');
for (const roleId of [1, 3, 7, null, undefined]) {
  await ta(`roleId=${roleId}: shell='a5' → 403 בעברית, בלי כתיבה`, async () => {
    const r = await call('shell', { value: 'a5' }, emp({ roleId }));
    assert.equal(r.status, 403); assert.match(r.json.error, /[א-ת]/); assert.equal(r.json.success, false); assert.equal(r.fp.calls.length, 0); assert.equal(r.nextPrefs, undefined);
  });
  await ta(`roleId=${roleId}: shell='legacy' ו-null עובדים כמו קודם`, async () => {
    const a = await call('shell', { value: 'legacy' }, emp({ roleId }));
    assert.equal(a.status, 200); assert.deepEqual(stored(a.fp.calls).uiVariants, { shell: 'legacy' });
    const b = await call('shell', { value: null }, emp({ roleId, themeColor: JSON.stringify({ v: 1, uiVariants: { shell: 'legacy' } }) }));
    assert.equal(b.status, 200); assert.equal(b.fp.calls.length, 1); assert.equal(stored(b.fp.calls).uiVariants, undefined);
  });
  await ta(`roleId=${roleId}: home — כל ערך נדחה 403 (המעבר העצמאי של דף הבית להנהלה בלבד)`, async () => {
    for (const value of ['a5', 'legacy', null]) {
      const r = await call('home', { value }, emp({ roleId }));
      assert.equal(r.status, 403, String(value)); assert.equal(r.fp.calls.length, 0);
    }
  });
}
await ta('הרשאה לפי התפקיד ב-DB, לא לפי הגוף: roleId / isHeadManagement / employeeId בגוף נתעלמים', async () => {
  const body = { value: 'a5', roleId: 0, isHeadManagement: true, isProgrammer: true, role: 'admin', employeeId: 'emp-boss', id: 'emp-boss' };
  const r = await call('shell', body, emp({ roleId: 1 }));
  assert.equal(r.status, 403); assert.equal(r.fp.calls.length, 0);
});

console.log('מסכים אחרים, יעד אחר, ערכים עוינים');
await ta('order_card / customer_card / מסכים לא מוכרים נדחים (גם להנהלה), בלי כתיבה', async () => {
  for (const screen of ['order_card', 'customer_card', 'employee_card', 'foo', '', '__proto__', 'constructor', undefined, null, 'SHELL']) {
    const r = await call(screen, { value: 'a5' }, emp());
    assert.equal(r.status, 400, String(screen)); assert.equal(r.fp.calls.length, 0);
  }
});
await ta('אי אפשר לכוון עובד אחר: מזהה בגוף נתעלם, ה-update תמיד על employee.id של המאומת', async () => {
  const body = { value: 'a5', employeeId: 'emp-victim', id: 'emp-victim', where: { id: 'emp-victim' }, data: { roleId: 0 } };
  const r = await call('shell', body, emp({ id: 'emp-boss' }));
  assert.equal(r.status, 200); assert.equal(r.fp.calls.length, 1);
  assert.deepEqual(r.fp.calls[0].where, { id: 'emp-boss' }); assert.deepEqual(Object.keys(r.fp.calls[0].data), ['themeColor']); assert.equal(r.json.employeeId, 'emp-boss');
});
await ta('לא מחובר → 401; עובד לא פעיל → 403 (גם הנהלה); בלי כתיבה', async () => {
  const a = await call('shell', { value: 'a5' }, null); assert.equal(a.status, 401); assert.equal(a.fp.calls.length, 0);
  const b = await call('shell', { value: 'a5' }, emp({ isActive: false })); assert.equal(b.status, 403); assert.equal(b.fp.calls.length, 0);
  const c = await call('shell', { value: 'a5' }, emp({ isActive: undefined })); assert.equal(c.status, 403);
});
await ta('ערכים עוינים (גם להנהלה) → 400, בלי כתיבה', async () => {
  const hostile = ['A5', ' a5', 'a5 ', 'a5\n', 'LEGACY', 'Legacy', '', 'null', 'undefined', 'true', 'new', 'old', '<script>', "a5'; DROP TABLE", 0, 1, true, false, NaN, undefined, ['a5'], ['legacy'], { a5: 1 }, { value: 'a5' }, ['a5', 'legacy'], 'a'.repeat(100000)];
  for (const value of hostile) {
    for (const screen of ['shell', 'home']) {
      const r = await call(screen, { value }, emp());
      assert.equal(r.status, 400, `${screen}:${String(JSON.stringify(value)).slice(0, 30)}`); assert.equal(r.fp.calls.length, 0);
    }
  }
});
await ta('גוף חסר / לא אובייקט / בלי value / JSON שבור → 400 (value חסר שונה מ-null)', async () => {
  for (const body of [null, undefined, 'a5', 5, [], ['a5'], {}, { Value: 'a5' }, { val: 'a5' }]) {
    const r = await call('shell', body, emp()); assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(r.fp.calls.length, 0);
  }
  const fp = fakePrisma();
  const r = await applyUiVariantRequest({ screen: 'shell', body: null, bodyParseFailed: true, employee: emp(), prisma: fp.prisma });
  assert.equal(r.status, 400); assert.equal(fp.calls.length, 0);
});
await ta('מפתחות מוזרים בגוף (__proto__ / constructor) לא משפיעים ולא מזהמים', async () => {
  const body = JSON.parse('{"value":"a5","__proto__":{"roleId":0},"constructor":{"prototype":{"roleId":0}}}');
  const r = await call('shell', body, emp({ roleId: 1 }));
  assert.equal(r.status, 403); assert.equal({}.roleId, undefined);
});
await ta('themeColor פגום / ישן אצל העובד — נתפס בלי לקרוס ובלי לשמר זבל', async () => {
  for (const themeColor of [null, '', 'standard', 'dark', '{bad json', '{"v":2}', '[]', '{"v":1,"uiVariants":"a5"}', '{"v":1,"uiVariants":{"shell":"hax","home":5,"zzz":"a5"}}']) {
    const r = await call('shell', { value: 'a5' }, emp({ themeColor }));
    assert.equal(r.status, 200, String(themeColor)); assert.deepEqual(stored(r.fp.calls).uiVariants, { shell: 'a5' }, String(themeColor));
  }
});

console.log('buildUiVariantOverride / buildLegacyShellOverride (תאימות לאחור)');
await ta('בלי allowA5: a5 נדחה בסכמה עצמה (שכבה שנייה); עם allowA5=true: מותר; מסך לא מוכר נדחה', () => {
  assert.equal(buildUiVariantOverride('{"v":1}', 'shell', 'a5').ok, false);
  assert.equal(buildUiVariantOverride('{"v":1}', 'shell', 'a5', { allowA5: 'yes' }).ok, false, 'allowA5 חייב להיות בדיוק true');
  assert.equal(buildUiVariantOverride('{"v":1}', 'shell', 'a5', { allowA5: true }).ok, true);
  assert.equal(buildUiVariantOverride('{"v":1}', 'nope', 'legacy', { allowA5: true }).ok, false);
});
await ta('buildLegacyShellOverride עדיין דוחה a5 ועובד כמו קודם', () => {
  assert.equal(buildLegacyShellOverride('{"v":1}', 'a5').ok, false);
  const r = buildLegacyShellOverride(JSON.stringify({ v: 1, palette: 'wine', uiVariants: { home: 'a5' } }), 'legacy');
  assert.deepEqual(r.next.uiVariants, { home: 'a5', shell: 'legacy' }); assert.equal(r.changed, true);
});

console.log(`\n${passed} passed${process.exitCode ? ' - WITH FAILURES' : ''}`);
