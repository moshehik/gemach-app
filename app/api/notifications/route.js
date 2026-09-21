import { NextResponse } from 'next/server';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { parseIdList } from '../../../lib/notificationLists';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { renderInternalMessageEmailHtml } from '../../../lib/emailTemplates';
import { sendSystemEmail } from '../../../lib/mailer';
import { emailSubject } from '../../../lib/emailCatalog';

// #24/#25 — קטגוריות הודעה מותרות. כל ערך אחר (כולל undefined) = הודעה כללית.
const ALLOWED_CATEGORIES = ['shift_handover', 'management'];

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // ?light=1 - הבדיקה התקופתית של פעמון ההתראות (NotificationBell.js) צריכה רק את מונה
    // "לא נקראו" לנקודה האדומה. אותם ה-where/orderBy/take והחישוב של isRead/isArchived בדיוק
    // כמו למטה (כך שהמספר זהה לזה שהרשימה המלאה מציגה), אבל בלי include של שולח/מטפל/תגיות,
    // בלי תוכן ההודעות ובלי שאילתת ה-outgoing - עד 250 שורות עם תוכן כל דקה לכל טאב היו
    // תעבורה מיותרת מול מכסת ה-5GB של Neon. הרשימה המלאה נטענת רק כשהעובד פותח את הפעמון.
    if (new URL(request.url).searchParams.get('light') === '1') {
      const rows = await prisma.notification.findMany({
        where: { OR: [{ receiverId: employeeId }, { receiverId: null }] },
        select: { receiverId: true, isRead: true, isArchived: true, readBy: true, archivedBy: true },
        orderBy: { createdAt: 'desc' },
        take: 150
      });
      const unreadCount = rows.filter((n) => {
        const isGlobal = n.receiverId === null;
        const archived = isGlobal ? parseIdList(n.archivedBy).includes(employeeId) : n.isArchived;
        if (archived) return false;
        const read = isGlobal ? parseIdList(n.readBy).includes(employeeId) : n.isRead;
        return !read;
      }).length;
      return NextResponse.json({ success: true, unreadCount });
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
    const token = getVerifiedAuthCookie(cookieStore);

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
      const settings = (await getAllCachedSettings()).filter(s => s.key === 'gmach_name');
      const gmachName = settings.find(s => s.key === 'gmach_name')?.value || 'גמ"ח שמלות';

      let receivers = [];
      if (parsedReceiver) {
        const emp = await prisma.employee.findUnique({ where: { id: parsedReceiver } });
        if (emp && emp.email && emp.receiveEmailAlerts) receivers.push(emp.email);
      } else {
        const emps = await prisma.employee.findMany({ where: { isActive: true, email: { not: null }, receiveEmailAlerts: true } });
        receivers = emps.map(e => e.email).filter(Boolean);
      }

      const subject = emailSubject('internalMessageAlert', { title });
      const sender = await prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true } });
      const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ');
      const htmlBody = renderInternalMessageEmailHtml({ title: title || 'הודעה חדשה', bodyText: content, senderName, gmachName });

      // דרך המערכת המרכזית (lib/mailer.js): ניתוב לפי הגדרות, יישור RTL, בלי קובץ ממלא מקום
      // בגוף המייל, וגם רישום ב-EmailLog (עד כה מיילי ההתראה האלה לא נרשמו בכלל).
      // במקביל ולא ברצף - הודעה לכל העובדים לא צריכה לחכות ל-N שליחות עוקבות.
      await Promise.allSettled(receivers.map(email =>
        sendSystemEmail({ to: email, subject, body: content || '', html: htmlBody, employeeId })
      ));
    } catch (e) {
      console.error('Email alert process failed:', e);
    }

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}