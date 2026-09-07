import { NextResponse } from 'next/server';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { parseIdList } from '../../../lib/notificationLists';
import { renderGenericEmailHtml } from '../../../lib/emailTemplates';

// #24/#25 — קטגוריות הודעה מותרות. כל ערך אחר (כולל undefined) = הודעה כללית.
const ALLOWED_CATEGORIES = ['shift_handover', 'management'];

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Fetch personal messages or global messages
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { receiverId: employeeId },
          { receiverId: null }
        ]
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true }
        },
        handledBy: {
          select: { firstName: true, lastName: true }
        },
        tags: {
          where: { employeeId: employeeId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 150 // Limit to 150 recent notifications — bumped from 100 to leave room for #24/#25 categorized notes alongside general messages
    });

    // Map to add an isRead and isArchived computed property for global messages
    const mapped = notifications.map(notif => {
      let isArchived = notif.isArchived;
      if (notif.receiverId === null) {
        isArchived = parseIdList(notif.archivedBy).includes(employeeId);
      }
      return {
        ...notif,
        isRead: notif.receiverId === null ? parseIdList(notif.readBy).includes(employeeId) : notif.isRead,
        isArchived,
        personalTags: notif.tags.map(t => t.tag)
      };
    });

    const outgoing = await prisma.notification.findMany({
      where: { senderId: employeeId },
      include: {
        receiver: {
          select: { firstName: true, lastName: true }
        },
        tags: {
          where: { employeeId: employeeId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const mappedOutgoing = outgoing.map(notif => ({
      ...notif,
      personalTags: notif.tags.map(t => t.tag)
    }));

    return NextResponse.json({ success: true, notifications: mapped, outgoing: mappedOutgoing });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', message: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, title, content, sendEmail, category } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // #24/#25 — הודעות מסווגות (בין משמרות / להנהלה) הן תמיד שידור לכולם,
    // ומותנות בהגדרת המערכת המתאימה כדי שלא ניתן יהיה לעקוף כיבוי מהצד השרת.
    const parsedCategory = ALLOWED_CATEGORIES.includes(category) ? category : null;
    if (parsedCategory) {
      const settingKey = parsedCategory === 'shift_handover' ? 'shift_handover_notes' : 'management_messages';
      const setting = await getCachedSetting(settingKey);
      if (!(setting && setting.value === 'true')) {
        return NextResponse.json({ success: false, error: 'התכונה כבויה בהגדרות המערכת' }, { status: 403 });
      }
    }

    // Validate if receiverId is provided, else it's a global message
    const parsedReceiver = parsedCategory ? null : (receiverId === 'all' || receiverId === null ? null : receiverId);

    const notification = await prisma.notification.create({
      data: {
        senderId: employeeId,
        receiverId: parsedReceiver,
        title: title || 'הודעה חדשה',
        content,
        category: parsedCategory,
      }
    });

    // Always try to send emails, filtering by receiveEmailAlerts
    try {
      const settings = (await getAllCachedSettings()).filter(s => ['email_link_a', 'email_link_b', 'email_routing_strategy', 'gmach_name'].includes(s.key));
      const linkA = settings.find(s => s.key === 'email_link_a')?.value;
      const linkB = settings.find(s => s.key === 'email_link_b')?.value;
      const strategy = settings.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';
      const gmachName = settings.find(s => s.key === 'gmach_name')?.value || 'גמ"ח שמלות';

      const FALLBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';
      const scriptUrl = (strategy === 'all_b' && linkB) ? linkB : (linkA || FALLBACK_SCRIPT_URL);

      let receivers = [];
      if (parsedReceiver) {
        const emp = await prisma.employee.findUnique({ where: { id: parsedReceiver } });
        if (emp && emp.email && emp.receiveEmailAlerts) receivers.push(emp.email);
      } else {
        const emps = await prisma.employee.findMany({ where: { isActive: true, email: { not: null }, receiveEmailAlerts: true } });
        receivers = emps.map(e => e.email).filter(Boolean);
      }

      const subject = title || 'הודעה חדשה במערכת הגמח';
      const htmlBody = renderGenericEmailHtml({ title, bodyText: content, gmachName, subtitle: 'הודעה חדשה' });

      for (const email of receivers) {
        fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            cc: '',
            subject,
            body: content || '',
            htmlBody,
            fileName: 'הודעה.txt',
            fileContent: Buffer.from('נשלח ממערכת הגמח').toString('base64')
          })
        }).catch(e => console.error('Failed to send email alert to', email, e));
      }
    } catch (e) {
      console.error('Email alert process failed:', e);
    }

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}