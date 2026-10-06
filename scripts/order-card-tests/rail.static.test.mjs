// בדיקות סטטיות של W5 (רייל + חלונות שמירה): חיווט ה-slots, איסורים (החלטות בעלים AMB-01/AMB-05/R10), רכיבי פלטה בלבד, אין מודל מותאם,
// והחוזה מול W4 (שמות אירועי ה-DOM). קוראות את קבצי הקוד כטקסט (JSX לא נטען ב-node).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const OC = path.join(PROJ, 'app/components/order-card');
const read = (p) => fs.readFileSync(p, 'utf8');
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const W5_JS = ['parts/OcRail.js', 'parts/OcMoneyToast.js', 'parts/OcDraftBanner.js', 'parts/ocRailLogic.js', 'dialogs/OcSummaryDialog.js', 'dialogs/OcSuccessDialog.js',
  'dialogs/OcDiscardDialog.js', 'dialogs/OcConflictDialog.js', 'dialogs/OcStockDialog.js', 'dialogs/ocDialogParts.js'];
const SRC = Object.fromEntries(W5_JS.map((f) => [f, read(path.join(OC, f))]));
const CODE = Object.fromEntries(W5_JS.map((f) => [f, stripJs(SRC[f])]));
const ALL_CODE = Object.values(CODE).join('\n');
const RAIL_CSS = read(path.join(OC, 'css/oc-rail.css'));

test('W5: כל הקבצים של PLAN §D.5 קיימים', () => {
  for (const f of [...W5_JS, 'css/oc-rail.css']) assert.ok(fs.existsSync(path.join(OC, f)), f);
});

test('slots.js: כל החלקים של W5 מחוברים לרכיבים שלו (לא לברירות המחדל של W1)', () => {
  const slots = read(path.join(OC, 'slots.js'));
  const want = { Rail: 'OcRail', DraftBanner: 'OcDraftBanner', MoneyToast: 'OcMoneyToast', ConflictDialog: 'OcConflictDialog', StockDialog: 'OcStockDialog', SummaryDialog: 'OcSummaryDialog', ExitDialog: 'OcExitDialog', DiscardDialog: 'OcDiscardDialog' };
  for (const [k, v] of Object.entries(want)) assert.ok(new RegExp(`\\b${k}: ${v},`).test(slots), `${k} → ${v}`);
  assert.ok(/import OcDiscardDialog, \{ OcExitDialog \} from '\.\/dialogs\/OcDiscardDialog'/.test(slots));
  for (const [file, name] of [['parts/OcRail', 'OcRail'], ['parts/OcDraftBanner', 'OcDraftBanner'], ['parts/OcMoneyToast', 'OcMoneyToast'], ['dialogs/OcConflictDialog', 'OcConflictDialog'], ['dialogs/OcStockDialog', 'OcStockDialog'], ['dialogs/OcSummaryDialog', 'OcSummaryDialog']]) {
    assert.ok(new RegExp(`import ${name} from './${file}'`).test(slots), file);
  }
});

test('AMB-05: אין שורת אזהרת חוב מתחת ללחצני השמירה (R5 הוסר) - לא בקוד ולא ב-CSS; החוב מוצג רק בחלון התשלום', () => {
  assert.ok(!/oc-r5|railShield|תדרוש אישור מנהל|שמירה עם יתרת חוב/.test(ALL_CODE + RAIL_CSS));
  assert.ok(!/השאר חוב/.test(ALL_CODE), '"השאר חוב (באישור מנהל)" רק בחלון התשלום של W4');
  assert.ok(!/approveDebt/.test(ALL_CODE), 'הרייל לא מאשר חוב בעצמו');
});

test('A18/W4: הרייל לא מאזין ל-debtCreated ולא פותח חלון תשלום משלו; "שמירה" = oc.save({intent}) דרך createRailActions בלבד', () => {
  assert.ok(!/debtCreated/.test(CODE['parts/OcRail.js'].replace(/oc\.save|r\.debtCreated/g, '')), 'אין מאזין debtCreated ברייל');
  assert.ok(!/useOcEvent\([^)]*'debtCreated'/.test(ALL_CODE));
  assert.ok(/oc\.save\(\{ intent: kind \}\)/.test(CODE['parts/ocRailLogic.js']));
  assert.ok(!/\.save\(/.test(CODE['parts/OcRail.js']), 'ה-JSX לא קורא ל-save ישירות');
  assert.ok(/requestPayment: requestPaymentEvent/.test(CODE['parts/OcRail.js']));
  // D1 מוצג ע"י הבקר (slot) - הרייל לא מציג חלון סיכום משלו ולא מעביר summaryConfirmed
  assert.ok(!/summaryConfirmed/.test(ALL_CODE));
});

test('חוזה W4: שמות אירועי ה-DOM זהים ל-usePaymentActions של W4 (כשהקובץ קיים)', () => {
  const logic = SRC['parts/ocRailLogic.js'];
  assert.ok(/OC_PAY_REQUEST_EVENT = 'oc:pay-request'/.test(logic));
  assert.ok(/OC_PAYMENT_DONE_EVENT = 'oc:payment-done'/.test(logic));
  assert.ok(/OC_RAIL_PRIMARY_EVENT = 'oc:rail-primary'/.test(logic));
  const w4 = path.join(OC, 'hooks/usePaymentActions.js');
  if (fs.existsSync(w4)) {
    const s = read(w4);
    assert.ok(/OC_PAY_REQUEST_EVENT = 'oc:pay-request'/.test(s), 'W4: אירוע בקשת תשלום');
    assert.ok(/OC_PAYMENT_DONE_EVENT = 'oc:payment-done'/.test(s), 'W4: אירוע תשלום שהושלם');
    assert.ok(/detail: \{ kind \}/.test(s), 'W4: detail של בקשת התשלום');
  }
});

test('הרייל: לחצנים וחיווט - data-act של הפלטה, ביטול שינויים דרך הבקר (חלון D7 של הבקר), undo/redo, חתימה, ארנק', () => {
  const rail = CODE['parts/OcRail.js'];
  for (const a of ['data-act={pr.kind', 'data-act="discard"', 'data-act="undo"', 'data-act="redo"', 'data-act="cart-toggle"', 'data-act="sig"']) assert.ok(rail.includes(a), a);
  assert.ok(/oc\.discardAll\(\)/.test(rail) && !/discardAll\(\{[^)]*confirmed/.test(rail), 'D7 נפתח ע"י הבקר (בלי confirmed)');
  assert.ok(/onClick=\{oc\.redo\}/.test(rail));
  assert.ok(/ocRef\.current\.undoChange\(key\)/.test(rail));
  assert.ok(/oc\.toggleSignature\(\)/.test(rail));
  assert.ok(/actions\.wallet\(\)/.test(rail));
  assert.ok(/disabled=\{busy\}/.test(rail), 'לחצנים מנוטרלים בזמן שמירה (oc.saving)');
  assert.ok(/classList\.toggle\('open', open\)/.test(rail), '.rail.open לגיליון התחתון');
  assert.ok(/window\.open\(printUrl\(order\.orderId\), '_blank', 'noopener'\)/.test(rail), 'R9: הדפסה דרך printUrl');
  assert.ok(!/window\.open/.test(ALL_CODE.replace(rail, '')), 'window.open רק ברייל (D6 הדפסה)');
});

test('D6 (R10/A16/R9/R44): שלושה לחצנים - הראשי לפי הגדרה, "הדפסה", "המשך לצפות בהזמנה"; בלי "לרשימה"; אין הדפסה ברישום ידני', () => {
  const s = CODE['dialogs/OcSuccessDialog.js'];
  assert.ok(!/לרשימ/.test(s + CODE['parts/ocRailLogic.js']), 'R10: אין לחצן "לרשימה"');
  assert.ok(/>הדפסה<\/DlgBtn>/.test(s) && /המשך לצפות בהזמנה/.test(s) && /\{primary\.label\}/.test(s));
  assert.ok(/class(Name)?="success"/.test(s) && /big-ck/.test(s), 'חלון 5/14 של הפלטה (div.success + big-ck)');
  assert.ok(/successTargets\(cur\.settings\.orderEditRedirectScreen/.test(CODE['parts/OcRail.js']), 'R44: היעד מהגדרת order_edit_redirect_screen');
  assert.ok(/badge: false/.test(CODE['parts/OcRail.js']), 'ל-D6 יש "גיבור" משלו - בלי תג אייקון עליון');
});

test('חלונות: תוצאות ה-close זהות לחוזה של W1 (R12 overwrite/reload/null, R48 true, D1 true/false, D2 save/discard/null, D7 true/false)', () => {
  const c = CODE['dialogs/OcConflictDialog.js'];
  assert.ok(/close\('overwrite'\)/.test(c) && /close\('reload'\)/.test(c) && /close\(null\)/.test(c));
  assert.ok(/שמור בכל זאת ולדרוס/.test(c) && /לטעון מחדש מהשרת/.test(c) && /חזרה לעריכה/.test(c), 'R12: שלוש בחירות');
  assert.ok(/close\(true\)/.test(CODE['dialogs/OcStockDialog.js']));
  const sm = CODE['dialogs/OcSummaryDialog.js'];
  assert.ok(/close\(true\)/.test(sm) && /close\(false\)/.test(sm));
  const d = CODE['dialogs/OcDiscardDialog.js'];
  assert.ok(/close\('save'\)/.test(d) && /close\('discard'\)/.test(d) && /close\(null\)/.test(d), 'D2');
  assert.ok(/close\(true\)/.test(d) && /close\(false\)/.test(d), 'D7');
  assert.ok(/שמור וצא/.test(d) && /צא בלי לשמור/.test(d) && /חזרה לעריכה/.test(d));
  assert.ok(/act="discard-close"/.test(d), 'D7: data-act של הפלטה (תג האייקון "trash")');
});

test('AMB-01: כל חלונות W5 על ערכת החלונות הכהה המשותפת (DlgHead/DlgBtn/DlgButtons) - אין מודל מותאם, portal, backdrop או position:fixed', () => {
  for (const f of ['dialogs/OcSummaryDialog.js', 'dialogs/OcDiscardDialog.js', 'dialogs/OcConflictDialog.js', 'dialogs/OcStockDialog.js']) {
    assert.ok(/from '\.\.\/OcUi'/.test(CODE[f]) && /DlgHead/.test(CODE[f]) && /DlgBtn/.test(CODE[f]), f);
  }
  assert.ok(/DlgButtons/.test(CODE['dialogs/OcSuccessDialog.js']));
  assert.ok(!/createPortal|modal-backdrop|position:\s*['"]?fixed|zIndex|window\.(alert|confirm|prompt)/.test(ALL_CODE));
  // כולם נפתחים דרך ui.openDialog (הבקר / הרייל) - D2 בפרט: slot ExitDialog, לא רכיב נפרד
  assert.ok(/ui\.openDialog\(OcSuccessDialog/.test(CODE['parts/OcRail.js']));
});

test('טוסט A23: דרך ui.toast של הכרטיס (#toast), הלחצן "לשמירה" שולח את אירוע הלחצן הראשי; הסתרה רק של הטוסט שלנו', () => {
  const t = CODE['parts/OcMoneyToast.js'];
  assert.ok(/u\.toast\(plan\.kind/.test(t) && /text: 'לשמירה'/.test(t));
  assert.ok(/OC_RAIL_PRIMARY_EVENT/.test(t) && /dispatchEvent/.test(t));
  assert.ok(/el\.dataset\.kind === s\.kind && b && b\.textContent === s\.text/.test(t), 'לא מסתירים הודעות אחרות (למשל "השינויים בוטלו")');
  assert.ok(!/getElementById\('toast'\)\.(innerHTML|remove)/.test(t));
});

test('באנר הטיוטה R11: oc.drafts.restore/discard, X סוגר מקומית בלבד, בלי localStorage (orderDrafts.js בבקר)', () => {
  const b = CODE['parts/OcDraftBanner.js'];
  assert.ok(/onClick=\{oc\.drafts\.restore\}/.test(b) && /onClick=\{oc\.drafts\.discard\}/.test(b));
  assert.ok(/setClosedAt\(d\.savedAt\)/.test(b));
  assert.ok(!/localStorage|orderDrafts/.test(ALL_CODE));
  assert.ok(/שחזר את השינויים/.test(b) && /מחק אותם/.test(b) && /נמצאו שינויים שלא נשמרו מביקור קודם בכרטיס/.test(b));
});

test('רכיבי פלטה בלבד (D11): כל מחלקה ב-className של W5 קיימת בפלטה או ב-oc-*.css', () => {
  const palette = read(path.join(PROJ, 'design-system/components.css'));
  const ocCss = fs.readdirSync(path.join(OC, 'css')).map((f) => read(path.join(OC, 'css', f))).join('\n');
  const have = (tok) => new RegExp(`\\.${tok.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`).test(palette) || new RegExp(`\\.${tok.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`).test(ocCss);
  const toks = new Set();
  for (const s of Object.values(CODE)) {
    for (const m of s.matchAll(/className="([^"]+)"/g)) m[1].split(/\s+/).forEach((t) => t && toks.add(t));
    for (const m of s.matchAll(/className=\{`([^`]+)`\}/g)) m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).forEach((t) => t && toks.add(t));
  }
  // cart-due: מחלקת וו ל-JS בלבד (הנפשת מספרים בעיצוב: tween('.cart-due bdi')), אין לה סגנון בפלטה
  const HOOKS = new Set(['cart-due']);
  const missing = [...toks].filter((t) => !HOOKS.has(t) && !have(t));
  assert.deepEqual(missing, [], 'מחלקות שלא קיימות בפלטה/CSS של הכרטיס: ' + missing.join(', '));
});

test('oc-rail.css: בהיקף .gm-ds.gm-oc בלבד, בלי !important, בלי צבעי hex/rgb מקודדים, בלי גופן, בלי @media לפני הבסיס', () => {
  const text = RAIL_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.ok(sels.length >= 4);
  for (const [, sel, body] of sels) {
    const split = (x) => { const out = []; let d = 0, c = ''; for (const ch of x) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(c.trim()); c = ''; } else c += ch; } if (c.trim()) out.push(c.trim()); return out; };
    for (const s of split(sel)) assert.ok(/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s), `מחוץ להיקף: ${s}`);
    assert.ok(!/!important/.test(body), `!important: ${sel}`);
    assert.ok(!/font-family/.test(body), `font-family: ${sel}`);
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(body), `צבע מקודד: ${sel}`);
  }
  assert.ok(!/@media/.test(text) && !/[a-z0-9]-\*\//i.test(RAIL_CSS));
});
