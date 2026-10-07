'use client';

// תחתית האתר הכחולה בכל דפי המעטפת החדשה (בקשת הבעלים 7.10.2026: "אין בסוף הגלילה את הבאנר התחתון הכחול כמו בדף ראשי").
// עד עכשיו התחתית (HomeFooter) נרשמה רק בתוך דף הבית; כאן היא מרונדרת פעם אחת במעטפת, אחרי תוכן הדף, כך שהיא בסוף הגלילה
// בכל דף. דף הבית ("/") מציג את התחתית שלו בעצמו (HomeA5) ולכן מדולג כאן - אחרת היו שתיים.
//
// הנתונים בלי קריאות שרת נוספות בטעינת הדף: הקישורים מעץ התפריט שהמעטפת כבר מחזיקה (אותם כללי הרשאה, ר' footerGroups
// ב-homeLogic.js), שם הגמ״ח מ-tree.brand, הגרסה והתאריך מ-app/version.json (נכנס עם הבנייה). רק חלון "מדיניות פרטיות"
// צריך את הגדרות הארגון (gmach_name / gmach_phone) - הן נשלפות מ-/api/a5/boot (מטמון משותף) רק כשלוחצים על הקישור.
// בהדפסה התחתית מוסתרת (shellFooter.css).

import './shellFooter.css';
import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { flattenMenuTree } from '@/lib/menu/buildMenuTree';
import { HomeFooter, PrivacyDialog } from '../home/HomeFooter';
import { footerGroups } from '../home/homeLogic';
import versionData from '../../version.json';

const pathOf = (href) => String(href || '').split(/[?#]/)[0];

export default function ShellFooter({ tree }) {
  const pathname = usePathname();
  const [privacy, setPrivacy] = useState(null); // null = סגור; { settings } = פתוח
  const groups = useMemo(() => {
    const items = flattenMenuTree(tree).map((x) => ({ href: pathOf(x.href) })).filter((x) => x.href);
    return footerGroups({
      navGroups: [{ items }],
      isHead: !!(tree && tree.meta && tree.meta.head),
      authenticated: !!(tree && tree.user && tree.user.logged),
    });
  }, [tree]);
  const openPrivacy = useCallback(() => {
    fetchSharedJson('/api/a5/boot', { ttl: TTL.STATIC })
      .then((b) => setPrivacy({ settings: (b && b.settings) || {} }))
      .catch(() => setPrivacy({ settings: {} }));
  }, []);
  const closePrivacy = useCallback(() => setPrivacy(null), []);

  if (pathname === '/') return null;
  const name = tree && tree.brand && tree.brand.name;
  return (
    <div className="gm-ds gm-shellfoot">
      <HomeFooter groups={groups} name={name} version={versionData.version} date={versionData.date} onPrivacy={openPrivacy} />
      {privacy ? <PrivacyDialog onClose={closePrivacy} settings={privacy.settings} /> : null}
    </div>
  );
}
