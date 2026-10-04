// slots.js — רישום החלקים שהמעטפת (W1) מארחת אבל זרמים אחרים מממשים. כל זרם מחליף שורה אחת בלבד (ייבוא + השורה שלו),
// בלי לגעת בקבצים אחרים של W1. כל רכיב מקבל {oc, ui} (חלקי דף) או {...props, close} (חלונות, נפתחים ב-ui.openDialog).
// החוזה המלא: scratch/order-card-build/W1-NOTES.md.
import * as D from './OcDefaultParts';

export const SLOTS = {
  Rail: D.DefaultRail, //                     W5 → parts/OcRail.js            (<aside class="rail">)
  DraftBanner: D.DefaultDraftBanner, //       W5 → parts/OcDraftBanner.js     (R11, מעל הלשוניות)
  MoneyToast: D.NoPart, //                    W5 → parts/OcMoneyToast.js      (A23, מאזין ל-oc.totals.pendingNet)
  ScanBar: D.NoPart, //                       W3 → parts/OcScanBar.js         (R42, בתוך .topbar; רצף ברקודים של W2b מחליף אותו בתוכו)
  Exports: D.PlaceholderExports, //           W7 → parts/OcExports.js         (A1/A2: xlbtn.xlg + xlbtn.xld בתוך .tools)
  PrintMenu: D.PlaceholderPrintMenu, //       W7 → parts/OcPrintMenu.js       (R6/A3/A4/R7: xlbtn.xlp + .menu בתוך .tools)
  TopBanners: D.NoPart, //                    W2b → parts/OcDressLocationBanner.js (מעל הלשוניות)
  ConflictDialog: D.DefaultConflictDialog, // W5 → dialogs/OcConflictDialog.js (R12) close('overwrite'|'reload'|null)
  StockDialog: D.DefaultStockDialog, //       W5 → dialogs/OcStockDialog.js    (R48) close(any)
  SummaryDialog: D.DefaultSummaryDialog, //   W5 → dialogs/OcSummaryDialog.js  (D1/R14) close(true|false)
  ExitDialog: D.DefaultExitDialog, //         W5 → dialogs/OcDiscardDialog.js (export OcExitDialog, D2/AMB-01) close('save'|'discard'|null)
  DiscardDialog: D.DefaultDiscardDialog, //   W5 → dialogs/OcDiscardDialog.js  (D7) close(true|false)
};
