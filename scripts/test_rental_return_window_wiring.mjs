// חיווט "זרימת הברקוד ברצף" (feature/quick-barcode-flow) אל החלון בשימוש בפועל במעטפת החדשה - RentalReturnWindow (#276) - ולא רק אל RentalReturnModal הישן.
// שני החלונות חולקים את אותו hook (components/orders/useRentalReturn.js: processBarcode / onSwitchOrder / onItemReturned / scanNotice); כאן בודקים סטטית
// שהחלון החדש מעביר אליו את אותם פרמטרים, מרכיב את עצמו מחדש בהחלפת הזמנה, מציג את שורת ההודעות, ושה-PopupProvider מעביר initialBarcode לשניהם.
// בנוסף: תיקוני הברקוד בלו"ז (O9) בחלון החדש, והתראת החזרה לסניף אחר (BranchReturnAlertHost) לא נסגרת יחד עם Escape של החלון.
// הרצה: node scripts/test_rental_return_window_wiring.mjs   (בלי DB, בלי דפדפן)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', String(e.message).slice(0, 500)); process.exitCode = 1; } };

const WIN = read('app/components/rental-return/RentalReturnWindow.js');
const MODAL = read('components/orders/RentalReturnModal.js');
const HOOK = read('components/orders/useRentalReturn.js');
const POPUP = read('app/components/PopupProvider.js');

t('ה-hook המשותף מקבל initialBarcode / onSwitchOrder / onItemReturned ומחזיר scanNotice (מקור ההתנהגות לשני החלונות)', () => {
  assert.match(HOOK, /export function useRentalReturn\(\{ orderId, onClose, onUpdate, ui, initialBarcode = '', onSwitchOrder = null, onItemReturned = null \}\)/);
  assert.match(HOOK, /scanNotice,\s*\n\s*setScanNotice,/);
  assert.match(HOOK, /gemach:item-returned/);
});

t('RentalReturnModal הישן: אותו חוזה (initialBarcode, מעבר הזמנה, הודעות)', () => {
  assert.match(MODAL, /initialBarcode/);
  assert.match(MODAL, /onSwitchOrder/);
  assert.match(MODAL, /scanNotice/);
});

t('RentalReturnWindow החדש: מעביר ל-hook את initialBarcode / onSwitchOrder / onItemReturned ומציג את scanNotice', () => {
  assert.match(WIN, /useRentalReturn\(\{ orderId, onClose, onUpdate, ui, initialBarcode, onSwitchOrder, onItemReturned \}\)/);
  assert.match(WIN, /scanNotice,/);
  assert.match(WIN, /id="rrmScanNotice"[\s\S]{0,300}scanNotice\.text/);
  assert.match(WIN, /scanNotice\.kind === 'ok' \? 'green' : scanNotice\.kind === 'err' \? 'red' : 'gray'/);
});

t('RentalReturnWindow החדש: עטיפה שמרכיבה מחדש את הפנימי בהחלפת הזמנה / ברקוד חדש מההורה (key = orderId:seq), כמו המודל הישן', () => {
  assert.match(WIN, /export default function RentalReturnA5\(\{ orderId, initialBarcode = '', onClose, onUpdate, onItemReturned \}\)/);
  assert.match(WIN, /const switchOrder = useCallback\(\(nextOrderId, barcode\) =>/);
  assert.match(WIN, /<RentalReturnInner key=\{`\$\{cur\.orderId\}:\$\{cur\.seq\}`\} orderId=\{cur\.orderId\} initialBarcode=\{cur\.barcode\} onSwitchOrder=\{switchOrder\}/);
  assert.match(WIN, /seen\.orderId !== orderId \|\| seen\.initialBarcode !== initialBarcode/);
});

t('PopupProvider: openRentalModal(orderId, {barcode}) ומעביר initialBarcode גם לחלון החדש (a5) וגם לישן', () => {
  assert.match(POPUP, /const openRentalModal = useCallback\(\(orderId, opts\) => \{\s*\n\s*setGlobalRentalModalBarcode\(\(opts && opts\.barcode\) \|\| ''\);/);
  const a5 = (POPUP.match(/<RentalReturnA5[\s\S]*?\/>/) || [''])[0];
  const old = (POPUP.match(/<RentalReturnModal\s[\s\S]*?\/>/) || [''])[0];
  assert.ok(/initialBarcode=\{globalRentalModalBarcode\}/.test(a5), 'a5');
  assert.ok(/initialBarcode=\{globalRentalModalBarcode\}/.test(old), 'old');
  assert.match(POPUP, /setGlobalRentalModalBarcode\(''\);/); // closeRentalModal מאפס
  assert.match(POPUP, /shellVariant === 'a5'/);
});

t('החיפוש המהיר (מעטפת חדשה) מפעיל את הזרימה דרך PopupProvider.openRentalModal; placeholder "הקלד ברקוד או חפש..."', () => {
  const sp = read('app/components/menu/MenuSearchPanel.js');
  assert.match(sp, /runQuickBarcode\(barcodeDigits, \{ openRentalModal: popup\?\.openRentalModal \}\)/);
  assert.ok(sp.includes('placeholder="הקלד ברקוד או חפש..."'));
});

t('ברקוד שנרשם בהכנה בלו"ז (O9) בחלון החדש: באנר "אשר מסירה" ובלי שבב "ממתין לאישור השכרה" לפריט כזה', () => {
  assert.match(WIN, /preppedCount > 0/);
  assert.match(WIN, /ברקוד בהכנה \(מהלו״ז\) וטרם נמסרו/);
  assert.match(WIN, /item\.barcode && !item\.isTaken && !item\.barcodeRegisteredAtPrep \? <span className="chip gold bd-wait">/);
  assert.match(HOOK, /ברקוד נרשם בהכנה – טרם נמסר/);
});

t('התראת החזרה לסניף אחר / רזרבה: /api/returns/scan מחזיר branchAdvices (buildReturnAdvices) והלקוח עוטף fetch; Escape על ההתראה לא סוגר את החלון', () => {
  const route = read('app/api/returns/scan/route.js');
  assert.match(route, /import \{ buildReturnAdvices \} from '@\/lib\/returnBranchAdvice';/);
  assert.match(route, /import \{ diagnoseUnrentedBarcode \} from '@\/lib\/barcodeFlow';/);
  assert.match(route, /branchAdvices = await buildReturnAdvices\(/);
  assert.match(read('components/orders/returnScanClient.js'), /fetch\('\/api\/returns\/scan'/);
  assert.match(read('app/components/branches/returnAlert.js'), /\/api\/returns\/scan/);
  assert.match(WIN, /document\.querySelector\('\[data-br-alert\]'\)/);
});

t('ההגדרה quick_search_barcode_opens_rental רשומה: שם + הסבר + בוליאני + קבוצת "ברקודים"', () => {
  const m = read('lib/settingsMetadata.js');
  assert.equal((m.match(/\n  quick_search_barcode_opens_rental: '/g) || []).length, 2, 'שם + הסבר');
  assert.match(m, /'ברקודים': \[[^\]]*'quick_search_barcode_opens_rental'[^\]]*\]/);
  assert.match(m, /'quick_search_barcode_opens_rental',\s*\n\s*'shared_delivery_enabled'/);
});

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
