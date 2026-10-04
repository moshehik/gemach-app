// slots.js — רישום החלקים שהמעטפת (W1) מארחת אבל זרמים אחרים מממשים. כל זרם מחליף שורה אחת בלבד (ייבוא + השורה שלו),
// בלי לגעת בקבצים אחרים של W1. כל רכיב מקבל {oc, ui} (חלקי דף) או {...props, close} (חלונות, נפתחים ב-ui.openDialog).
// החוזה המלא: scratch/order-card-build/W1-NOTES.md.
import * as D from './OcDefaultParts';
import OcRail from './parts/OcRail'; // W5
import OcDraftBanner from './parts/OcDraftBanner'; // W5
import OcMoneyToast from './parts/OcMoneyToast'; // W5
import OcConflictDialog from './dialogs/OcConflictDialog'; // W5
import OcStockDialog from './dialogs/OcStockDialog'; // W5
import OcSummaryDialog from './dialogs/OcSummaryDialog'; // W5
import OcDiscardDialog, { OcExitDialog } from './dialogs/OcDiscardDialog'; // W5

export const SLOTS = {
  Rail: OcRail, //                     W5 → parts/OcRail.js            (<aside class="rail">)
  DraftBanner: OcDraftBanner, //       W5 → parts/OcDraftBanner.js     (R11, מעל הלשוניות)
  MoneyToast: OcMoneyToast, //                    W5 → parts/OcMoneyToast.js      (A23, מאזין ל-oc.totals.pendingNet)
  ScanBar: D.NoPart, //                       W3 → parts/OcScanBar.js         (R42, בתוך .topbar; רצף ברקודים של W2b מחליף אותו בתוכו)
  Exports: D.PlaceholderExports, //           W7 → parts/OcExports.js         (A1/A2: xlbtn.xlg + xlbtn.xld בתוך .tools)
  PrintMenu: D.PlaceholderPrintMenu, //       W7 → parts/OcPrintMenu.js       (R6/A3/A4/R7: xlbtn.xlp + .menu בתוך .tools)
  TopBanners: D.NoPart, //                    W2b → parts/OcDressLocationBanner.js (מעל הלשוניות)
  ConflictDialog: OcConflictDialog, // W5 → dialogs/OcConflictDialog.js (R12) close('overwrite'|'reload'|null)
  StockDialog: OcStockDialog, //       W5 → dialogs/OcStockDialog.js    (R48) close(any)
  SummaryDialog: OcSummaryDialog, //   W5 → dialogs/OcSummaryDialog.js  (D1/R14) close(true|false)
  ExitDialog: OcExitDialog, //         W5 → dialogs/OcDiscardDialog.js (export OcExitDialog, D2/AMB-01) close('save'|'discard'|null)
  DiscardDialog: OcDiscardDialog, //   W5 → dialogs/OcDiscardDialog.js  (D7) close(true|false)
};
