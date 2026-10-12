'use client';

// HideOnKioskBare - עוטף רכיבי צוות גלובליים של ה-layout (באנרי סביבה, דיבאג לוח, חלון "משלוח משותף") ומסתיר אותם בעמדת הלקוח.
// נקרא בלקוח לפי usePathname (גם ב-SSR של הבקשה), ולכן עובד גם בניווט רך אל העמדה שבו ה-layout לא מרונדר מחדש (lib/shellBare.js).

import { usePathname } from 'next/navigation';
import { isKioskBarePath } from '@/lib/shellBare';

export default function HideOnKioskBare({ children }) {
  const pathname = usePathname();
  if (isKioskBarePath(pathname)) return null;
  return <>{children}</>;
}
