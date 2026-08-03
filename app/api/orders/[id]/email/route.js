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
        items: true,
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
          return `
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 500;">${item.description || '-'}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">${item.sizeText || '-'}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #495057;">${item.barcode || '-'}</td>
              ${alts}
              <td style="padding: 12px 16px; border-bottom: 1px solid #e9ecef;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; ${getStatusStyle(statusStr)}">${statusStr}</span>
              </td>
            </tr>
          `;
        }).join('');

    const htmlBody = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; padding: 20px;">
        <div style="background: white; max-width: 800px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 20px;">
            <div>
              <h1 style="margin: 0; font-size: 28px; color: #2c3e50;">גמ"ח שמלות</h1>
              <h2 style="margin: 5px 0 0 0; font-size: 16px; color: #6c757d; font-weight: normal;">${printType === 'rental' ? 'הערות להשכרה' : 'דוח השכרות פירוט'}</h2>
            </div>
            <div style="background: #e3f2fd; color: #1976d2; padding: 8px 20px; border-radius: 30px; font-size: 20px; font-weight: bold; text-align: left; float: left; margin-top: -50px;">
              הזמנה #${order.orderId}
            </div>
          </div>

          ${printType === 'rental' && printSettings.box1 ? `<div style="border: 1px solid #495057; padding: 15px; margin-bottom: 15px; white-space: pre-wrap; text-align: center; font-size: 15px; font-weight: 500; color: #212529;">${printSettings.box1}</div>` : ''}
          ${printType === 'rental' && printSettings.box2 ? `<div style="border: 1px solid #495057; padding: 10px; margin-bottom: 15px; white-space: pre-wrap; text-align: center; font-size: 15px; font-weight: bold; color: #212529; background-color: #f8f9fa;">${printSettings.box2}</div>` : ''}
          ${printType === 'rental' && printSettings.footer ? `
            <div style="text-align: center; margin-top: 20px; margin-bottom: 20px;">
              <h3 style="font-size: 22px; font-weight: bold; margin: 0 0 10px 0;">${printSettings.footer}</h3>
              <div style="font-size: 18px; font-weight: bold; display: flex; justify-content: center; align-items: center;">
                <span>על החתום:</span>
                <span style="display: inline-block; width: 250px; border-bottom: 2px solid black; margin: 0 10px;"></span>
              </div>
              <div style="margin-top: 15px; font-size: 16px; font-weight: bold;">
                נא להחזיר טופס זה חתום בעת החזרת השמלות
              </div>
            </div>
          ` : ''}

          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 24px; margin-bottom: 35px; display: flex; flex-wrap: wrap; gap: 20px;">
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">שם לקוח</span>
              <span style="font-size: 16px; color: #212529; font-weight: 500;">${order.customer?.firstName || ''} ${order.customer?.lastName || ''}</span>
            </div>
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">תאריך אירוע עברי</span>
              <span style="font-size: 16px; color: #212529; font-weight: 500;">${order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : '-')}</span>
            </div>
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">טלפון</span>
              <span style="font-size: 16px; color: #212529; font-weight: 500; direction: ltr; text-align: right;">${order.customer?.phone1 || order.customer?.phone || '-'}</span>
            </div>
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">תאריך אירוע לועזי</span>
              <span style="font-size: 16px; color: #212529; font-weight: 500;">${order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : '-'}</span>
            </div>
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">כתובת מגורים</span>
              <span style="font-size: 16px; color: #212529; font-weight: 500;">${order.customer?.city ? `${order.customer.city}${order.customer?.address ? `, ${order.customer.address}` : ''}` : '-'}</span>
            </div>
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">סטטוס השכרה</span>
              <span><span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: bold; ${getStatusStyle(getOrderStatus(order))}">${getOrderStatus(order)}</span></span>
            </div>
            ${printType === 'order' && order.notes ? `
            <div style="flex: 1 1 100%; display: flex; flex-direction: column; margin-top: 10px;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">הערות הזמנה</span>
              <span style="font-size: 16px; color: #212529; font-weight: 500;">${order.notes}</span>
            </div>
            ` : ''}
          </div>

          <h3 style="font-size: 20px; color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">פירוט פריטים להשכרה</h3>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
            <thead>
              <tr>
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">דגם / תיאור</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">מידה</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">ברקוד</th>
                ${enableAlterations ? `
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">תיקון צואר</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">תיקון שרוול</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">תיקון אורך</th>
                ` : ''}
                <th style="padding: 12px 16px; text-align: right; font-size: 14px; background-color: #f1f3f5; color: #495057; font-weight: bold; border-bottom: 2px solid #e9ecef;">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <h3 style="font-size: 20px; color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">פירוט תשלומים וחובות</h3>
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 24px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 20px;">
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">סה"כ לחיוב</span>
              <span style="font-size: 16px; color: #b91c1c; font-weight: bold;">₪${totalObligations}</span>
            </div>
            <div style="flex: 1 1 45%; display: flex; flex-direction: column;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">סה"כ שולם</span>
              <span style="font-size: 16px; color: #166534; font-weight: bold;">₪${totalPayments}</span>
            </div>
            <div style="flex: 1 1 100%; display: flex; flex-direction: column; margin-top: 10px;">
              <span style="font-size: 13px; color: #6c757d; margin-bottom: 4px; font-weight: bold;">יתרה לתשלום</span>
              <span style="color: ${totalObligations - totalPayments > 0 ? '#b91c1c' : '#212529'}; font-weight: bold; font-size: 18px;">
                ₪${Math.max(0, totalObligations - totalPayments)}
              </span>
            </div>
          </div>

          <div style="margin-top: 40px; text-align: center; font-size: 13px; color: #adb5bd; border-top: 1px solid #e9ecef; padding-top: 20px;">
            <p>הופק על ידי מערכת גמ"ח שמלות בתאריך: ${new Date().toLocaleString('he-IL')}</p>
          </div>

        </div>
      </div>
    `;

    const googlePayload = {
      to: email,
      cc: '',
      subject: `הזמנה #${order.orderId} - גמ"ח שמלות`,
      body: htmlBody,
      fileName: 'order.txt',
      fileContent: Buffer.from('Email body contains the order details').toString('base64')
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
        body: 'HTML body sent',
        fileName: null,
        status: isSuccess ? 'success' : 'error',
        errorMessage: isSuccess ? null : (result.message || 'Unknown error'),
        customerId: order.customerId,
        sentAt: new Date()
      }
    });

    if (isSuccess) {
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
