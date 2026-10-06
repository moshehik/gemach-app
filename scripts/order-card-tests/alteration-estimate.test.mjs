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
