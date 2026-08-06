// בוני שאילתות משותפים + רישום prefetch בין דפים.
//
// כל דף רשימה בונה כאן את ה-URLSearchParams שלו (במקום אינליין בתוך הדף),
// כך שגם הדף וגם ה-prefetcher מייצרים את אותו מפתח מטמון בדיוק — תו בתו.
// חשוב: סדר הוספת הפרמטרים הוא חלק מהמפתח (queryParams.toString()),
// לכן אין לשנות סדר שדות כאן בלי לוודא שהדף המשתמש עודכן יחד.
//
// prefetchRoute(path) מחמם את המטמון של דף היעד עוד לפני שנכנסים אליו
// (ריחוף על קישור ניווט, או "שכנים" של הדף הנוכחי אחרי שנטען) —
// כך שהכניסה לדף מציגה נתונים מיידית וה-fetch של הדף עצמו הופך לרענון שקט.

import { HDate } from '@hebcal/core';
import { cacheNamespace, fetchJson } from './pageCache';
import { fetchSharedJson, TTL } from '../../lib/apiCache';

export const getThreeMonthsAgoDateString = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split('T')[0];
};

// ===== הזמנות (/orders) =====

export function defaultOrdersAdvFilters() {
  return {
    customerName: '', customerPhone: '', customerCity: '',
    advOrderId: '', itemDetails: '', advModelName: '',
    eventDateFrom: getThreeMonthsAgoDateString(),
    eventDateTo: '',
    rentalStatus: []
  };
}

export function buildOrdersListParams({
  page = 1, limit = 50, search = '', sort = 'eventDate', order = 'asc',
  filterStatus = 'soon', advFilters = defaultOrdersAdvFilters()
} = {}) {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
    sort,
    order,
    filterStatus
  });
  Object.entries(advFilters).forEach(([k, v]) => {
    if (v && k !== 'rentalStatus') queryParams.append(k, v);
  });
  if (Array.isArray(advFilters.rentalStatus)) {
    if (advFilters.rentalStatus.includes('activeOnly')) queryParams.append('activeOnly', 'true');
    if (advFilters.rentalStatus.includes('returnedOnly')) queryParams.append('returnedOnly', 'true');
    if (advFilters.rentalStatus.includes('pendingOnly')) queryParams.append('pendingOnly', 'true');
  }
  return queryParams;
}

// ===== לקוחות (/customers) =====

export function buildCustomersListParams({
  page = 1, limit = 50, search = '', sort = 'legacyId', order = 'desc',
  advFilters = { firstName: '', lastName: '', phone: '', city: '', email: '' }
} = {}) {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
    sort,
    order
  });
  Object.entries(advFilters).forEach(([k, v]) => {
    if (v) queryParams.append(k, v);
  });
  return queryParams;
}

// ===== תפירות (/alterations) =====

export function buildAlterationsListUrl({
  filterStatus = 'all', page = 1, limit = 60,
  startDate = '', endDate = '', search = ''
} = {}) {
  const showOnlyPending = filterStatus === 'pending';
  let url = `/api/alterations?showOnlyPending=${showOnlyPending}&page=${page}&limit=${limit}`;
  if (startDate) url += `&startDate=${startDate}`;
  if (endDate) url += `&endDate=${endDate}`;
  if (search) url += `&search=${search}`;
  // מסך הניהול מציג רק תיקונים לפריטים שטרם נלקחו/הוחזרו — דוחות הדפסה
  // (PrintWizard / print/alterations) לא עוברים דרך הבונה הזה ולא מסננים.
  url += '&hideTakenReturned=true';
  return url;
}

// ===== קטלוג שמלות (/dashboard/dresses) =====

export function buildDressesListParams({
  page = 1, limit = 50, filterStatus = 'active', search = '',
  sortKey = 'name', sortDir = 'asc',
  advancedFilters = { name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false }
} = {}) {
  return new URLSearchParams({
    page,
    limit,
    filterStatus,
    search,
    sortKey,
    sortDir,
    advName: advancedFilters.name,
    advSize: advancedFilters.size,
    advSerial: advancedFilters.serialNumber,
    advRentalsCountMin: advancedFilters.rentalsCountMin,
    advNotInUse: advancedFilters.notInUse,
    advInRepair: advancedFilters.inRepair,
    advItemDeleted: advancedFilters.itemDeleted
  });
}

// ===== השכרות והחזרות (/rentals) =====
// שים לב: eventDateFrom כאן ריק בכוונה (בניגוד ל-orders שמסנן ל-3 חודשים אחורה).

export function defaultRentalsAdvFilters() {
  return {
    customerName: '', customerPhone: '', customerCity: '',
    advOrderId: '', itemDetails: '', advModelName: '', eventDateFrom: '', eventDateTo: ''
  };
}

export function buildRentalsListParams({
  page = 1, limit = 50, search = '', sort = 'eventDateSmart', order = 'desc',
  viewMode = 'all', advFilters = defaultRentalsAdvFilters()
} = {}) {
  const hasAdvFilters = Object.values(advFilters).some(v => v !== '');

  // מיון ברירת המחדל החכם (היום → מחר → עד כשבוע וחצי קדימה, ואז אחורה בעבר)
  // תקף רק בתצוגה הנקייה — חיפוש/סינון מתקדם חוזרים למיון תאריך אירוע רגיל,
  // כדי שתוצאות חיפוש לא ייחתכו על ידי חלון הימים קדימה של המיון החכם.
  const smartSortBlocked = sort === 'eventDateSmart' && (!!search || hasAdvFilters);
  const effectiveSort = smartSortBlocked ? 'eventDate' : sort;
  const effectiveOrder = smartSortBlocked ? 'desc' : order;

  const queryParams = new URLSearchParams({
    search,
    sort: effectiveSort,
    order: effectiveOrder,
    page: String(page),
    limit: String(limit),
    forRentals: 'true'
  });

  // סינון לפי מצב תצוגה פעיל רק כשאין חיפוש/סינון מתקדם — כמו בדף עצמו.
  if (!search && !hasAdvFilters) {
    if (viewMode === 'rented') queryParams.append('activeOnly', 'true');
    else if (viewMode === 'rented_partial') queryParams.append('partiallyRentedOnly', 'true');
    else if (viewMode === 'returned') queryParams.append('returnedOnly', 'true');
    else if (viewMode === 'returned_partial') queryParams.append('partiallyReturnedOnly', 'true');
  }

  Object.entries(advFilters).forEach(([k, v]) => {
    if (v) queryParams.append(k, v);
  });

  return queryParams;
}

// ===== לוח (/board) =====
// טווח החודש העברי המוצג, עם שבועיים באפר לכל כיוון לכיסוי ימי הרשת המובילים/עוקבים.

export function buildBoardMonthParams(selectedDate, { search = '', advFilters = {} } = {}) {
  let hCurrent;
  try {
    hCurrent = new HDate(selectedDate);
  } catch (e) {
    hCurrent = new HDate(new Date());
  }

  const firstDayHDate = new HDate(1, hCurrent.getMonth(), hCurrent.getFullYear());
  const lastDayHDate = new HDate(hCurrent.daysInMonth(), hCurrent.getMonth(), hCurrent.getFullYear());

  const fromDate = new Date(firstDayHDate.greg());
  fromDate.setDate(fromDate.getDate() - 14);

  const toDate = new Date(lastDayHDate.greg());
  toDate.setDate(toDate.getDate() + 14);

  const queryParams = new URLSearchParams({
    eventDateFrom: fromDate.toISOString(),
    eventDateTo: toDate.toISOString(),
    filterStatus: 'all',
    limit: '2000'
  });

  if (search) queryParams.append('search', search);

  Object.entries(advFilters).forEach(([k, v]) => {
    if (v) queryParams.append(k, v);
  });

  return queryParams;
}

// ===== זיכויים (/refunds) =====

export const REFUNDS_PAGE_SIZE = 50;

// ===== רישום ה-prefetchers =====
// כל prefetcher מחמם את ה-namespace/המפתח שדף היעד יקרא ממנו במצב ברירת המחדל.
// שמירה למטמון רק אחרי אימות צורת התשובה — prefetch כושל לא משאיר זבל שדף יציג.

function warm(namespace, key, url, isValid, normalize) {
  const ns = cacheNamespace(namespace);
  if (ns.has(key)) return; // כבר חם (מביקור קודם או מ-prefetch קודם)
  fetchJson(url, { cache: 'no-store' })
    .then((data) => {
      if (!isValid(data)) return;
      ns.set(key, normalize ? normalize(data) : data);
    })
    .catch(() => {}); // prefetch הוא נטו אופטימיזציה — כשל שקט
}

const routePrefetchers = {
  // orders ו-dashboard/dresses קוראים מ-lib/apiCache (המטמון המשותף עם
  // invalidation אוטומטי על מוטציות), לכן החימום שלהם עובר דרכו — אותו URL
  // בדיוק שהדף עצמו יבקש. שאר הדפים עדיין קוראים מ-pageCache namespaces.
  '/orders': () => {
    const key = buildOrdersListParams().toString();
    fetchSharedJson(`/api/orders?${key}`, { ttl: TTL.LIST }).catch(() => {});
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC }).catch(() => {}); // inventory_hold_minutes
  },
  '/customers': () => {
    const key = buildCustomersListParams().toString();
    warm('customers', key, `/api/customers?${key}`, (d) => d && Array.isArray(d.data));
  },
  '/alterations': () => {
    const url = buildAlterationsListUrl();
    warm('alterations', url, url, (d) => d && Array.isArray(d.data));
  },
  '/dashboard/dresses': () => {
    const key = buildDressesListParams().toString();
    // ב-apiCache נשמרת התשובה הגולמית — הדף מנרמל אותה בקריאה, לא בשמירה.
    fetchSharedJson(`/api/dresses?${key}`, { ttl: TTL.LIST }).catch(() => {});
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC }).catch(() => {});
  },
  '/board': () => {
    const key = buildBoardMonthParams(new Date()).toString();
    warm('board', key, `/api/orders?${key}`,
      (d) => d && (Array.isArray(d.data) || Array.isArray(d.orders)));
  },
  '/rentals': () => {
    const key = buildRentalsListParams().toString();
    warm('rentals', key, `/api/orders?${key}`, (d) => d && Array.isArray(d.data));
  },
  '/refunds': () => {
    warm('refunds', 'refunds', `/api/refunds?page=1&limit=${REFUNDS_PAGE_SIZE}`,
      (d) => d && Array.isArray(d.data));
  },
};

export function prefetchRoute(path) {
  const prefetcher = routePrefetchers[path];
  if (prefetcher) prefetcher();
}

export function isPrefetchableRoute(path) {
  return !!routePrefetchers[path];
}

// "שכנים" — לאילו דפים סביר שהמשתמש ימשיך מכל דף, לחימום ברקע אחרי הטעינה.
const ROUTE_NEIGHBORS = {
  '/': ['/orders', '/customers'],
  '/orders': ['/customers', '/board', '/rentals'],
  '/customers': ['/orders'],
  '/board': ['/orders'],
  '/rentals': ['/orders'],
  '/alterations': ['/orders'],
  '/refunds': ['/orders'],
  '/dashboard/dresses': ['/orders'],
};

export function prefetchNeighbors(pathname) {
  (ROUTE_NEIGHBORS[pathname] || []).forEach(prefetchRoute);
}
