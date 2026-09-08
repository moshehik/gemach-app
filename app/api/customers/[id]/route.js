import prisma, { auditAs } from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/emailUtils';
import { checkAuth } from '../../../../lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { validateCustomerFieldFormats } from '@/lib/customerValidation';

export async function GET(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { id: 'desc' },
          include: {
            items: {
              include: {
                dressItem: true
              }
            },
            payments: {
              where: { isDeleted: false }
            },
            obligations: {
              where: { isDeleted: false }
            }
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    customer.email = normalizeEmail(customer.email, customer.emailSuffix);

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    
    // 1. Fetch old data to compare
    const oldCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!oldCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Offline data collision check
    if (body.updatedAt && oldCustomer.updatedAt) {
      const clientUpdate = new Date(body.updatedAt).getTime();
      const serverUpdate = new Date(oldCustomer.updatedAt).getTime();
      
      if (serverUpdate > clientUpdate + 1000) {
        return NextResponse.json({ 
          error: 'Data Collision', 
          message: 'לקוח זה עודכן בשרת לאחר הסנכרון האחרון שלך. כדי למנוע דריסת נתונים, אנא רענן את העמוד ושלב את השינויים שלך.'
        }, { status: 409 });
      }
    }

    const normalizedEmail = normalizeEmail(body.email, body.emailSuffix);

    // 4 - אכיפה בעריכת לקוח קיים (גם ב-API, לא רק ב-UI החדש)
    try {
      const allSettings = await getAllCachedSettings();
      const sMap = new Map(allSettings.map(s => [s.key, s.value]));
      const errors = [];
      if (sMap.get('require_customer_email') === 'true') {
        const rawEmail = String(body.email || (body.emailSuffix && String(body.emailSuffix).includes('@') ? body.emailSuffix : '') || '').trim();
        if (!rawEmail || !rawEmail.includes('@')) errors.push('מייל חובה');
      }
      if (sMap.get('require_full_address') === 'true') {
        if (!String(body.city || '').trim()) errors.push('עיר חובה');
        if (!String(body.street || '').trim()) errors.push('רחוב חובה');
        if (!String(body.houseNum || '').trim()) errors.push('מספר בית חובה');
      }
      if (sMap.get('require_marketing_consent') === 'true') {
        if (!body.marketingConsent) errors.push('חובה לאשר קבלת דיוורים');
      }
      if (sMap.get('strict_mandatory_fields') === 'true') {
        const mandatory = (sMap.get('mandatory_fields') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const aliasMap = {
          firstname: 'firstName', 'שם פרטי': 'firstName', 'שם_פרטי': 'firstName',
          lastname: 'lastName', 'שם משפחה': 'lastName', 'שם_משפחה': 'lastName',
          phone1: 'phone1', 'טלפון ראשי (נייד)': 'phone1', 'טלפון_1': 'phone1',
          email: 'email', 'אימייל': 'email',
          city: 'city', 'עיר': 'city',
          street: 'street', 'רחוב': 'street',
          housenum: 'houseNum', 'מספר בית': 'houseNum', 'מספר_בית': 'houseNum'
        };
        for (const m of mandatory) {
          const field = aliasMap[m.toLowerCase()] || aliasMap[m] || null;
          if (field && !String(body[field] || '').trim()) {
            const label = field === 'firstName' ? 'שם פרטי' : field === 'lastName' ? 'שם משפחה' : field === 'phone1' ? 'טלפון' : field;
            if (!errors.includes(`${label} חובה`)) errors.push(`${label} חובה`);
          }
        }
      }
      // 7 - ולידציית תבנית (טלפון/מייל/ת"ז/כפילות טלפונים) - לא קשור ל"האם חובה"
      errors.push(...validateCustomerFieldFormats(body));

      // 5 - חסימת כפילות ת"ז בין לקוחות (ר' אותה בדיקה ב-POST /api/customers) - כאן
      // מוציאים את הלקוח הנוכחי עצמו (NOT: { id }) כדי לא לחסום שמירה בלי שינוי בת"ז.
      const zeoutToCheck = String(body.zeout || body.idNumber || '').trim();
      if (zeoutToCheck) {
        const zeoutOwner = await prisma.customer.findFirst({
          where: { zeout: zeoutToCheck, isDeleted: false, NOT: { id } },
          select: { firstName: true, lastName: true }
        });
        if (zeoutOwner) {
          const ownerName = [zeoutOwner.firstName, zeoutOwner.lastName].filter(Boolean).join(' ');
          errors.push(`מספר תעודת זהות זה כבר קיים במערכת אצל לקוח אחר${ownerName ? ` (${ownerName})` : ''}`);
        }
      }

      if (errors.length > 0) {
        return NextResponse.json({ error: `${errors.join(', ')}` }, { status: 400 });
      }
    } catch (e) {
      console.error('mandatory check failed (fail-open)', e);
    }

    const data = {
      firstName: body.firstName,
      lastName: body.lastName,
      phone1: body.phone1,
      phone2: body.phone2,
      email: normalizedEmail,
      city: body.city,
      street: body.street,
      houseNum: body.houseNum !== "" && body.houseNum !== null ? parseInt(body.houseNum, 10) : null,
      notes: body.notes,
      bankName: body.bankName,
      bankBranch: body.bankBranch,
      bankAccount: body.bankAccount,
      bankAccountName: body.bankAccountName,
      zeout: body.zeout !== undefined ? (body.zeout || null) : undefined, // 14 - ת״ז
      marketingConsent: body.marketingConsent !== undefined ? !!body.marketingConsent : undefined, // 4
      // 3 - הו"ק בעריכה
      hokBankName: body.hokBankName !== undefined ? (body.hokBankName || null) : undefined,
      hokBankBranch: body.hokBankBranch !== undefined ? (body.hokBankBranch || null) : undefined,
      hokBankAccount: body.hokBankAccount !== undefined ? (body.hokBankAccount || null) : undefined,
      hokConsent: body.hokConsent !== undefined ? !!body.hokConsent : undefined,
    };

    // 2. Compute changes (before the write, so they can be handed to the audit extension)
    const changes = {};
    Object.keys(data).forEach(key => {
      // undefined = השדה לא נשלח כלל; Prisma מתעלם ממנו, ולכן זה לא שינוי
      if (data[key] !== undefined && oldCustomer[key] !== data[key]) {
        changes[key] = { from: oldCustomer[key], to: data[key] };
      }
    });

    // 3. Perform the update. הפירוט "לפני ← אחרי" עובר לתוסף היומן דרך auditAs, כך שנרשמת
    // שורת היסטוריה אחת בלבד (וכלום, כששמרו בלי לשנות) — במקום שורה גנרית עם צילום כל
    // השדות מהתוסף ועוד שורה ידנית עם הפירוט.
    const updatedCustomer = await prisma.customer.update(auditAs(
      'UPDATE',
      { where: { id }, data },
      changes
    ));

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// עדכון חלקי - כרגע רק חסימת/שחרור לקוח (Customer.isBlocked/blockedReason), בנפרד
// מ-PUT שדורש את כל שדות טופס עריכת הלקוח. שחרור חסימה (isBlocked: false) מוגבל
// להנהלה ראשית ברמת ה-API עצמו (לא רק הסתרת כפתור בממשק) - חסימה (isBlocked: true)
// נגישה לכל עובד מחובר, כחלק מזרימת "סימון החזרה כלא תקין" הקיימת.
export async function PATCH(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();

    if (body.isBlocked === false) {
      if (!(await checkAuth('הנהלה ראשית'))) {
        return NextResponse.json({ error: 'פעולה זו מוגבלת להנהלה ראשית בלבד' }, { status: 403 });
      }
    } else if (!(await checkAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oldCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!oldCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const data = {};
    if (body.isBlocked !== undefined) data.isBlocked = !!body.isBlocked;
    if (body.blockedReason !== undefined) data.blockedReason = body.blockedReason;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const changes = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== oldCustomer[key]) changes[key] = { from: oldCustomer[key], to: data[key] };
    });

    const updatedCustomer = await prisma.customer.update(auditAs(
      'UPDATE',
      { where: { id }, data },
      changes
    ));

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Error patching customer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
