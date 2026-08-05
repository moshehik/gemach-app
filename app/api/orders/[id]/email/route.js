import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getHebrewDateString } from '../../../../../lib/hebrewDate';

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    const body = await request.json();
    const { email, type } = body; // type can be 'order' or 'rental'
    const printType = type || 'order';

    if (!email) {
      return NextResponse.json({ error: 'כתובת מייל חסרה' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId: id },
      include: {
        customer: true,
        items: {
          include: {
            dressItem: {
              include: { dress: true }
            }
          }
        },
        obligations: { where: { isDeleted: false } },
        payments: { where: { isDeleted: false } }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    const settingsData = await prisma.systemSetting.findMany();
    const enableAlterations = settingsData.find(s => s.key === 'enable_alterations')?.value !== 'false';
    const printSettings = {
      box1: settingsData.find(s => s.key === 'print_rental_box1')?.value || '',
      box2: settingsData.find(s => s.key === 'print_rental_box2')?.value || '',
      footer: settingsData.find(s => s.key === 'print_rental_footer')?.value || ''
    };

    const getOrderStatus = (order) => {
      if (order.status === 'בוטל' || order.status === 'ARCHIVED') return 'ארכיון/מבוטל';
      const hasUnreturned = order.items && order.items.some(i => i.isTaken && !i.isReturned && !i.isDeleted);
      const hasPending = order.items && order.items.some(i => !i.isTaken && !i.isDeleted);
      if (hasUnreturned) return 'פעיל (אצל לקוח)';
      if (hasPending) return 'ממתין (טרם נלקח)';
      return 'הוחזר (מלא)';
    };

    const getStatusStyle = (status) => {
      if (status.includes('ארכיון') || status.includes('מבוטל')) return 'background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db;';
      if (status.includes('פעיל')) return 'background: #cce5ff; color: #004085; border: 1px solid #b8daff;';
      if (status.includes('הוחזר')) return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
      return 'background: #fff3cd; color: #856404; border: 1px solid #ffeeba;';
    };

    const totalObligations = order.obligations.reduce((sum, o) => sum + o.amount, 0);
    const totalPayments = order.payments.reduce((sum, p) => sum + p.amount, 0);

    const colCount = enableAlterations ? 7 : 4;

    const itemsHtml = (!order.items || order.items.filter(i => !i.isDeleted).length === 0)
      ? `<tr><td colspan="${colCount}" style="text-align: center; padding: 30px; color: #999;">אין פריטים פעילים בהזמנה זו</td></tr>`
      : order.items.filter(i => !i.isDeleted).map(item => {
          let statusStr = 'טרם נלקח';
          if (item.isReturned) statusStr = 'הוחזר';
          else if (item.isTaken) statusStr = 'אצל הלקוח';

          let alts = enableAlterations ? `
            <td>${item.neckAlteration ? `הצרה ${item.neckAlteration}` : '-'}</td>
            <td>${item.sleeveAlteration ? `הארכה ${item.sleeveAlteration}` : '-'}</td>
            <td>${item.lengthAlteration || '-'}</td>
          ` : '';

          // Same field precedence as app/print/order/page.js, so the emailed report never
          // shows less than what the in-app print view shows for the same order.
          const modelName = item.description || item.dressItem?.dress?.name || item.dressItem?.dressName || '-';
          const sizeText = item.sizeText || item.dressItem?.sizeText || '-';
          const barcode = item.barcode || item.dressItem?.dressBarcode || ((item.barcodePrefix && item.sizeText) ? `${item.barcodePrefix}${item.sizeText}` : '-');

          return `
            <tr>
              <td style="font-weight: 600; color: #333;">${modelName}</td>
              <td>${sizeText}</td>
              <td style="font-weight: 600; color: #666;">${barcode}</td>
              ${alts}
              <td>${statusStr}</td>
            </tr>
          `;
        }).join('');

    // Payment notes formatting - mirrors app/print/order/page.js's formatPaymentNotes so the
    // emailed report shows the same human-readable credit-approval text instead of raw JSON.
    const formatPaymentNotes = (rawNotes) => {
      let notes = rawNotes || '-';
      try {
        if (typeof notes === 'string' && notes.trim().startsWith('{')) {
          const parsed = JSON.parse(notes);
          const approval = parsed.Confirmation || parsed.TransactionId || parsed['אישור'];
          notes = approval ? `אישור: ${approval}` : 'סליקת אשראי';
          let extraInfo = '';
          if (parsed.Tashloumim || parsed['תשלומים']) {
            extraInfo = ` | תשלומים: ${parsed.Tashloumim || parsed['תשלומים']}`;
          }
          if (parsed['הערות משתמש']) {
            extraInfo += ` | ${parsed['הערות משתמש']}`;
          }
          notes += extraInfo;
        } else if (typeof notes === 'string') {
          const match = notes.match(/אישור:\s*([a-zA-Z0-9]+)/);
          const tashMatch = notes.match(/"Tashloumim"\s*:\s*"(\d+)"/);
          let approvalStr = notes;
          if (match && match[1]) {
            approvalStr = `אישור: ${match[1]}`;
            if (tashMatch && tashMatch[1]) {
              approvalStr += ` | תשלומים: ${tashMatch[1]}`;
            }
          } else if (notes.length > 50) {
            approvalStr = notes.substring(0, 50) + '...';
          }
          notes = approvalStr;
        }
      } catch (e) {
        // keep raw notes on parse failure
      }
      return notes;
    };

    const paymentsHtml = order.payments.filter(p => !p.isDeleted).length === 0 ? '' : `
      <div style="margin-bottom: 30px;">
        <h4 class="payments-title">תשלומים שהתקבלו</h4>
        <table class="print-table" style="margin-bottom: 30px;">
          <thead>
            <tr>
              <th>תאריך (עברי)</th>
              <th>אופן תשלום</th>
              <th>סכום</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>
            ${order.payments.filter(p => !p.isDeleted).map(p => {
              const hebrewPaymentDate = p.paymentDate ? getHebrewDateString(p.paymentDate) : getHebrewDateString(new Date());
              return `
                <tr>
                  <td>${hebrewPaymentDate}</td>
                  <td>${p.paymentMethod || '-'}</td>
                  <td style="font-weight: bold;">₪${p.amount}</td>
                  <td>${formatPaymentNotes(p.notes)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Visual design mirrors app/print/order/page.js exactly (same "style_19" mockup the owner
    // picked) so the emailed report and the in-app printed report look identical. Colors are
    // hardcoded (no CSS custom properties) since this HTML is rendered outside the app's CSS
    // context - by the Apps Script PDF converter and, when previewed, by an off-screen div - see
    // app/print/alterations/page.js for the same convention.
    const htmlBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700;900&display=swap');

          body { font-family: 'David Libre', 'Times New Roman', Georgia, serif; background-color: #fff; margin: 0; padding: 10px; direction: rtl; color: #444; }
          .invoice-box { width: 100%; max-width: 800px; margin: 0 auto; background: #fff; padding: 20px; box-sizing: border-box; }

          .bsd { text-align: right; font-size: 13px; font-weight: 600; color: #999; margin-bottom: 6px; letter-spacing: 0.5px; }
          .print-header { text-align: center; border-bottom: 1px solid #eaeaea; padding-bottom: 22px; margin-bottom: 32px; }
          .print-header h1 { margin: 0 0 8px 0; font-family: 'Frank Ruhl Libre', 'David Libre', serif; font-size: 30px; color: #262626; font-weight: 700; letter-spacing: 0.5px; }
          .company-details { color: #999; font-size: 13px; margin-top: 8px; }

          .order-details-table { width: 100%; margin-bottom: 32px; border-collapse: collapse; }
          .order-details-table td { padding: 0 0 0 24px; vertical-align: top; font-size: 15px; color: #555; line-height: 1.75; }
          .order-details-table td strong { color: #262626; }
          .order-details-table td.order-cell { border-right: 1px solid #eaeaea; padding: 0 24px 0 0; }

          .print-table { width: 100%; border-collapse: collapse; margin-bottom: 36px; border: 1px solid #e5e5e5; }
          .print-table th, .print-table td { padding: 13px 14px; text-align: right; border-bottom: 1px solid #eee; font-size: 13.5px; }
          .print-table th { background-color: #f4f4f4; color: #333; font-weight: 600; letter-spacing: 0.3px; }
          .print-table tbody tr:nth-child(even) { background-color: #fbfbfb; }
          .print-table tbody tr:last-child td { border-bottom: none; }

          .summary-table { width: 320px; border-collapse: collapse; }
          .summary-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #f5f5f5; color: #666; font-size: 14.5px; }
          .summary-table td:first-child { text-align: right; color: #888; }
          .summary-table .total { background-color: #f4f4f4; }
          .summary-table .total td { font-size: 18px; font-weight: 700; color: #222; border-bottom: none; border-top: 2px solid #e5e5e5; }

          .payments-title { color: #555; font-size: 15px; font-weight: 700; margin: 0 0 10px 0; }

          .terms { font-size: 13.5px; color: #777; margin-bottom: 40px; text-align: justify; line-height: 1.7; border-top: 1px solid #eee; padding-top: 18px; }
          .terms strong { color: #555; }
          .signatures { display: flex; justify-content: space-around; font-size: 14.5px; color: #666; margin-top: 20px; }
          .signatures div { text-align: center; width: 220px; border-top: 1px solid #ccc; padding-top: 10px; }

          .rental-notes-box { border: 1px solid #e5e5e5; padding: 15px; margin-bottom: 15px; text-align: center; font-size: 14.5px; color: #555; }
          .rental-notes-box-bg { background-color: #fbfbfb; }

          .print-footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }

          .print-table tr, .summary-table, .terms, .signatures, .rental-notes-box {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="bsd">בס"ד</div>
          <div class="print-header">
            <h1>גמ"ח שמלות</h1>
            <div class="company-details">רחוב ירושלים 15, בני ברק | טלפון: 03-1234567 | דוא"ל: info@gemach.co.il</div>
          </div>

          <table class="order-details-table">
            <tr>
              <td width="50%">
                <strong>לכבוד: ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}</strong><br />
                טלפון: <span dir="ltr">${order.customer?.phone1 || order.customer?.phone || '-'}</span><br />
                כתובת: ${order.customer?.city ? `${order.customer.city}${order.customer?.address ? `, ${order.customer.address}` : ''}` : '-'}
              </td>
              <td width="50%" class="order-cell">
                <strong>${printType === 'rental' ? 'דוח השכרה' : 'הזמנה'} #${order.orderId}</strong><br />
                תאריך הזמנה: ${order.createdAt ? getHebrewDateString(order.createdAt) : '-'}<br />
                ${(!order.isWeekdayEvent && !order.isAbroad) ? `תאריך אירוע: ${order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין')}` : 'סוג אירוע: אירוע חו"ל'}
                ${printType === 'order' && order.notes ? `<br />הערות: ${order.notes}` : ''}
              </td>
            </tr>
          </table>

          ${printType === 'rental' && printSettings.box1 ? `<div class="rental-notes-box">${printSettings.box1}</div>` : ''}
          ${printType === 'rental' && printSettings.box2 ? `<div class="rental-notes-box rental-notes-box-bg">${printSettings.box2}</div>` : ''}
          ${printType === 'rental' && printSettings.footer ? `
            <div style="text-align: center; margin-top: 15px; margin-bottom: 25px;">
              <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: #262626;">${printSettings.footer}</h3>
              <div style="font-size: 15px; font-weight: 600; display: flex; justify-content: center; align-items: center; color: #444;">
                <span>על החתום:</span>
                <span style="display: inline-block; width: 200px; border-bottom: 1px dashed #999; margin: 0 10px;"></span>
              </div>
              <div style="margin-top: 8px; font-size: 13px; font-weight: 500; color: #888;">
                נא להחזיר טופס זה חתום בעת החזרת השמלות
              </div>
            </div>
          ` : ''}

          <table class="print-table">
            <thead>
              <tr>
                <th>דגם / תיאור</th>
                <th>מידה</th>
                <th>ברקוד</th>
                ${enableAlterations ? `
                <th>תיקון צואר</th>
                <th>תיקון שרוול</th>
                <th>תיקון אורך</th>
                ` : ''}
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table width="100%" style="margin-bottom: 30px; border-collapse: collapse;">
            <tr>
              <td width="60%"></td>
              <td width="40%">
                <table class="summary-table">
                  <tr>
                    <td>סה"כ לחיוב:</td>
                    <td>₪${totalObligations}</td>
                  </tr>
                  <tr>
                    <td>סה"כ שולם:</td>
                    <td>₪${totalPayments}</td>
                  </tr>
                  <tr class="total">
                    <td>יתרה לתשלום:</td>
                    <td>₪${Math.max(0, totalObligations - totalPayments)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          ${paymentsHtml}

          ${printType === 'rental' ? `
            <div class="terms">
              <strong>תנאים:</strong> הבגדים נמסרים נקיים ומגוהצים ויש להחזירם באותו מצב. אין לבצע כביסה עצמאית בשום אופן. איחור בהחזרת הפריטים יגרור קנס לכל יום איחור כפי שנקבע בתקנון. במקרה של נזק בלתי הפיך, הלקוח יישא במלוא עלות התיקון או רכישה מחדש של הפריט.
            </div>
          ` : `
            <div class="terms">
              <strong>תנאים:</strong> הבגדים נמסרים נקיים ומגוהצים ויש להחזירם באותו מצב בדיוק. אין לכבס בשום אופן באופן עצמאי. במקרה של קרע או נזק בלתי הפיך, הלקוח יישא בעלות התיקון או רכישה מחדש לפי שיקול דעת הגמ"ח.
            </div>
          `}

          ${printType === 'order' ? `
          <div class="signatures">
            <div>חתימת הלקוח</div>
            <div>אישור הגמ"ח</div>
          </div>
          ` : ''}

          <div class="print-footer">
            הופק על ידי מערכת גמ"ח שמלות בתאריך: ${getHebrewDateString(new Date())}
          </div>
        </div>
      </body>
      </html>
    `;

    if (body.returnHtmlOnly) {
      return NextResponse.json({ success: true, html: htmlBody });
    }

    const { pdfBase64 } = body;

    // Use the generic email script OR our new PDF generator action
    const googlePayload = {
      action: "sendGemachOrderEmail", 
      to: email,
      cc: '',
      subject: `הזמנה #${order.orderId} - גמ"ח שמלות`,
      htmlBody: htmlBody,
      bodyText: `מצורף כרטיס הזמנה/השכרה עבור אירוע בתאריך ${order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : '')}.`,
      fileName: `order_${order.orderId}.pdf`,
      
      // Keep old parameters for backwards compatibility just in case the old script is used
      body: pdfBase64 ? 'מצורף כרטיס הזמנה/השכרה.' : htmlBody,
      fileContent: pdfBase64 || ''
    };

    // Determine Script URL
    const linkA = settingsData.find(s => s.key === 'email_link_a')?.value;
    const linkB = settingsData.find(s => s.key === 'email_link_b')?.value;
    const strategy = settingsData.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';

    let scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
    
    if (strategy === 'all_b' && linkB) {
      scriptUrl = linkB;
    } else if (linkA) {
      scriptUrl = linkA;
    }
    
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(googlePayload)
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { status: 'error', message: responseText };
    }

    const isSuccess = result.status === 'success';

    await prisma.emailLog.create({
      data: {
        to: email,
        cc: null,
        subject: `הזמנה #${order.orderId} - גמ"ח שמלות`,
        body: 'HTML body sent to App Script for PDF conversion',
        fileName: `order_${order.orderId}.pdf`,
        status: isSuccess ? 'success' : 'error',
        errorMessage: isSuccess ? null : (result.message || 'Unknown error'),
        customerId: order.customerId,
        sentAt: new Date()
      }
    });

    if (isSuccess) {
      // eslint-disable-next-line no-restricted-syntax -- הכתיבה שקדמה היא ל-EmailLog; זו שורת ההיסטוריה של ההזמנה עצמה
      await prisma.auditLog.create({
        data: {
          entityType: 'Order',
          entityId: String(order.orderId),
          action: 'EMAIL_SENT',
          changesJson: JSON.stringify({
            subject: `הזמנה #${order.orderId} - גמ"ח שמלות`,
            to: email,
            type: printType
          }),
          createdAt: new Date()
        }
      });
    }

    if (!isSuccess) {
      return NextResponse.json({ error: 'השליחה נכשלה: ' + (result.message || 'Unknown error') }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to send order email:', error);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
}
