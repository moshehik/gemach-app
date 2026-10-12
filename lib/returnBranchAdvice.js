// lib/returnBranchAdvice.js - התראות בסריקת החזרה (docs/branches-plan.md, שלב ד), צד שרת. נקרא מ-POST /api/returns/scan אחרי שההחזרה נרשמה.
// מחזיר רשימת "המלצות" שהלקוח מציג בחלון שנסגר ב-Enter (app/components/branches/BranchReturnAlertHost.js), וכותב לכל אחת הודעה
// להודעה כללית בפעמון (Notification): כל מי שיש לה הרשאת מלאי (page:dresses_catalog; הנהלה ראשית ומתכנת תמיד) + העובדת שסרקה - כך גם עובדות
// בסניף היעד וההנהלה רואות אותה ברשימת ההתראות ליד הפרופיל. אין היום שיוך עובד->סניף (החלטה B2 בלו"ז), לכן אין צמצום לפי סניף יעד; כשיתווסף שיוך -
// לצמצם ב-recipientsFor. בלי הצפה: לא נוצרת הודעה שכבר נוצרה בדיוק (אותה כותרת ותוכן = אותו פריט + אותה הזמנה) ב-24 השעות האחרונות.
//   kind 'branch'  - הפריט הוחזר בסניף אחד ולפי ההזמנות העתידיות צריך לעבור לסניף אחר (multi_branch_enabled + branch_return_alert_enabled).
//   kind 'reserve' - פריט רזרבה שיצא באישור (DressItem.locationBeforeRental='רזרבה', נכתב ב-rentals/confirm) וכעת חזר: "להחזיר לרזרבה"
//                    (reserve_return_alert_enabled; לא תלוי בסניפים).
// כל השאר כבוי כברירת מחדל = הפונקציה מחזירה null בלי שום שאילתה מעבר לקריאת ההגדרות מהמטמון.
// הסניף שבו נסרקה ההחזרה = העוגייה gm_my_branch (המחשב בחר "באיזה סניף אני"); בלי עוגייה - רק התראת הרזרבה (אין "מאיפה").
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { loadBranchContext } from '@/lib/branchesServer';
import { getReturnBranchAdvice } from '@/lib/branchNeedsServer';
import { MY_BRANCH_COOKIE, findBranchByName } from '@/lib/branches';
import { getEffectiveValueForEmployees } from '@/lib/permissions';
import { ITEM_TRANSFER_PERMISSION_KEY } from '@/lib/dressItemAccess';

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const RESERVE_LOCATION = 'רזרבה';

async function readMyBranch(ctx) {
  try {
    const store = await cookies();
    const raw = store.get(MY_BRANCH_COOKIE)?.value;
    if (!raw) return '';
    const name = decodeURIComponent(raw).trim();
    const b = findBranchByName(ctx.cfg, name);
    return b && b.active ? b.name : '';
  } catch {
    return '';
  }
}

/** מי מקבלת את ההודעה: עובדות פעילות עם הרשאת המלאי, + הסורקת. */
async function recipientsFor(actorId) {
  const employees = await prisma.employee.findMany({ where: { isActive: true }, select: { id: true, roleId: true } });
  const eff = await getEffectiveValueForEmployees(employees, ITEM_TRANSFER_PERMISSION_KEY);
  const ids = new Set(employees.filter((e) => eff.get(e.id)).map((e) => e.id));
  if (actorId) ids.add(actorId);
  return [...ids];
}

/**
 * @param {{ barcode: string, dressItemId?: string|null, actorId?: string|null }} p
 * @returns {Promise<Array<{ kind: 'branch'|'reserve', title: string, text: string, barcode: string, to?: string, orderId?: number, eventKey?: string }>|null>}
 */
export async function buildReturnAdvices({ barcode, dressItemId, actorId }) {
  const ctx = await loadBranchContext();
  const wantBranch = ctx.notice.returnAlert;
  const wantReserve = ctx.notice.reserveAlert;
  if (!wantBranch && !wantReserve) return null;
  const advices = [];
  let item = null;
  const select = { id: true, branch: true, locationBeforeRental: true, dress: { select: { name: true, barcodePrefix: true } } };
  if (dressItemId) item = await prisma.dressItem.findUnique({ where: { id: dressItemId }, select });
  // ברוב הפריטים בגמ"ח הראשי dressItemId ריק בפריט ההזמנה - מוצאים את היחידה לפי הברקוד
  else if (barcode) item = await prisma.dressItem.findFirst({ where: { dressBarcode: String(barcode), isDeleted: false }, select });
  const model = item && item.dress ? (item.dress.name || (item.dress.barcodePrefix ? `דגם ${item.dress.barcodePrefix}` : '')) : '';
  const label = `${barcode}${model ? ` (${model})` : ''}`;

  if (wantReserve && item && item.locationBeforeRental) {
    if (String(item.locationBeforeRental).includes(RESERVE_LOCATION)) {
      advices.push({ kind: 'reserve', barcode, title: 'להחזיר לרזרבה', text: `הפריט ${label} יצא מהרזרבה באישור וחזר עכשיו - יש להחזיר אותו לרזרבה.` });
    }
    // הסימון נוקה בכל מקרה - ההחזרה הושלמה (update רגיל: תוסף ה-audit רושם)
    await prisma.dressItem.update({ where: { id: item.id }, data: { locationBeforeRental: null } });
  }

  if (wantBranch && item) {
    const atBranch = await readMyBranch(ctx);
    if (atBranch) {
      // הפריט נמצא פיזית בסניף שבו נסרק
      if ((item.branch || '') !== atBranch) await prisma.dressItem.update({ where: { id: item.id }, data: { branch: atBranch } });
      const adv = await getReturnBranchAdvice({ barcode, atBranch });
      if (adv) {
        advices.push({
          kind: 'branch', barcode, to: adv.to, orderId: adv.orderId, eventKey: adv.eventKey,
          title: `להעביר לסניף ${adv.to}`,
          text: `הפריט ${label} הוחזר בסניף ${atBranch} ונדרש בסניף ${adv.to} (הזמנה ${adv.orderId}${adv.eventKey ? `, אירוע ${adv.eventKey.split('-').reverse().join('/')}` : ''}) - יש להעביר אותו.`,
        });
      }
    }
  }

  if (!advices.length) return null;
  try {
    const recipients = await recipientsFor(actorId);
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    for (const a of advices) {
      const dup = await prisma.notification.findFirst({ where: { title: a.title, content: a.text, createdAt: { gte: since } }, select: { id: true } });
      if (dup) continue;
      for (const receiverId of recipients) {
        try {
          await prisma.notification.create({ data: { receiverId, title: a.title, content: a.text } });
        } catch (e) {
          console.error('returnBranchAdvice: notification failed', receiverId, e);
        }
      }
    }
  } catch (e) {
    console.error('returnBranchAdvice: notifications failed', e);
  }
  return advices;
}
