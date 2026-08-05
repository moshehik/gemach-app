import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getHebrewDateString } from '../../../../../lib/hebrewDate';
import { calculateOrderStatus } from '../../../../../lib/orderStatus';

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

    // סטטוס ההשכרה מגיע כעת מ-lib/orderStatus.js (מקור האמת היחיד לסטטוס הזמנה) במקום
    // עותק מקומי עם אוצר מילים משלו - כדי שלא יהיה פער בין מה שנשלח כאן לבין שאר המערכת.
    const getOrderStatus = (order) => calculateOrderStatus(order);

    // ממפה את אוצר המילים המלא של lib/orderStatus.js (כולל מצבים חלקיים/עתידיים/טיוטה)
    // לארבעת סגנונות התגית הקיימים במייל.
    const getStatusStyle = (status) => {
      switch (status) {
        case 'מחוק':
          return 'background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db;';
        case 'הוחזר':
          return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
        case 'הושכר':
        case 'הושכר חלקי':
        case 'הוחזר חלקי':
          return 'background: #cce5ff; color: #004085; border: 1px solid #b8daff;';
        default:
          // 'בקרוב', 'עבר', 'טיוטה' - טרם נלקח בפועל
          return 'background: #fff3cd; color: #856404; border: 1px solid #ffeeba;';
      }
    };

    const totalObligations = order.obligations.reduce((sum, o) => sum + o.amount, 0);
    const totalPayments = order.payments.reduce((sum, p) => sum + p.amount, 0);

    const itemsHtml = (!order.items || order.items.filter(i => !i.isDeleted).length === 0) 
      ? `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #6c757d;">אין פריטים פעילים בהזמנה זו</td></tr>`
      : order.items.filter(i => !i.isDeleted).map(item => {
          let statusStr = 'טרם נלקח';
          if (item.isReturned) statusStr = 'הוחזר';
          else if (item.isTaken) statusStr = 'אצל הלקוח';
          
          let alts = enableAlterations ? `
            <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">${item.neckAlteration ? `הצרה ${item.neckAlteration}` : '-'}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">${item.sleeveAlteration ? `הארכה ${item.sleeveAlteration}` : '-'}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">${item.lengthAlteration || '-'}</td>
          ` : '';

          const modelName = item.dressItem?.dress?.name || item.dressItem?.dressName || item.description || '-';
          const sizeText = item.sizeText || item.dressItem?.sizeText || '-';

          return `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 500;">${modelName}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">${sizeText}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">${item.barcode || '-'}</td>
              ${alts}
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; ${getStatusStyle(statusStr)}">${statusStr}</span>
              </td>
            </tr>
          `;
        }).join('');

    const htmlBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 10px;">
        <div style="max-width: 800px; margin: 0 auto;">
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px;">
            <tr>
              <td valign="top">
                <h1 style="margin: 0; font-size: 24px; color: #000;">גמ"ח שמלות</h1>
                <h2 style="margin: 5px 0 0 0; font-size: 16px; color: #333; font-weight: normal;">${printType === 'rental' ? 'הערות להשכרה' : 'דוח השכרות פירוט'}</h2>
              </td>
              <td valign="top" style="text-align: left;">
                <div style="font-size: 18px; font-weight: bold; border: 1px solid #000; padding: 5px 10px; display: inline-block;">
                  הזמנה #${order.orderId}
                </div>
              </td>
            </tr>
          </table>

          ${printType === 'rental' && printSettings.box1 ? `<div style="border: 1px solid #000; padding: 10px; margin-bottom: 15px; text-align: center; font-size: 14px; font-weight: bold;">${printSettings.box1}</div>` : ''}
          ${printType === 'rental' && printSettings.box2 ? `<div style="border: 1px solid #000; padding: 10px; margin-bottom: 15px; text-align: center; font-size: 14px; font-weight: bold; background-color: #eee;">${printSettings.box2}</div>` : ''}
          ${printType === 'rental' && printSettings.footer ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; margin-bottom: 20px;">
              <tr>
                <td align="center">
                  <h3 style="font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">${printSettings.footer}</h3>
                  <div style="font-size: 16px; font-weight: bold;">
                    <span>על החתום: _____________________</span>
                  </div>
                  <div style="margin-top: 10px; font-size: 14px; font-weight: bold;">
                    נא להחזיר טופס זה חתום בעת החזרת השמלות
                  </div>
                </td>
              </tr>
            </table>
          ` : ''}

          <table width="100%" cellpadding="5" cellspacing="0" style="border: 1px solid #000; margin-bottom: 20px;">
            <tr>
              <td width="50%" valign="top" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc;">
                <strong>שם לקוח:</strong> ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}
              </td>
              <td width="50%" valign="top" style="border-bottom: 1px solid #ccc;">
                <strong>תאריך אירוע עברי:</strong> ${order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : '-')}
              </td>
            </tr>
            <tr>
              <td width="50%" valign="top" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc;">
                <strong>טלפון:</strong> <span dir="ltr">${order.customer?.phone1 || order.customer?.phone || '-'}</span>
              </td>
              <td width="50%" valign="top" style="border-bottom: 1px solid #ccc;">
                <strong>תאריך אירוע לועזי:</strong> ${order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : '-'}
              </td>
            </tr>
            <tr>
              <td width="50%" valign="top" style="border-left: 1px solid #ccc;">
                <strong>כתובת מגורים:</strong> ${order.customer?.city ? `${order.customer.city}${order.customer?.address ? `, ${order.customer.address}` : ''}` : '-'}
              </td>
              <td width="50%" valign="top">
                <strong>סטטוס השכרה:</strong> ${getOrderStatus(order)}
              </td>
            </tr>
            ${printType === 'order' && order.notes ? `
            <tr>
              <td colspan="2" valign="top" style="border-top: 1px solid #ccc;">
                <strong>הערות הזמנה:</strong> ${order.notes}
              </td>
            </tr>
            ` : ''}
          </table>

          <h3 style="font-size: 18px; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px;">פירוט פריטים להשכרה</h3>
          <table width="100%" cellpadding="5" cellspacing="0" style="border: 1px solid #000; margin-bottom: 20px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #eee;">
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">דגם / תיאור</th>
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">מידה</th>
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">ברקוד</th>
                ${enableAlterations ? `
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">תיקון צואר</th>
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">תיקון שרוול</th>
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">תיקון אורך</th>
                ` : ''}
                <th style="border: 1px solid #000; text-align: right; font-size: 14px;">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml.replace(/border-bottom: 1px solid #e9ecef;/g, 'border: 1px solid #000;').replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '')}
            </tbody>
          </table>

          <h3 style="font-size: 18px; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px;">פירוט תשלומים וחובות</h3>
          <table width="100%" cellpadding="5" cellspacing="0" style="border: 1px solid #000; margin-bottom: 20px;">
            <tr>
              <td width="50%" valign="top" style="border-left: 1px solid #ccc;">
                <strong>סה"כ לחיוב:</strong> ₪${totalObligations}
              </td>
              <td width="50%" valign="top">
                <strong>סה"כ שולם:</strong> ₪${totalPayments}
              </td>
            </tr>
            <tr>
              <td colspan="2" valign="top" style="border-top: 1px solid #ccc;">
                <strong>יתרה לתשלום:</strong> ₪${Math.max(0, totalObligations - totalPayments)}
              </td>
            </tr>
          </table>

          <div style="margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #000; padding-top: 10px;">
            <p>הופק על ידי מערכת גמ"ח שמלות בתאריך: ${new Date().toLocaleString('he-IL')}</p>
          </div>

        </div>
      </div>
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

    const scriptUrl = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
    
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
