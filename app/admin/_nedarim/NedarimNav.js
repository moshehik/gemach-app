'use client';

import Link from 'next/link';

// ניווט משותף בין דפי ניהול ההו"ק בנדרים פלוס - לא route משלו (התיקייה מתחילה
// ב-_ כדי ש-Next.js לא יתייחס אליה כ-route), רק import משותף לחמשת הדפים.
export const NEDARIM_NAV = [
  { href: '/admin/nedarim-hok-list', label: 'רשימת הוק' },
  { href: '/admin/nedarim-hok-search', label: 'חיפוש בהוק' },
  { href: '/admin/nedarim-hok-edit', label: 'שינוי הו"ק' },
  { href: '/admin/nedarim-payments-recent', label: 'תשלומים אחרונים' },
  { href: '/admin/nedarim-hok-test', label: 'יצירת הוק (ניסוי)' },
];

export default function NedarimNav({ current }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {NEDARIM_NAV.map((n) => (
        <Link key={n.href} href={n.href} className={`btn btn-sm ${n.href === current ? 'btn-primary' : ''}`}>
          {n.label}
        </Link>
      ))}
    </div>
  );
}
