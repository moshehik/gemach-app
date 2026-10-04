// "אורקל" של לשונית הפרטים הישנה (W2a): מחלץ מתוך components/orders/modern/ModernGeneralDetails.js (הקוד החי, לא העתק ידני) את
// המטפלים שמייצרים שדות ב-PUT - changeDates/setExtraDay/applyCustomSpacing, לחצני סוג האירוע, onChange של טווח התאריכים, בחירת/יצירת
// לקוח, ציר הציפוף ורשימת ערי המשלוח - ומריץ אותם על state נתון. כל עדכון של הישן (onOrderChange(prev => …)) נאסף ומוחל על ההזמנה,
// כך שהתוצאה = ההזמנה שהישן היה שולח ב-PUT. אם מישהו ישנה את הישן, הבדיקות יראו את השינוי.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { objectLiteralAt } from './legacy.mjs';

export const MGD_PATH = path.join(process.env.PROJ, 'components/orders/modern/ModernGeneralDetails.js');
export const MGD_SRC = fs.readFileSync(MGD_PATH, 'utf8');
const HD = await import(pathToFileURL(path.join(process.env.PROJ, 'lib/hebrewDate.js')).href);
const DV = await import(pathToFileURL(path.join(process.env.PROJ, 'lib/deliveryValidation.js')).href);

const between = (a, b) => {
  const i = MGD_SRC.indexOf(a);
  const j = MGD_SRC.indexOf(b, i + 1);
  if (i < 0 || j < 0) throw new Error(`MGD section not found: ${a} .. ${b}`);
  return MGD_SRC.slice(i, j);
};
// eslint-disable-next-line no-new-func
const fn = (params, body) => new Function(...params, body);

// --- changeDates / setExtraDay (MGD:51-83) ---
const DATES_SRC = between('const handleChange = (updates) =>', 'const applyCustomSpacing');
const datesFactory = fn(['order', 'onOrderChange', 'getHebrewDateString'], `${DATES_SRC}\nreturn { handleChange, changeDates, setExtraDay, shiftDateStr };`);
// --- applyCustomSpacing (MGD:85-98) ---
const SPACING_SRC = between('const applyCustomSpacing = async', '// עריכת תאריך ההזמנה');
const spacingFactory = fn(['order', 'systemDefaultSpacing', 'verifyPin', 'changeDates'], `${SPACING_SRC}\nreturn applyCustomSpacing;`);
// --- selectCustomer / handleSaveNewCustomer (MGD:132-159) ---
const CUST_SRC = between('const selectCustomer = (c) =>', 'const customer = order.customer;');
const custFactory = fn(['handleChange', 'setShowCustomerModal', 'newCustomer', 'setNewCustomer', 'fetch', 'alert'], `${CUST_SRC}\nreturn { selectCustomer, handleSaveNewCustomer };`);
// --- לחצני סוג האירוע (MGD:330-345): הליטרלים של changeDates ---
const toRegularLiteral = objectLiteralAt(MGD_SRC, MGD_SRC.indexOf('changeDates({ isAbroad: false'));
const toAbroadLiteral = objectLiteralAt(MGD_SRC, MGD_SRC.indexOf('changeDates({ isAbroad: true'));
// --- onChange של HebrewDateRangePicker (MGD:366-379): מיכל ה-JSX {(start, end) => {...}} ---
const rangeContainer = objectLiteralAt(MGD_SRC, MGD_SRC.indexOf('onChange={(start, end) =>'));
const RANGE_ARROW = rangeContainer.slice(1, -1).trim();
const rangeFactory = fn(['order', 'changeDates'], `return (${RANGE_ARROW});`);
// --- ציר הציפוף (MGD:221-224) ---
const AXIS_SRC = between('const hasCustomSpacing = ', 'const spacingCardNode');
const axisFactory = fn(['order', 'hideCustomSpacing', 'systemDefaultSpacing'], `${AXIS_SRC}\nreturn { hasCustomSpacing, selectedSpacing, axisDays };`);
// --- ערי משלוח + חובה (MGD:217-220, :474) ---
const DEL_SRC = between('const deliveryPriceCities = ', 'const hasCustomSpacing = ');
const OPTIONS_EXPR = (() => { const i = MGD_SRC.indexOf('[...new Set([...(order.deliveryCity'); return MGD_SRC.slice(i, MGD_SRC.indexOf('].map(c =>', i) + 1); })();
const delFactory = fn(['order', 'customer', 'deliverySettings', 'fallbackCities', 'isDeliveryAddressRequired', 'isDeliveryCityRequired'],
  `${DEL_SRC}\nreturn { deliveryCityOptions, deliveryCityRequired, deliveryAddressRequired, selectOptions: ${OPTIONS_EXPR}, showAddress: (deliverySettings.allowAddressOverride || deliveryAddressRequired) };`);
// --- טקסטים שהישן מציג (הודעות חובה, alert של לקוח חדש) ---
export const MGD_TEXT = {
  cityMsg: (MGD_SRC.match(/עיר המגורים של הלקוח אינה ברשימת ערי המשלוח - יש לבחור עיר משלוח\./) || [])[0],
  addressMsg: (MGD_SRC.match(/עיר המשלוח שונה מעיר הלקוח - יש להזין כתובת למשלוח\./) || [])[0],
  newCustomerAlert: (MGD_SRC.match(/alert\('(יש למלא שם פרטי[^']*)'\)/) || [])[1],
};

// מריץ פעולה של הישן ומחזיר את ההזמנה אחרי כל העדכונים (onOrderChange מקבל פונקציה או אובייקט)
export function runLegacy(order, action) {
  let cur = order;
  const onOrderChange = (val) => { cur = typeof val === 'function' ? val(cur) : val; };
  const api = datesFactory(order, onOrderChange, HD.getHebrewDateString);
  action({ ...api, order, onOrderChange });
  return cur;
}
export const legacyPickEventDate = (order, key) => runLegacy(order, ({ changeDates }) => changeDates({ eventDate: key }));
export const legacySetExtraDay = (order, v) => runLegacy(order, ({ setExtraDay }) => setExtraDay(v));
export const legacyShiftDateStr = (s, d) => datesFactory({}, () => {}, HD.getHebrewDateString).shiftDateStr(s, d);
// לחצני סוג האירוע: "if (!isAbroad) return;" / "if (isAbroad) return;" ואז changeDates(<ליטרל>)
export function legacyEventType(order, toAbroad) {
  const isAbroad = !!(order.isAbroad || order.isWeekdayEvent);
  return runLegacy(order, ({ changeDates }) => {
    if (toAbroad ? isAbroad : !isAbroad) return;
    // eslint-disable-next-line no-new-func
    changeDates(new Function(`return (${toAbroad ? toAbroadLiteral : toRegularLiteral});`)());
  });
}
export const legacyPickRange = (order, start, end) => runLegacy(order, ({ changeDates }) => rangeFactory(order, changeDates)(start, end));
// applyCustomSpacing: verifyPin(message, level) מוחזר כ-approve (null = בוטל). מחזיר {order, pinCalls}
export async function legacyApplySpacing(order, spacing, systemDefaultSpacing, approve = true) {
  const pinCalls = [];
  let cur = order;
  const onOrderChange = (val) => { cur = typeof val === 'function' ? val(cur) : val; };
  const { changeDates } = datesFactory(order, onOrderChange, HD.getHebrewDateString);
  const verifyPin = async (message, level) => { pinCalls.push({ message, level }); return approve ? { employeeId: 'e1', pin: 'x' } : null; };
  await spacingFactory(order, systemDefaultSpacing, verifyPin, changeDates)(spacing);
  return { order: cur, pinCalls };
}
export function legacySpacingAxis(order, systemDefaultSpacing, hideCustomSpacing = false) {
  return axisFactory(order, hideCustomSpacing, systemDefaultSpacing);
}
// selectCustomer / handleSaveNewCustomer עם fetch/alert מדומים
export async function legacyCustomer({ order, pick, newCustomer, fetchImpl }) {
  let cur = order;
  const alerts = [];
  const calls = [];
  const handleChange = (updates) => { cur = { ...cur, ...updates }; };
  const f = async (url, opts) => { calls.push({ url, method: opts && opts.method, body: opts && opts.body }); return fetchImpl(url, opts); };
  const api = custFactory(handleChange, () => {}, newCustomer || {}, () => {}, f, (m) => alerts.push(m));
  if (pick !== undefined) api.selectCustomer(pick);
  if (newCustomer) await api.handleSaveNewCustomer();
  return { order: cur, alerts, calls };
}
export function legacyDelivery(order, deliverySettings, fallbackCities = []) {
  return delFactory(order, order.customer, deliverySettings, fallbackCities, DV.isDeliveryAddressRequired, DV.isDeliveryCityRequired);
}
// אתחול מצב העריכה של כרטיס האירוע (MGD:22)
export const LEGACY_EDITING_INIT = (MGD_SRC.match(/const \[isEditingEvent, setIsEditingEvent\] = useState\(([^;]+)\);/) || [])[1];
