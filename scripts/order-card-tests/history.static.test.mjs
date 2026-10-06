// W6 — בדיקות סטטיות של לשונית ההיסטוריה: רישום הלשונית, ריענון לפי oc.historyVersion, כל ייצוא/הדפסה נרשם (HISTORY_EXPORTED)
// בשלושת הפורמטים, R40 (אין "בוצעה על ידי" / "עובדים פעילים בהזמנה"), שערי ה-routes, דף ההדפסה (שער, data-print-ready, בלי משתני
// ערכת נושא, בלי ORDER_PRINTED), printAccess בשורה אחת, ובלי תאריך לועזי / UUID בתצוגה.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const read = (rel) => fs.readFileSync(path.join(PROJ, rel), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const W6_UI = ['app/components/order-card/tabs/OcHistoryTab.js', 'app/components/order-card/parts/OcJournalCard.js',
  'app/components/order-card/parts/OcHistoryFeed.js', 'app/components/order-card/parts/OcHistoryTable.js', 'app/components/order-card/parts/OcHighlight.js', 'app/components/order-card/parts/ocHistoryModel.js'];

test('הלשונית רשומה ב-tabs/index.js (שורת W6) ונטענת מחדש לפי oc.historyVersion', () => {
  const idx = strip(read('app/components/order-card/tabs/index.js'));
  assert.match(idx, /import OcHistoryTab from '\.\/OcHistoryTab';/);
  assert.match(idx, /history: OcHistoryTab,/);
  const tab = strip(read('app/components/order-card/tabs/OcHistoryTab.js'));
  assert.match(tab, /oc\.historyVersion/);
  // הסקירה: היומן נטען פעם אחת ב-OrderCardA5 (OcStepper.useOrderJournalData) ומשותף דרך OcJournalContext - לשונית ההיסטוריה לא טוענת אותו שוב
  assert.ok(!/\/journal/.test(tab.replace(/OcJournalContext|הקשר/g, '')), 'אין fetch של journal בלשונית');
  assert.match(tab, /const journal = useOcJournal\(\);/);
  assert.match(tab, /\/api\/orders\/\$\{orderId\}\/history\?all=1/);
  assert.match(read('app/components/order-card/OcStepper.js'), /fetch\(`\/api\/orders\/\$\{orderId\}\/journal`/);
  const a5 = read('app/components/order-card/OrderCardA5.js');
  assert.equal((a5.match(/useOrderJournalData\(oc\)/g) || []).length, 1, 'טעינה אחת לכרטיס');
  assert.match(read('app/components/order-card/OcStepper.js'), /\[oc\.status, orderId, oc\.historyVersion\]/, 'מתרענן בכל כתיבה (historyVersion)');
  assert.match(tab, /\/api\/orders\/\$\{orderId\}\/history\?all=1/);
  assert.match(tab, /oc\.bumpHistory\(\)/, 'a schedule mark from the card refreshes the feed');
});

test('A21: כל ייצוא (Excel / הורדה PDF / הדפסה) נרשם HISTORY_EXPORTED עם הפורמט ומספר השורות', () => {
  const feed = strip(read('app/components/order-card/parts/OcHistoryFeed.js'));
  for (const f of ['xlsx', 'pdf', 'print']) assert.match(feed, new RegExp(`oc\\.logEvent\\('HISTORY_EXPORTED', \\{ format: '${f}', rows: list\\.length \\}\\)`), f);
  assert.match(feed, /downloadRowsAsXlsx\(exportRows\(shownList\)/, 'Excel = the same rows that are shown');
  assert.match(feed, /fetch\('\/api\/pdf'/);
  assert.match(feed, /historyPrintPath\(orderId, \{ selected: sel, q, pdf: true \}\)/);
  assert.match(feed, /window\.open\(historyPrintPath\(orderId, \{ selected: sel, q \}\)/);
  assert.ok(!/ORDER_PRINTED/.test(feed));
});

test('R40: אין "בוצעה על ידי" / "עובדים פעילים בהזמנה" בכרטיס החדש (המידע ביומן); A20 בלי PROC_WHO/PROC_SHIFT הקבועים', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]));
  for (const f of walk(path.join(PROJ, 'app/components/order-card')).filter((f) => f.endsWith('.js'))) {
    const s = strip(fs.readFileSync(f, 'utf8'));
    assert.ok(!/בוצעה על ידי|עובדים פעילים בהזמנה|PROC_WHO|PROC_SHIFT/.test(s), f);
  }
});

test('תצוגה: אין תאריך לועזי / Intl / UUID בקבצי הלשונית; התאריכים מגיעים מהשרת (dateHe, day.he)', () => {
  for (const f of W6_UI) {
    const s = strip(read(f));
    assert.ok(!/toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat|getFullYear|getMonth\(\)/.test(s), f);
    assert.ok(!/changesJson/.test(s), `${f}: the tab never parses raw audit rows`);
  }
});

test('routes: history ו-journal נחסמים ב-page:orders אחרי ההתחברות; journal לקריאה בלבד, בלי $transaction', () => {
  for (const f of ['app/api/orders/[id]/history/route.js', 'app/api/orders/[id]/journal/route.js']) {
    const s = strip(read(f));
    const auth = s.indexOf('checkAuth()');
    const gate = s.indexOf("canOpenPage('page:orders')");
    assert.ok(auth > 0 && gate > auth, `${f}: checkAuth then page:orders`);
    assert.ok(gate < s.indexOf('prisma.order.findUnique'), `${f}: gate before any order read`);
    assert.ok(!/\$transaction|\.create\(|\.update\(|\.delete\(|\.upsert\(|auditLog\.create/.test(s), `${f}: read-only`);
  }
});

test('דף ההדפסה: שער page:orders מ-printAccess, data-print-ready, בלי משתני ערכת נושא, בלי חלון הדפסה ב-PDF, בלי ORDER_PRINTED', () => {
  const pa = read('lib/printAccess.js');
  assert.equal((pa.match(/order-history/g) || []).length, 1, 'printAccess: one line');
  assert.match(pa, /'\/print\/order-history': \['page:orders'\]/);
  const layout = strip(read('app/print/order-history/layout.js'));
  assert.match(layout, /PageGate pageKeys=\{PRINT_PATH_PAGE_KEYS\['\/print\/order-history'\]\}/);
  const page = strip(read('app/print/order-history/page.js'));
  assert.match(page, /data-print-ready=\{state\.loading \? undefined : 'true'\}/);
  assert.ok(!/var\(--/.test(page), 'no theme CSS variables in a print page');
  assert.match(page, /if \(state\.loading \|\| state\.error \|\| isPdf\) return undefined;/);
  assert.ok(!/ORDER_PRINTED|\/api\/orders\/events|log-visit/.test(page), 'the card logs HISTORY_EXPORTED on the click');
  assert.ok(!/toLocaleDateString/.test(page));
  assert.match(page, /exportRows\(h\.entries/, 'same rows as the Excel export');
});

test('CSS oc-history.css: היקף .gm-ds.gm-oc, בלי @media לפני הבסיס, בלי "-*/"', () => {
  const css = read('app/components/order-card/css/oc-history.css');
  assert.ok(!/[a-z0-9]-\*\//i.test(css));
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const sel of body.split('}').map((r) => r.split('{')[0].trim()).filter((x) => x && !x.startsWith('@'))) {
    for (const s of sel.split(',')) assert.match(s.trim(), /^\.gm-ds\.gm-oc[\s.:#[>]/, s);
  }
});

test('review: Excel מיוצא בסדר שעל המסך (מיון עמודות הטבלה), ומוצגת שורת "2000 הרישומים האחרונים" כשהייצוא נחתך', () => {
  const feed = strip(read('app/components/order-card/parts/OcHistoryFeed.js'));
  assert.match(feed, /sortTableRows\(list, sort\)/);
  assert.match(feed, /view === 'table' \? sortTableRows\(list, sort\) : list/, 'the sort applies only where the table is what is on screen');
  assert.match(feed, /truncated \? <div[^>]*>מוצגים 2000 הרישומים האחרונים<\/div>/);
  const tab = strip(read('app/components/order-card/tabs/OcHistoryTab.js'));
  assert.match(tab, /truncated=\{!!\(feed && feed\.exportTruncated\)\}/);
  assert.match(strip(read('app/print/order-history/page.js')), /מוצגים 2000 הרישומים האחרונים/, 'the print page says the same');
});

test('review a11y: תפריט הסינון - roving focus (חצים / Home / End), פוקוס לאפשרות הראשונה בפתיחה, רווח/Enter מחליפים, Esc סוגר ומחזיר פוקוס', () => {
  const feed = strip(read('app/components/order-card/parts/OcHistoryFeed.js'));
  for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape']) assert.ok(feed.includes(`'${k}'`), k);
  assert.match(feed, /onKeyDown=\{onListKey\}/, 'one key handler on the listbox');
  assert.match(feed, /tabIndex=\{n === cur \? 0 : -1\}/, 'roving tabindex: exactly the current option is tabbable');
  assert.match(feed, /\(e\.key === 'Enter' \|\| e\.key === ' '\)[^)]*toggle\(cats\[i\]\[0\]\)|toggle\(cats\[i\]\[0\]\)/);
  assert.match(feed, /first\.focus\(\)/, 'opening focuses the first option');
  assert.match(feed, /trigRef\.current\.focus\(\)/, 'Escape returns focus to the trigger');
});

// D2 (בעלים 2026-10-05): "שלבי ההזמנה" ו"יומן הזמנה" אוחדו לכרטיס אחד; אין כרטיס/שורה נפרדת "עורך ההזמנה" - מי יצר מופיע בשלב "הזמנה" ביומן
test('D2: כרטיס אחד (OcJournalCard) לשלבים + יומן; אין OcStagesCard; אין "עורך ההזמנה" / "בוצעה על ידי"; הלשונית מרנדרת כרטיס יחיד', () => {
  assert.ok(!fs.existsSync(path.join(PROJ, 'app/components/order-card/parts/OcStagesCard.js')), 'the separate stages card is gone');
  const tab = strip(read('app/components/order-card/tabs/OcHistoryTab.js'));
  assert.ok(!/OcStagesCard/.test(tab));
  assert.equal((tab.match(/<OcJournalCard /g) || []).length, 1);
  assert.match(tab, /<OcJournalCard [^>]*stages=\{journal\.stages\}[^>]*canMark=[^>]*onMark=\{onMark\}/, 'mark buttons live inside the merged list');
  const card = read('app/components/order-card/parts/OcJournalCard.js');
  assert.equal((card.match(/<div className="card /g) || []).length, 1, 'one card in the file');
  assert.match(card, /data-act="prep-mark"/);
  assert.match(card, /data-act="prep-unmark"/);
  for (const f of W6_UI) assert.ok(!/עורך ההזמנה|בוצעה על ידי|עובדים פעילים בהזמנה/.test(strip(read(f))), `${f}: no separate order-editor / performed-by card`);
});

// החלטת הבעלים 2026-10-05: אין צ׳יפ "נרשמה" / "מידע בלבד"; הזמנה שהוחזרה = בלי "טרם בוצע" / "סמן הכנה" / "השלב הנוכחי" (closedByReturn)
test('יומן: הוסרו צ׳יפי "נרשמה" ו"מידע בלבד"; השלבים הסגורים בהחזרה בלי meta; הנתיב מעביר closeWhenReturned', () => {
  const card = strip(read('app/components/order-card/parts/OcJournalCard.js'));
  assert.ok(!/נרשמה|מידע בלבד|INFO_CHIP/.test(card), 'info-only chips are gone');
  assert.match(card, /s\.infoOnly \|\| s\.closedByReturn\) return null/);
  assert.match(card, /meta \? <div className="prc-m">/, 'no empty .prc-m wrapper');
  assert.match(card, /n\.current \? <span className="chip gray prc-cur">השלב הנוכחי/, 'the current-stage chip stays (status, not info-only)');
  const route = strip(read('app/api/orders/[id]/journal/route.js'));
  assert.match(route, /closeWhenReturned: true/);
});

test('D3: כרטיס היומן מציג כפתור משמרת רק כשהצומת נושא shift (אין חזרה לכותרת "משמרת · HH:MM")', () => {
  const card = strip(read('app/components/order-card/parts/OcJournalCard.js'));
  assert.match(card, /doneBy && n\.shift \? <ShiftButton/);
  assert.ok(!/משמרת ·/.test(card));
});

test('לשונית היסטוריה: אין כותרת "מותאם" / "הפרטים המלאים של כל השינויים" מעל "פעולות ושינויים" (בעלים 2026-10-05)', () => {
  const tab = strip(read('app/components/order-card/tabs/OcHistoryTab.js'));
  assert.ok(!/מותאם|הפרטים המלאים של כל השינויים|sect-h|oc-sect-t/.test(tab));
  assert.ok(!/oc-sect-t/.test(read('app/components/order-card/css/oc-history.css')));
  assert.match(read('app/components/order-card/parts/OcHistoryFeed.js'), /<h2>פעולות ושינויים<\/h2>/, 'the feed card carries its own title');
});

test('יומן (בעלים 2026-10-06): אין צ׳יפ "טרם בוצע"; נשארים רק "השלב הנוכחי" (צ׳יפ אפור), "סמן הכנה בוצעה" / "בטל סימון" וה-✓ של שלב שבוצע', () => {
  const card = strip(read('app/components/order-card/parts/OcJournalCard.js'));
  assert.ok(!/טרם בוצע|chip amber/.test(card));
  assert.equal((card.match(/className="chip /g) || []).length, 1, 'צ׳יפ אחד בלבד בשורות היומן');
  assert.match(card, /n\.current \? <span className="chip gray prc-cur">השלב הנוכחי/);
  assert.match(card, /data-act="prep-mark"/);
  assert.match(card, /OcIcon name=\{n\.done \? 'check' : n\.icon\}/, '✓ מסמן שבוצע; בלעדיו טרם בוצע');
});
