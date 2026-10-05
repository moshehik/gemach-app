// /profile — "הפרופיל שלי" של העובד המחובר (עיצוב מאושר 3.10.2026: תצוגות-עיצוב/פרופיל-עובד.html, רכיבי פלטה בלבד).
// הדף נטען בנפרד (dynamic) כדי שקובץ ה-CSS הגדול של הפלטה לא ייכנס ל-bundle של שאר הדפים;
// הלוגיקה והקריאות ל-API: app/components/profile/ProfilePage.js (GET/PUT /api/me/profile, POST /api/employees/<id>/password).
//
// "ישן / חדש" (4.10.2026, lib/uiVariantScreens.js מסך 'profile'): ההכרעה בשרת (getRequestUiVariant — עקיפה אישית > הגדרת ארגון
// ui_variant_profile > ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן). הישן: LegacyProfilePage.js (7917382f^:app/profile/page.js
// כפי שהוא). VariantFrame מוסיף בישן את אייקון המעבר בפינה; בחדש האייקון בכותרת ProfilePage.
import ProfileSwitch from '@/app/components/profile/ProfileSwitch';
import VariantFrame from '@/app/components/variant/VariantFrame';
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import LegacyProfilePage from './LegacyProfilePage';

export default async function MyProfileRoute() {
  const variant = await getRequestUiVariant('profile');
  return (
    <VariantFrame screen="profile" variant={variant}>
      {variant === 'legacy' ? <LegacyProfilePage /> : <ProfileSwitch />}
    </VariantFrame>
  );
}
