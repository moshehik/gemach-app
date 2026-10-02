'use client';

// שעון הנוכחות (רישום כניסה / יציאה למשמרת בלי להיכנס למערכת). בעיצוב דף הכניסה החדש (PunchClockNew) כברירת מחדל;
// אותו מתג כמו דף הכניסה: SystemSetting login_page_new = 'false' מחזיר את הדף הישן (PunchClockLegacy), בלי פריסה מחדש.
// הערך מגיע מ-app/layout.js דרך LoginVariantProvider (אותה הכרעה שמשמשת את דף הכניסה).

import { useLoginVariant } from '@/app/components/login/LoginGate';
import PunchClockNew from '@/app/components/login/PunchClockNew';
import PunchClockLegacy from './PunchClockLegacy';

export default function PunchClockPage() {
  const { useNew, brand } = useLoginVariant();
  if (useNew === false) return <PunchClockLegacy />;
  return <PunchClockNew brand={brand} />;
}
