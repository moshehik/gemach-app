'use client';

// כרטיסי "משלוחים" ו"זיכויים וחובות" במסך הניהול הראשי (/admin) - מוצגים רק במעטפת החדשה (useUiVariant('shell') === 'a5').
// בתפריט החדש שני הדפים האלה הוצאו מהסרגל הצדדי הישן (R09/R10) ועברו לאזור הניהול; כאן הכניסה השנייה אליהם.
// הנראות היא בדיוק של שורות התפריט ("ניהול") בעץ שהשרת חישב (lib/menu/buildMenuTree.js): משלוחים רק כש-enable_deliveries
// ו-page:deliveries, זיכויים לפי page:refunds - כך שאין כאן כלל הרשאה משלו. במעטפת 'legacy' הרכיב מחזיר null והדף נשאר כפי שהיה.

import Link from 'next/link';
import { useUiVariant } from '../UiVariantContext';
import { useA5Shell } from './A5ShellContext';
import { flattenMenuTree } from '@/lib/menu/buildMenuTree';

const CARDS = [
  { href: '/deliveries', icon: 'i-box', label: 'משלוחים', desc: 'ניהול ומעקב משלוחי השמלות ללקוחות ובחזרה' },
  { href: '/refunds', icon: 'i-wallet', label: 'זיכויים וחובות', desc: 'ניהול זיכויים ומעקב חובות פתוחים' },
];

export default function AdminHubA5Cards() {
  const variant = useUiVariant('shell');
  const shell = useA5Shell();
  if (variant !== 'a5' || !shell || !shell.menuTree) return null;
  const allowed = new Set(flattenMenuTree(shell.menuTree).filter((x) => x.kind === 'link' && x.href).map((x) => x.href));
  const cards = CARDS.filter((c) => allowed.has(c.href));
  if (!cards.length) return null;
  return (
    <>
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="list-card"
          style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '28px', gap: '14px' }}
        >
          <div className="kpi-icon" style={{ width: '52px', height: '52px', background: 'var(--primary-tint)', color: 'var(--primary)' }}>
            <svg className="icon" style={{ width: '24px', height: '24px' }}><use href={`#${card.icon}`} /></svg>
          </div>
          <div>
            <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>{card.label}</h2>
            <p className="page-desc" style={{ marginTop: 0 }}>{card.desc}</p>
          </div>
        </Link>
      ))}
    </>
  );
}
