// lib/orderConfirmationMail.js - מייל "אישור יצירת הזמנה" (orderCreatedAuto): הלוגיקה שהייתה inline ב-app/api/orders/route.js (POST),
// הוצאה לכאן כדי ששני מסלולים ישתמשו בה: (1) מיד בסיום יצירת ההזמנה (ברירת המחדל, בדיוק כמו תמיד), (2) cron יומי כשבמרכז המיילים
// נבחר "אחרי X ימים מיצירת ההזמנה" (app/api/cron/daily/route.js). התוכן זהה בשני המסלולים.
//
// order = תוצאת prisma.order.findUnique עם include { customer, obligations, payments } (ופריטים נשלפים כאן בשאילתה נפרדת, כמו קודם).
// מחזיר { sent:false, reason } כשאין למי לשלוח; אחרת התוצאה של sendSystemEmail (מחכה לה כש-wait=true, אחרת "ירה ושכח").
//
// delivery (רשות) = התוצאה של buildDeliverySection (lib/orderDelivery.js; בשרת: loadDeliverySection ב-lib/orderDeliveryServer.js), או null להזמנה
// שאינה משלוח: כתובת/מועדים/עלות, שורות פריט (delivery_as_item_row), פירוט בסיכום התשלום, "שימו לב", וכללי הביקור בגמ"ח (החלטה 27:
// הלוך-חזור = בלי קבלה/החזרה/כתובת איסוף). שני אתרי הקריאה (POST /api/orders ו-cron/daily) מעבירים אותו. הניסוח של הכיתובים ניתן לעריכה ב-/admin/email-center.
// כתובת האיסוף: gmach_pickup_address אם הוגדרה, אחרת gmach_address (lib/gmachContact.js), וקישור "פתיחה במפות Google" כשהוגדרה כתובת איסוף ייעודית.

import prisma from '@/app/lib/prisma';
import { orderItemModelName } from '@/lib/modelDisplay';
import { getModelDisplayOpts } from '@/lib/modelDisplayServer';
import { getCachedSetting } from '@/lib/settingsCache';
import { getHebrewDateString, getHebrewWeekdayLabel } from '@/lib/hebrewDate';
import { subtractBusinessDays, israelLocalDate } from '@/lib/businessDays';
import { getNonWorkingDaysConfig } from '@/lib/businessDaysServer';
import { getExpectedReturnDate } from '@/lib/lateReturn';
import { sendSystemEmail } from '@/lib/mailer';
import { renderOrderConfirmationEmailHtml } from '@/lib/emailTemplates';
import { emailSubject } from '@/lib/emailCatalog';
import { cfgPlain } from '@/lib/emailConfig';
import { pickupAddressFrom, pickupMapsUrlFrom } from '@/lib/gmachContact';
import { deliveryItemRowsText, visibleVisitLines } from '@/lib/orderDelivery';

export async function sendOrderConfirmationEmail(updatedOrder, { emailCfg, wait = false, delivery = null } = {}) {
  const email = updatedOrder?.customer?.email && String(updatedOrder.customer.email).includes('@')
    ? String(updatedOrder.customer.email)
    : null;
  if (!email) return { sent: false, reason: 'no-email' };

  const hebrewDate = updatedOrder.eventDateHebrew || (updatedOrder.eventDate ? getHebrewDateString(israelLocalDate(updatedOrder.eventDate) ?? updatedOrder.eventDate) : '');
  const gmachName = emailCfg.fixed.gmachName || (await getCachedSetting('gmach_name'))?.value || 'גמ"ח שמלות';
  // כתובת האיסוף ללקוח: gmach_pickup_address אם הוגדרה, אחרת gmach_address (lib/gmachContact.js) - רק מה-DB של הארגון הנוכחי
  const [pickupAddrRow, gmachAddrRow, pickupMapsRow] = await Promise.all([getCachedSetting('gmach_pickup_address'), getCachedSetting('gmach_address'), getCachedSetting('gmach_pickup_maps_url')]);
  const settingRows = { gmach_pickup_address: pickupAddrRow, gmach_address: gmachAddrRow, gmach_pickup_maps_url: pickupMapsRow };
  const gmachAddress = emailCfg.fixed.gmachAddress || pickupAddressFrom((k) => settingRows[k]?.value);
  const pickupMapsUrl = pickupMapsUrlFrom((k) => settingRows[k]?.value); // '' = אין קישור (אופט-אין)
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
  // החלטה 27: בהזמנת משלוח - רק שורות הקבלה/ההחזרה/כתובת האיסוף שהלקוחה צריכה (lib/orderDelivery.js customerVisitsFor)
  const vis = visibleVisitLines({ pickupLine, returnLine, address: gmachAddress, mapsUrl: pickupMapsUrl }, delivery);

  // דגם ומידה אמיתיים לכל פריט (לא רק description/sizeText הגולמיים שנשמרו
  // בזמן ההזמנה) - שאילתה נפרדת עם dressItem->dress.
  const itemsWithDress = await prisma.orderItem.findMany({
    where: { orderId: updatedOrder.orderId, isDeleted: false },
    include: { dressItem: { include: { dress: true } } }
  });
  const mailModelOpts = await getModelDisplayOpts(); // שם אמיתי, אחרת מספר הדגם - לעולם לא "ללא שם - N" (lib/modelDisplay.js)
  const itemsList = itemsWithDress.map(i => {
    const modelName = orderItemModelName(i, mailModelOpts) || i.description || 'פריט';
    const sizeText = i.sizeText || i.dressItem?.sizeText;
    return sizeText ? `${modelName} (מידה: ${sizeText})` : modelName;
  }).join(', ') || 'ללא פירוט';

  const totalObligations = (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
  const totalPayments = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, totalObligations - totalPayments);

  const body = `שלום ${updatedOrder.customer.firstName || ''} ${updatedOrder.customer.lastName || ''},\nהזמנתך #${updatedOrder.orderId} נקלטה בהצלחה ב${gmachName}.\nתאריך אירוע: ${hebrewDate}\n${vis.pickupLine ? `קבלת השמלות: ${vis.pickupLine}\n` : ''}${vis.returnLine ? `החזרת השמלות: ${vis.returnLine}\n` : ''}פריטים: ${itemsList}${delivery && delivery.itemRows.length ? `, ${deliveryItemRowsText(delivery)}` : ''}\n${delivery ? `${delivery.textLines.join('\n')}\n${delivery.notice ? `${delivery.notice.plain.join('\n')}\n` : ''}` : ''}סה"כ לחיוב: ₪${totalObligations}\n${delivery ? delivery.summaryRows.map(r => `מתוכם ${r.label}: ₪${r.amount}\n`).join('') : ''}סה"כ שולם: ₪${totalPayments}\nיתרה לתשלום: ₪${balance}\n${updatedOrder.hasSignedRegulations ? 'חתם/ה על תקנון ההשכרה ✓\n' : ''}${vis.address ? `כתובת איסוף: ${vis.address}\n` : ''}${vis.mapsUrl ? `פתיחה במפות Google: ${vis.mapsUrl}\n` : ''}טלפון: ${gmachPhone}\n\nנשמח לראותך!`;
  const html = renderOrderConfirmationEmailHtml({
    customerName: `${updatedOrder.customer.firstName || ''} ${updatedOrder.customer.lastName || ''}`.trim(),
    orderId: updatedOrder.orderId, eventDate: hebrewDate, pickupLine, returnLine,
    items: itemsWithDress.map(i => ({ name: orderItemModelName(i, mailModelOpts) || i.description || 'פריט', size: i.sizeText || i.dressItem?.sizeText || '' })),
    totalCharge: totalObligations, totalPaid: totalPayments, balance, hasSignedRegulations: !!updatedOrder.hasSignedRegulations,
    gmachName, gmachAddress, gmachPhone, delivery, pickupMapsUrl, cfg: emailCfg,
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
