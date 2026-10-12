// lib/orderConfirmationMail.js - מייל "אישור יצירת הזמנה" (orderCreatedAuto): הלוגיקה שהייתה inline ב-app/api/orders/route.js (POST),
// הוצאה לכאן כדי ששני מסלולים ישתמשו בה: (1) מיד בסיום יצירת ההזמנה (ברירת המחדל, בדיוק כמו תמיד), (2) cron יומי כשבמרכז המיילים
// נבחר "אחרי X ימים מיצירת ההזמנה" (app/api/cron/daily/route.js). התוכן זהה בשני המסלולים.
//
// order = תוצאת prisma.order.findUnique עם include { customer, obligations, payments } (ופריטים נשלפים כאן בשאילתה נפרדת, כמו קודם).
// מחזיר { sent:false, reason } כשאין למי לשלוח; אחרת התוצאה של sendSystemEmail (מחכה לה כש-wait=true, אחרת "ירה ושכח").

import prisma from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { getHebrewDateString, getHebrewWeekdayLabel } from '@/lib/hebrewDate';
import { subtractBusinessDays, israelLocalDate } from '@/lib/businessDays';
import { getNonWorkingDaysConfig } from '@/lib/businessDaysServer';
import { getExpectedReturnDate } from '@/lib/lateReturn';
import { sendSystemEmail } from '@/lib/mailer';
import { renderOrderConfirmationEmailHtml } from '@/lib/emailTemplates';
import { emailSubject } from '@/lib/emailCatalog';
import { cfgPlain } from '@/lib/emailConfig';

// delivery (רשות): { outbound, return, outHours, returnHours } - בלוק המשלוח באישור ההזמנה. הלוגיקה שמחשבת אותו (buildDeliverySection של הסוכן "order-docs-delivery")
// אינה כאן; כשהיא תתמזג: `sendOrderConfirmationEmail(order, { emailCfg, delivery: buildDeliverySection(order) })` בשני אתרי הקריאה (orders/route.js ו-cron/daily).
// בלי delivery - האישור בדיוק כמו תמיד. הניסוח של הבלוק ניתן לעריכה ב-/admin/email-center (שורות deliveryNotice / lblDeliveryOut / lblDeliveryBack).
export async function sendOrderConfirmationEmail(updatedOrder, { emailCfg, wait = false, delivery = null } = {}) {
  const email = updatedOrder?.customer?.email && String(updatedOrder.customer.email).includes('@')
    ? String(updatedOrder.customer.email)
    : null;
  if (!email) return { sent: false, reason: 'no-email' };

  const hebrewDate = updatedOrder.eventDateHebrew || (updatedOrder.eventDate ? getHebrewDateString(israelLocalDate(updatedOrder.eventDate) ?? updatedOrder.eventDate) : '');
  const gmachName = emailCfg.fixed.gmachName || (await getCachedSetting('gmach_name'))?.value || 'גמ"ח שמלות';
  const gmachAddress = emailCfg.fixed.gmachAddress || (await getCachedSetting('gmach_address'))?.value || '';
  const gmachPhone = emailCfg.fixed.gmachPhone || (await getCachedSetting('gmach_phone'))?.value || '';
  const pickupHours = (await getCachedSetting('standard_pickup_hours'))?.value || '20:00-21:30';
  const returnHour = (await getCachedSetting('standard_return_hour'))?.value || '13:00';

  // מועד לקיחה/החזרה - אותו חישוב בדיוק כמו app/api/orders/[id]/email/route.js
  // ו-app/print/order/page.js: לקיחה = יומיים-עסקים לפני האירוע (מדלג שישי/שבת/חג),
  // החזרה = toDate/returnDate או יום העבודה הראשון אחרי האירוע. הלקיחה והחזרה לפי הכלל האחיד
  // "יום לא עובד" (שישי/שבת/חג/חול המועד/ערב חג/ימים שהבעלים סימן - lib/businessDays.js).
  const nonWorkingDays = await getNonWorkingDaysConfig();
  const pickupDate = updatedOrder.eventDate ? subtractBusinessDays(updatedOrder.eventDate, 2, nonWorkingDays) : null;
  const returnByDate = getExpectedReturnDate(updatedOrder, nonWorkingDays);
  const pickupLine = pickupDate ? `ביום ${getHebrewWeekdayLabel(pickupDate)} ${getHebrewDateString(pickupDate)} בשעה ${pickupHours}` : '';
  const returnLine = returnByDate ? `${getHebrewWeekdayLabel(returnByDate)} ${getHebrewDateString(returnByDate)} עד השעה ${returnHour}` : '';

  // דגם ומידה אמיתיים לכל פריט (לא רק description/sizeText הגולמיים שנשמרו
  // בזמן ההזמנה) - שאילתה נפרדת עם dressItem->dress.
  const itemsWithDress = await prisma.orderItem.findMany({
    where: { orderId: updatedOrder.orderId, isDeleted: false },
    include: { dressItem: { include: { dress: true } } }
  });
  const itemsList = itemsWithDress.map(i => {
    const modelName = i.dressItem?.dress?.name || i.description || 'פריט';
    const sizeText = i.sizeText || i.dressItem?.sizeText;
    return sizeText ? `${modelName} (מידה: ${sizeText})` : modelName;
  }).join(', ') || 'ללא פירוט';

  const totalObligations = (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
  const totalPayments = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, totalObligations - totalPayments);

  const body = `שלום ${updatedOrder.customer.firstName || ''} ${updatedOrder.customer.lastName || ''},\nהזמנתך #${updatedOrder.orderId} נקלטה בהצלחה ב${gmachName}.\nתאריך אירוע: ${hebrewDate}\n${pickupLine ? `קבלת השמלות: ${pickupLine}\n` : ''}${returnLine ? `החזרת השמלות: ${returnLine}\n` : ''}פריטים: ${itemsList}\nסה"כ לחיוב: ₪${totalObligations}\nסה"כ שולם: ₪${totalPayments}\nיתרה לתשלום: ₪${balance}\nכתובת איסוף: ${gmachAddress}\nטלפון: ${gmachPhone}\n\nנשמח לראותך!`;
  const html = renderOrderConfirmationEmailHtml({
    customerName: `${updatedOrder.customer.firstName || ''} ${updatedOrder.customer.lastName || ''}`.trim(),
    orderId: updatedOrder.orderId, eventDate: hebrewDate, pickupLine, returnLine,
    items: itemsWithDress.map(i => ({ name: i.dressItem?.dress?.name || i.description || 'פריט', size: i.sizeText || i.dressItem?.sizeText || '' })),
    totalCharge: totalObligations, totalPaid: totalPayments, balance, gmachName, gmachAddress, gmachPhone, cfg: emailCfg, delivery,
  });
  const sending = sendSystemEmail({
    to: email,
    subject: emailSubject('orderCreatedAuto', { orderId: updatedOrder.orderId, gmachName }, emailCfg),
    body: cfgPlain(emailCfg, body, html),
    html,
    customerId: updatedOrder.customerId,
  });
  if (wait) return sending;
  sending.catch(e => console.error('auto_email_on_order_create failed', e));
  return { sent: true, async: true };
}
