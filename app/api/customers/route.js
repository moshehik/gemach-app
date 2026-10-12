import { withCpuTiming } from '@/lib/cpuTiming';
import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { normalizeEmail } from '@/lib/emailUtils';
import { CUSTOMER_BANK_FIELD_KEYS } from '@/lib/customerBankFields';
import { collectNewCustomerErrors } from '@/lib/customerCreateValidation';
import { kioskRegistrationState, kioskUnverifiedWhere } from '@/lib/kioskRegistration';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { buildMultiWordNameCondition } from '@/lib/searchUtils';
import {
  planListSearch, planNeedsPhoneIds, customerSearchCondition, buildRetryVariants, clampLimit, clampPage, limitWasCapped, shouldRetryEmptySearch, memoLookup, NOTICE_PARTIAL, phoneKeysFromInput,
} from '@/lib/listSearch';
import { EXPORT_MAX_ROWS } from '@/lib/exportLimits';
import { findCustomerIdsByPhone, findFuzzyCustomerIds } from '@/lib/searchDb';
import { readSignatureFlag } from '@/lib/customerSignature';
import { prepareStaffConsent, recordConsentEntries } from '@/lib/customerConsent';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import { NEW_ORDER_PICKER_PARAM, NEW_ORDER_PICKER_VALUE } from '@/lib/newOrderCustomerFilter';
import { newOrderPickerConditions } from '@/lib/customerPickerFilter';

async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    // תוכנית החיפוש (lib/listSearch.js): טלפון בכל צורת כתיבה (גם טלפון 2), שם דומה, הצלת מקלדת אנגלית.
    const plan = planListSearch(searchParams.get('search') || '');
    const cache = new Map(); // חיפושי עזר משותפים לנסיון הראשון ולנסיונות החוזרים
    let result = await queryCustomersList(searchParams, { plan, cache });
    // חיפוש טקסט שלא מצא כלום: מנסים שוב (מקלדת אנגלית -> עברית, שמות דומים) ומציגים הודעה (ר' app/api/orders/route.js).
    // בלי נסיון חוזר בטקסט קצר מ-3 תווים (shouldRetryEmptySearch)
    if (result.total === 0 && shouldRetryEmptySearch(plan)) {
      for (const variant of buildRetryVariants(plan, { scopeRestricted: false, barcode: false, dateStage: false })) {
        const variantPlan = variant.text ? planListSearch(variant.text) : plan;
        const retry = await queryCustomersList(searchParams, { plan: variantPlan, cache, fuzzy: variant.fuzzy });
        if (retry.total > 0) { result = { ...retry, notices: [...variant.notices, ...(retry.notices || [])] }; break; }
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// שאילתת הרשימה (חיפוש + סינון + עימוד); מחזירה את גוף התשובה כדי ש-GET יוכל להריץ אותה שוב עם וריאנט.
async function queryCustomersList(searchParams, opts) {
  {
    const plan = opts.plan;
    const search = plan.text;
    const sort = searchParams.get('sort') || 'legacyId';
    const order = searchParams.get('order') || 'desc';
    const page = clampPage(searchParams.get('page') || '1');
    // תקרה ל-limit (קודם: ?limit=100000000 שלף את כל הטבלה); EXPORT_MAX_ROWS מכסה ייצוא של כל הלקוחות, מעבר לה limitCapped:true
    const limit = clampLimit(searchParams.get('limit'), 50, EXPORT_MAX_ROWS);
    const limitCapped = limitWasCapped(searchParams.get('limit'), EXPORT_MAX_ROWS);

    const skip = (page - 1) * limit;

    const advFirstName = searchParams.get('firstName') || '';
    const advLastName = searchParams.get('lastName') || '';
    const advPhone = searchParams.get('phone') || '';
    const advCity = searchParams.get('city') || '';
    const advEmail = searchParams.get('email') || '';

    // בונים כל תנאי כאיבר נפרד במערך ה-AND במקום לפזר אותם כמפתחות נפרדים על
    // אובייקט אחד (כפי שהיה קודם) - שני מפתחות "OR" (חיפוש בסיסי + advPhone)
    // באותו אובייקט מתנגשים ב-JS: הספרייד המאוחר יותר דורס בשקט את הקודם, כך
    // שאם advPhone נשאר ממולא מחיפוש מתקדם קודם (ה-state לא מתאפס אוטומטית
    // ב-app/customers/page.js) כל חיפוש טקסט רגיל אחריו החליף את עצמו בסינון
    // לפי הטלפון הישן בלבד - זה בדיוק הבאג מאחורי "החיפוש לא עובד לפי שם"/
    // "תוצאות לפי עיר לא נכונות": מה שהוקלד בפועל נדרס ולא השפיע על השאילתה.
    const multiWordNameCond = search ? buildMultiWordNameCondition(search, 'firstName', 'lastName') : null;
    const conditions = [{ isDeleted: false }];
    let phonePartial = false; // יותר מ-300 לקוחות תואמים לטלפון - התוצאות חלקיות (הודעה בתשובה)
    if (search) {
      // לקוחות לפי טלפון בכל צורת כתיבה (מקפים / +972 / בלי 0 מוביל, שני הטלפונים) ולפי שם דומה - lib/searchDb.js; רק כשהקלט מתאים.
      const [phoneIds, fuzzyIds] = await Promise.all([
        planNeedsPhoneIds(plan) ? memoLookup(opts.cache, `phone:${JSON.stringify(plan.phone)}`, () => findCustomerIdsByPhone(plan.phone)) : [],
        opts.fuzzy ? memoLookup(opts.cache, `fuzzy:${search}`, () => findFuzzyCustomerIds(search)) : []
      ]);
      // חיפוש שם מלא ("רחל כהן") - קודם כל מילה נבדקה רק כמכלול מול שדה
      // בודד, כך ששם פרטי+משפחה יחד מעולם לא התאים לאף שדה. ר' lib/searchUtils.js.
      if (phoneIds.capped) phonePartial = true;
      conditions.push(customerSearchCondition(plan, { multiNameCond: multiWordNameCond, phoneIds, fuzzyIds }));
    }
    if (advFirstName) conditions.push({ firstName: { contains: advFirstName } });
    if (advLastName) conditions.push({ lastName: { contains: advLastName } });
    if (advPhone) {
      const advPhoneKeys = phoneKeysFromInput(advPhone);
      const advPhoneIds = advPhoneKeys ? await memoLookup(opts.cache, `advphone:${advPhone}`, () => findCustomerIdsByPhone(advPhoneKeys)) : [];
      if (advPhoneIds.capped) phonePartial = true;
      conditions.push({
        OR: [
          { phone1: { contains: advPhone } },
          { phone2: { contains: advPhone } },
          ...(advPhoneIds.length ? [{ id: { in: advPhoneIds } }] : [])
        ]
      });
    }
    if (advCity) conditions.push({ city: { contains: advCity } });
    if (advEmail) conditions.push({ email: { contains: advEmail } });
    // בורר "לקוח קיים" של הזמנה חדשה (?pickerFor=new-order): לפי ההגדרה new_order_customer_list_filter - 'complete' משאיר רק לקוחות עם כל הפרטים
    // הנדרשים ביצירת לקוח (lib/customerCompleteness.js). ללא הפרמטר (/customers, כרטיס הזמנה, בדיקת כפילות לפי ?phone=) - אין שום סינון.
    if (searchParams.get(NEW_ORDER_PICKER_PARAM) === NEW_ORDER_PICKER_VALUE) {
      conditions.push(...await memoLookup(opts.cache, 'pickerFilter', () => newOrderPickerConditions()));
    }
    // kioskPending=1: רק לקוחות שנרשמו בעמדת הלקוח וממתינות לאימות פרטים (lib/kioskRegistration.js) - רשימה לצוות
    if (searchParams.get('kioskPending') === '1') conditions.push(kioskUnverifiedWhere());

    const where = { AND: conditions };

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { [sort]: order },
        skip,
        take: limit,
        select: {
          id: true,
          legacyId: true,
          firstName: true,
          lastName: true,
          phone1: true,
          phone2: true,
          city: true,
          // The new-order screen charges the card straight off the customer picked here, and
          // Nedarim Plus is sent the full address - without these it only ever got the city.
          street: true,
          houseNum: true,
          email: true,
          emailSuffix: true,
          isBlocked: true,
          blockedReason: true,
          // חסרו כאן - לקוח שנמצא דרך חיפוש (למשל לפי טלפון בהוספת הזמנה) הגיע בלי
          // ת"ז/אישור דיוור בפועל, אז בדיקת "שדות חובה חסרים" בצד הלקוח (ר'
          // getMissingMandatoryCustomerFields ב-app/orders/new/page.js) הייתה מסמנת
          // אותם כחסרים גם כשהם מולאים אצל הלקוח בפועל.
          zeout: true,
          marketingConsent: true,
          // נגזר בלבד (kioskReg): הערות המשרד עצמן לא נשלחות ברשימה
          officeNotes: true
        }
      }),
      prisma.customer.count({ where })
    ]);

    // kioskReg: 'pending' (נרשמה בעמדה - לאמת פרטים) | 'repeat' (נרשמה שוב בעמדה, כבר קיימת) | 'verified' | null - מוצג כתג בבוחר הלקוחות
    const formattedCustomers = customers.map(({ officeNotes, ...c }) => ({
      ...c,
      email: normalizeEmail(c.email, c.emailSuffix),
      kioskReg: kioskRegistrationState(officeNotes)
    }));

    return {
      data: formattedCustomers,
      total: totalCount,
      page,
      limit,
      ...(limitCapped ? { limitCapped: true } : {}),
      ...(phonePartial ? { notices: [{ kind: 'partial', text: NOTICE_PARTIAL }] } : {}),
      totalPages: Math.ceil(totalCount / limit)
    };
  }
}

async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    // שדות הבנק של הלקוח נשמרים רק כשההגדרה customer_bank_fields_enabled פעילה (ברירת מחדל: כבוי);
    // כבוי = הם מתעלמים מהגוף ולא נחשבים כחובה (requiredFieldsFromSettings).
    // (true/false כשקריאת ההגדרות הצליחה; null = לא ידוע, fail-open: לא נבדק ולא נחסם, והשדות שנשלחו נשמרים)
    let bankOn = null;
    // 4 - אכיפת שדות חובה (strict_mandatory_fields + require_*), גם ב-API (לא רק ב-UI)
    try {
      const allSettings = await getAllCachedSettings();
      const sMap = new Map(allSettings.map(s => [s.key, s.value]));
      // כל בדיקות השדות מבוססות-ההגדרות (חובה + תבנית) יושבות ב-lib/customerCreateValidation.js - משותפות גם לרישום העצמי בעמדה
      // (POST /api/public-kiosk/register). הסדר והנוסח של ההודעות זהים למה שהיה כאן.
      const collected = collectNewCustomerErrors(body, sMap, { a5Required: body.cardVariant === 'a5' });
      bankOn = collected.bankOn;
      const errors = collected.errors;

      // 5 - חסימת כפילות ת"ז בין לקוחות: המערכת אפשרה עד כה לשמור 2 לקוחות עם אותה
      // תעודת זהות. ת"ז אמורה להיות ייחודית ללקוח (בניגוד לטלפון, שיכול להיות משותף
      // במשפחה) - בודקים רק מול לקוחות פעילים (isDeleted: false).
      const zeoutToCheck = String(body.zeout || body.idNumber || '').trim();
      if (zeoutToCheck) {
        const zeoutOwner = await prisma.customer.findFirst({
          where: { zeout: zeoutToCheck, isDeleted: false },
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

    // חתימה על התקנון ביצירת לקוח - רק מהכרטיס החדש (cardVariant:'a5'); החותמת מהשרת, לעולם לא מהגוף (lib/customerSignature.js)
    const requestedSignature = readSignatureFlag(body);
    if (requestedSignature === 'invalid') {
      return NextResponse.json({ error: 'ערך חתימה על התקנון לא תקין' }, { status: 400 });
    }

    // הסכמות מפורשות (תקנון כן/לא, דיוור כן/לא, אישור פרטיות) - lib/customerConsent.js: ולידציה בשרת + תוכנית כתיבה (כולל החתימה
    // על התקנון דרך planSignatureWrite הקיים) + שורות ליומן CustomerConsent. מערכת כבויה והבקשה בלי consentExplicit = בדיוק כמו קודם.
    let consentCtx = { map: new Map(), docs: {} };
    try { consentCtx = await loadConsentContext(); } catch (e) { console.error('consent docs unavailable (fail-open)', e); }
    const consent = await prepareStaffConsent({
      prisma, body, settings: consentCtx.map, existing: null, docs: consentCtx.docs, employeeId: await getActingEmployeeId(),
      legacyTerms: typeof requestedSignature === 'boolean' ? requestedSignature : undefined,
    });
    if (consent.errors.length) return NextResponse.json({ error: consent.errors.join(', '), ...(consent.status === 409 ? { code: 'CONSENT_DOC_CHANGED' } : {}) }, { status: consent.status || 400 });

    // Auto-generate a short legacyId for new customers so it displays nicely
    const maxCustomer = await prisma.customer.findFirst({
      where: { legacyId: { not: null } },
      orderBy: { legacyId: 'desc' }
    });
    const nextLegacyId = (maxCustomer?.legacyId || 0) + 1;

    const normalizedEmail = normalizeEmail(body.email, body.emailSuffix);

    const newCustomer = await prisma.customer.create({
      data: {
        legacyId: nextLegacyId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone1: body.phone1,
        phone2: body.phone2,
        email: normalizedEmail,
        city: body.city,
        street: body.street,
        houseNum: body.houseNum !== "" && body.houseNum !== null ? parseInt(body.houseNum, 10) : null,
        notes: body.notes,
        zeout: body.zeout || body.idNumber || null, // 14 - ת״ז לעריכה/ביטול
        marketingConsent: !!body.marketingConsent, // 4 - אישור דיוור
        // שדות בנק לזיכויים - רק כשההגדרה customer_bank_fields_enabled פעילה
        ...(bankOn !== false ? Object.fromEntries(CUSTOMER_BANK_FIELD_KEYS.map((k) => [k, String(body[k] ?? '').trim() || null])) : {}),
        // 3 - הו"ק (שדות אופציונליים, נשמרים רק אם נשלחו)
        ...(body.hokBankName !== undefined ? { hokBankName: body.hokBankName || null } : {}),
        ...(body.hokBankBranch !== undefined ? { hokBankBranch: body.hokBankBranch || null } : {}),
        ...(body.hokBankAccount !== undefined ? { hokBankAccount: body.hokBankAccount || null } : {}),
        ...(body.hokConsent !== undefined ? { hokConsent: !!body.hokConsent } : {}),
        ...consent.plan.data,
      }
    });
    const journal = await recordConsentEntries(prisma, newCustomer.id, consent.plan.entries);
    return NextResponse.json(journal.ok ? newCustomer : { ...newCustomer, consentWarning: 'הלקוח נשמר, אך ההסכמות לא נרשמו ביומן ההסכמות - יש לעדכן את מנהל המערכת' });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

// cpu-measure (docs/cpu-measurement-2026-10-06.md): Server-Timing/x-cpu-ms/x-boot-id on the response
const GET_timed = withCpuTiming(GET);
export { GET_timed as GET };
const POST_timed = withCpuTiming(POST);
export { POST_timed as POST };
