// "בוצע (משוער)" (בעלים 2026-10-06): לוגיקה טהורה של lib/alterationEstimate.js + התצוגה בכרטיס ההזמנה (altText, שורת הפריט, סימון ידני מסיר את הסמן).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const E = await import(pathToFileURL(path.join(PROJ, 'lib/alterationEstimate.js')).href);
const A = await import(pathToFileURL(path.join(PROJ, 'app/components/order-card/hooks/useItemActions.js')).href);

test('addEstimateMarker / stripEstimateMarker: אידמפוטנטי, שומר טקסט קיים, ריק -> null; הסרה מחזירה את הטקסט המקורי', () => {
  assert.equal(E.addEstimateMarker(null), E.ESTIMATE_NOTE);
  assert.equal(E.addEstimateMarker(''), E.ESTIMATE_NOTE);
  assert.equal(E.addEstimateMarker('לקצר 5 ס״מ'), `לקצר 5 ס״מ\n${E.ESTIMATE_NOTE}`);
  assert.equal(E.addEstimateMarker('לקצר  \n'), `לקצר\n${E.ESTIMATE_NOTE}`, 'רווחי סוף לא מצטברים');
  const once = E.addEstimateMarker('א');
  assert.equal(E.addEstimateMarker(once), once, 'לא כפול');
  assert.equal(E.stripEstimateMarker(once), 'א');
  assert.equal(E.stripEstimateMarker(E.ESTIMATE_NOTE), null);
  assert.equal(E.stripEstimateMarker('בלי סמן'), 'בלי סמן');
  assert.equal(E.stripEstimateMarker(undefined), null);
  assert.equal(E.stripEstimateMarker(`א\n${E.ESTIMATE_NOTE}\nב`), 'א\nב');
  assert.equal(E.detailsWithoutMarker(`לקצר\n${E.ESTIMATE_NOTE}`), 'לקצר');
  assert.equal(E.detailsWithoutMarker(null), '');
});

test('estimateOnTake: רק פריט פעיל עם תיקון שטרם סומן; סימון ידני / בלי תיקון / מחוק = null', () => {
  const base = { neckAlteration: 1, alterationDone: false, alterationDetails: 'פירוט' };
  assert.deepEqual(E.estimateOnTake(base), { alterationDone: true, alterationDetails: `פירוט\n${E.ESTIMATE_NOTE}` });
  assert.ok(E.estimateOnTake({ sleeveAlteration: 1 }));
  assert.ok(E.estimateOnTake({ lengthAlteration: '4' }));
  assert.equal(E.estimateOnTake({ lengthAlteration: '0' }), null);
  assert.equal(E.estimateOnTake({ lengthAlteration: '' }), null);
  assert.equal(E.estimateOnTake({ neckAlteration: 0, sleeveAlteration: 0 }), null, 'בלי תיקון');
  assert.equal(E.estimateOnTake({ ...base, alterationDone: true }), null, 'סומן ע״י אדם');
  assert.equal(E.estimateOnTake({ ...base, isDeleted: true }), null);
  assert.equal(E.estimateOnTake(null), null);
});

test('תוויות: alterationDoneLabel / isAlterationEstimated / altText בכרטיס - "בוצע (משוער)" רק כשהסמן בטקסט; ידני "בוצע"', () => {
  const est = { neckAlteration: 1, alterationDone: true, alterationDetails: `x\n${E.ESTIMATE_NOTE}` };
  const man = { neckAlteration: 1, alterationDone: true, alterationDetails: 'x' };
  const pend = { neckAlteration: 1, alterationDone: false, alterationDetails: E.ESTIMATE_NOTE };
  assert.equal(E.alterationDoneLabel(est), 'בוצע (משוער)');
  assert.equal(E.alterationDoneLabel(man), 'בוצע');
  assert.equal(E.alterationDoneLabel(pend), '', 'סמן בלי done = לא בוצע');
  assert.equal(E.isAlterationEstimated(est), true);
  assert.equal(E.isAlterationEstimated(man), false);
  assert.equal(E.isAlterationEstimated(pend), false);
  assert.equal(A.altText(est), 'תיקון: צוואר · בוצע (משוער)');
  assert.equal(A.altText(man), 'תיקון: צוואר · בוצע');
  assert.equal(A.altText({ neckAlteration: 1 }), 'תיקון: צוואר');
});

test('חיווט הכרטיס: שיקוף מקומי בלקיחה (estimateOnTake) + החזרה לאחור בכישלון; סימון ידני מסיר את הסמן; שורת הפריט מציגה טולטיפ וטקסט בלי המשפט', () => {
  const act = strip(read('app/components/order-card/hooks/useItemActions.js'));
  assert.match(act, /const altPatch = estimateOnTake\(item\);/);
  assert.match(act, /\.\.\.\(altPatch \|\| \{\}\)/);
  assert.match(act, /\.\.\.\(altPatch \? \{ alterationDone: item\.alterationDone, alterationDetails: item\.alterationDetails \} : \{\}\)/);
  const ctl = strip(read('app/components/order-card/useOrderCardController.js'));
  assert.match(ctl, /hasEstimateMarker\(it\.alterationDetails\) \? \{ alterationDetails: stripEstimateMarker\(it\.alterationDetails\) \} : \{\}/);
  const row = strip(read('app/components/order-card/parts/OcItemRow.js'));
  assert.match(row, /const altEst = isAlterationEstimated\(item\);/);
  assert.match(row, /data-tip=\{ESTIMATE_TIP\}/);
  assert.match(row, /detailsWithoutMarker\(item\.alterationDetails\)/);
  assert.equal(E.ESTIMATE_TIP, 'נרשם אוטומטית בלקיחה - לא סומן ידנית');
});

// ---- תצוגה במקומות נוספים: יומן / לו״ז / מסך התיקונים / כתיבה ידנית ----
const ST = await import(pathToFileURL(path.join(PROJ, 'lib/schedule/orderStages.js')).href);
const SET = await import(pathToFileURL(path.join(PROJ, 'lib/schedule/settings.js')).href);
const IL = (key, hhmm = '00:00') => { const [h, m] = hhmm.split(':').map(Number); const [y, mo, d] = key.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d, h - 3, m)); };

test('יומן: שלב "תיקונים" שבוצע בגלל סמן משוער מסומן estimated; סימון אדם בלו״ז / תיקון ידני - לא', () => {
  const base = { orderId: 1, orderDate: IL('2026-09-23'), eventDate: IL('2026-10-08'), isAbroad: false, isDelivery: false };
  const sched = SET.resolveScheduleSettings({ enable_alterations: 'true' });
  const est = ST.computeOrderStages({ ...base, items: [{ id: 'a', neckAlteration: 1, alterationDone: true, alterationDetails: E.ESTIMATE_NOTE, isTaken: true }] }, { schedule: sched, todayKey: '2026-10-06' });
  const rep = est.stages.find((s) => s.key === 'repair');
  assert.ok(rep, 'שלב תיקונים קיים');
  assert.equal(rep.done, true);
  assert.equal(rep.estimated, true);
  const man = ST.computeOrderStages({ ...base, items: [{ id: 'a', neckAlteration: 1, alterationDone: true, alterationDetails: 'ידני', isTaken: true }] }, { schedule: sched, todayKey: '2026-10-06' });
  assert.equal(man.stages.find((s) => s.key === 'repair').estimated, false);
  const marked = ST.computeOrderStages({ ...base, items: [{ id: 'a', neckAlteration: 1, alterationDone: true, alterationDetails: E.ESTIMATE_NOTE }] }, { schedule: sched, todayKey: '2026-10-06', marks: [{ stageKey: 'repair', dayKey: '2026-10-05', done: true, markedAt: IL('2026-10-05', '10:00'), markedBy: 'רחל' }] });
  assert.equal(marked.stages.find((s) => s.key === 'repair').estimated, false, 'סימון אדם בלו״ז גובר');
  assert.match(strip(read('app/components/order-card/parts/OcJournalCard.js')), /stage && stage\.estimated \? <> <span className="faint" data-tip=\{ESTIMATE_TIP\}>\(משוער\)<\/span><\/> : null/);
  assert.match(strip(read('app/api/orders/[id]/journal/route.js')), /alterationDetails: true, alterationDone: true,/);
});

test('לו״ז / מסך התיקונים / כתיבה ידנית: doneVia alterationEstimated + טקסט, תווית במסך התיקונים, הסרת הסמן בסימון ידני (לו״ז, שמירת הזמנה)', () => {
  const loaders = strip(read('lib/schedule/loaders.js'));
  assert.match(loaders, /estimated: isAlterationEstimated\(it\)/);
  assert.match(loaders, /row\.estimatedDone = row\.done && altItems\.some\(\(it\) => isAlterationEstimated\(it\)\)/);
  assert.match(strip(read('lib/schedule/marks.js')), /row\.doneVia = stage\.key === 'repair' && row\.estimatedDone \? 'alterationEstimated'/);
  assert.match(read('app/components/schedule/MarkDialogs.js'), /alterationEstimated: 'לפי מסך התיקונים \(משוער - נרשם אוטומטית בלקיחה\)'/);
  const page = strip(read('app/alterations/page.js'));
  assert.match(page, /alterationStatus: alterationDoneLabel\(item\) \|\| 'ממתין'/);
  assert.match(page, /title=\{isAlterationEstimated\(item\) \? ESTIMATE_TIP : undefined\}/);
  const marks = strip(read('lib/schedule/marks.js'));
  assert.match(marks, /\(wanted && hasEstimateMarker\(it\.alterationDetails\)\)/);
  assert.match(marks, /stripEstimateMarker\(it\.alterationDetails\)/);
  const put = strip(read('app/api/orders/[id]/route.js'));
  assert.match(put, /stored && !!item\.alterationDone !== !!stored\.alterationDone && hasEstimateMarker\(item\.alterationDetails\) \? stripEstimateMarker\(item\.alterationDetails\) : item\.alterationDetails/);
  assert.match(read('lib/history/orderHistory.js'), /ch\.estimated === true \? `תיקון נרשם כבוצע \(משוער\) בלקיחה: \$\{label\}`/);
});
