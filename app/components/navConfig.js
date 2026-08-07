// Static real-route sidebar nav, grouped like the design-v2 mockup's NAV
// (scratch/design-v2/build.js). Dynamic-id detail routes (order/customer/
// employee/dress detail), print views (opened with context, not browsed
// standalone), and system pages (404/no-access) are intentionally excluded —
// a static sidebar link can't target a parameterized or contextual route.
// `gate` names a boolean computed in layout.js; omit for always-visible items.
export const NAV_GROUPS = [
  {
    key: 'general',
    label: 'כללי',
    items: [
      { href: '/', label: 'בית וחיפוש', icon: 'i-home' },
      { href: '/dashboard', label: 'לוח בקרה', icon: 'i-grid' },
      { href: '/messages', label: 'הודעות', icon: 'i-message', gate: 'showMessages' },
      { href: '/profile', label: 'הפרופיל שלי', icon: 'i-user' },
      { href: '/punch-clock', label: 'שעון נוכחות', icon: 'i-clock' },
      { href: '/display-settings', label: 'עיצוב ותצוגה', icon: 'i-settings' },
    ],
  },
  {
    key: 'orders',
    label: 'הזמנות',
    items: [
      { href: '/orders', label: 'רשימת הזמנות', icon: 'i-file' },
      { href: '/orders/new', label: 'הזמנה חדשה', icon: 'i-plus' },
      { href: '/rentals', label: 'השכרות והחזרות', icon: 'i-truck' },
      { href: '/refunds', label: 'זיכויים וחובות', icon: 'i-wallet', gate: 'showRefundsTab' },
      { href: '/alterations', label: 'תיקונים', icon: 'i-scissors', gate: 'enableAlterations' },
    ],
  },
  {
    key: 'inventory',
    label: 'מלאי',
    items: [
      { href: '/dashboard/dresses', label: 'קטלוג דגמים', icon: 'i-bag' },
      { href: '/dashboard/pricelist', label: 'מחירון', icon: 'i-coin' },
    ],
  },
  {
    key: 'people',
    label: 'אנשים',
    items: [
      { href: '/customers', label: 'לקוחות', icon: 'i-users' },
      { href: '/employees', label: 'עובדים ונוכחות', icon: 'i-user-check', gate: 'showEmployeesTab' },
      { href: '/employees/report', label: 'דוח נוכחות', icon: 'i-activity', gate: 'showEmployeesTab' },
      { href: '/board', label: 'לוח חודשי', icon: 'i-calendar' },
      { href: '/customer-interface', label: 'עמדת לקוח', icon: 'i-eye' },
    ],
  },
  {
    key: 'admin',
    label: 'ניהול',
    gate: 'showAdminTab',
    items: [
      { href: '/admin', label: 'לוח ניהול', icon: 'i-shield' },
      { href: '/admin/ai', label: 'עוזר AI', icon: 'i-star' },
      { href: '/admin/ai-history', label: 'היסטוריית AI', icon: 'i-history' },
      { href: '/admin/statistics', label: 'סטטיסטיקות', icon: 'i-activity' },
      { href: '/admin/inventory-alerts', label: 'התראות מלאי', icon: 'i-alert-tri' },
      { href: '/admin/recalculations', label: 'התאמות תשלום', icon: 'i-refresh' },
      { href: '/admin/settings', label: 'הגדרות מערכת', icon: 'i-settings' },
      { href: '/admin/settings/preview', label: 'תצוגה מקדימה', icon: 'i-eye' },
      { href: '/admin/refund-policy', label: 'מדיניות זיכויים', icon: 'i-file' },
      { href: '/admin/labels', label: 'תוויות שדות', icon: 'i-tag' },
      { href: '/admin/trusted-devices', label: 'מכשירים מהימנים', icon: 'i-shield' },
      { href: '/admin/audit-system', label: 'מערכת ביקורת', icon: 'i-shield' },
      { href: '/admin/data-explorer', label: 'חוקר נתונים', icon: 'i-database' },
      { href: '/admin/data-explorer/full-view', label: 'תצוגה מלאה', icon: 'i-database' },
      { href: '/admin/access-import', label: 'ייבוא מ-Access', icon: 'i-upload' },
      { href: '/admin/data-history', label: 'היסטוריית נתונים', icon: 'i-history' },
      { href: '/admin/database', label: 'גיבוי בסיס נתונים', icon: 'i-database' },
      { href: '/admin/setup-new-machine', label: 'התקנה במחשב חדש', icon: 'i-settings' },
      { href: '/management/database', label: 'איפוס נתונים', icon: 'i-database' },
      { href: '/management/email-logs', label: 'יומן מיילים', icon: 'i-mail' },
      { href: '/management/history', label: 'יומן פעילות', icon: 'i-history' },
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
