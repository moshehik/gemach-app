// tabs/index.js — רישום הלשוניות של כרטיס ההזמנה החדש. כל זרם מחליף שורה אחת (שלו) בייבוא של קובץ הלשונית שלו
// ובשורה ב-TABS, בלי לגעת בשום קובץ אחר של W1. כל לשונית היא רכיב React שמקבל {oc, ui, active}:
//   oc = useOrderCardController (ר' JSDoc שם / W1-NOTES.md), ui = useOcUi(), active = האם הלשונית מוצגת כרגע.
// כל הלשוניות מורכבות תמיד (כמו בכרטיס הישן) - כדי שמאזיני oc.on(...) שלהן יהיו פעילים גם כשהן מוסתרות.
// המטא-דאטה (שם, אייקון, נראות, סמנים A6) נשארת ב-OcTabs.js (W1).
import makeTabPlaceholder from './OcTabPlaceholder';
import OcDetailsTab from './OcDetailsTab'; //   W2a
import OcDeliveryTab from './OcDeliveryTab'; //  W2a

export const TABS = {
  details: OcDetailsTab, //                    W2a
  items: makeTabPlaceholder('items'), //       W3  → import OcItemsTab from './OcItemsTab';
  delivery: OcDeliveryTab, //                  W2a
  payments: makeTabPlaceholder('payments'), // W4  → import OcPaymentsTab from './OcPaymentsTab';
  history: makeTabPlaceholder('history'), //   W6  → import OcHistoryTab from './OcHistoryTab';
};
