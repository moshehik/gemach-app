// Static real-route sidebar nav — intentionally trimmed (2026-08-08) to exactly
// the pages that were reachable from the OLD pre-redesign navbar (app/layout.js
// on `main`: AppNavLinks.js's text links + the 4 icon-only links in the navbar's
// right-hand cluster), using the NEW design-v2 labels/icons rather than the old
// navbar's wording. Every route that's NOT in that old-navbar set was moved out
// of the sidebar rather than deleted: general/personal-utility pages (dashboard,
// messages, profile, punch-clock, display-settings, new-order, pricelist,
// employee-attendance-report) are now quick-link cards on the home page
// (app/page.js); every admin/management sub-page is a card on the admin hub
// (app/admin/page.js) — that hub already covered most of them from wave 4, a
// few were added there for the ones that had no home yet. Dynamic-id detail
// routes (order/customer/employee/dress detail), print views (opened with
// context, not browsed standalone), and system pages (404/no-access) are still
// excluded — a static sidebar link can't target a parameterized route.
// `gate` names a boolean computed in layout.js; omit for always-visible items.
export const NAV_GROUPS = [
  {
    key: 'general',
    label: 'כללי',
    items: [
      { href: '/', label: 'בית וחיפוש', icon: 'i-home' },
    ],
  },
  {
    key: 'orders',
    label: 'הזמנות',
    items: [
      // מעל "רשימת הזמנות" בכוונה (2026-09-09, בקשת משתמשת) - במקום שיהיה נגיש רק
      // כקישור מהיר במרכז דף הבית, זמין תמיד מהסיידבר.
      { href: '/orders/new', label: 'הזמנה חדשה', icon: 'i-plus' },
      { href: '/orders', label: 'רשימת הזמנות', icon: 'i-file' },
      { href: '/rentals#rented', label: 'השכרות', icon: 'i-truck' },
      { href: '/rentals#returned', label: 'החזרות', icon: 'i-check' },
      { href: '/deliveries', label: 'משלוחים', icon: 'i-box', gate: 'showDeliveries' },
      { href: '/refunds', label: 'זיכויים וחובות', icon: 'i-wallet', gate: 'showRefundsTab' },
      { href: '/alterations', label: 'תיקונים', icon: 'i-scissors', gate: 'enableAlterations' },
    ],
  },
  {
    key: 'inventory',
    label: 'מלאי',
    items: [
      { href: '/dashboard/dresses', label: 'קטלוג דגמים', icon: 'i-bag', gate: 'showDressesTab' },
    ],
  },
  {
    key: 'people',
    // בלי label גלוי (2026-09-09, בקשת משתמשת) - עדיין קבוצה נפרדת בסיידבר, רק בלי
    // כותרת "אנשים" מעל הפריטים.
    label: '',
    items: [
      { href: '/customers', label: 'לקוחות', icon: 'i-users' },
      { href: '/employees', label: 'עובדים ונוכחות', icon: 'i-user-check', gate: 'showEmployeesTab' },
      { href: '/board', label: 'לוח חודשי', icon: 'i-calendar', gate: 'showBoardTab' },
      { href: '/customer-interface', label: 'עמדת לקוח', icon: 'i-eye' },
    ],
  },
  {
    key: 'admin',
    label: 'ניהול',
    gate: 'showAdminTab',
    items: [
      { href: '/admin', label: 'לוח ניהול', icon: 'i-shield' },
    ],
  },
];

export function buildNavGroups(flags) {
  return NAV_GROUPS
    .filter((group) => !group.gate || flags[group.gate])
    .map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items
        .filter((item) => !item.gate || flags[item.gate])
        .map((item) => ({ ...item, groupLabel: group.label })),
    }))
    .filter((group) => group.items.length > 0);
}
