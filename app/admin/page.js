// /admin — "מסך ניהול ראשי" בעיצוב המאושר (תצוגות-עיצוב/ניהול-ראשי-כרטיסים.html, תשובות הבעלים 4.10.2026).
// הנתיב דק: השרת מחליט אילו כלים מוצגים, עם אותה פונקציה שהדפים עצמם בודקים (checkPageAccess + מערכי התפקיד של lib/auth.js),
// ומעביר לרכיב רק את אובייקטי הכלים המותרים והקטגוריות שלהם — הקטלוג המלא (lib/adminHubCatalog.js, כולל כלי המתכנת והשערים)
// לא מיובא בשום קוד לקוח ולא נשלח לדפדפן (נבדק ב-scripts/test_admin_hub.mjs).
// נדרים פלוס: הקטגוריה מוסתרת כש-nedarim_plus_enabled === 'false' (אותה מוסכמה כמו app/orders/new/page.js; ברירת מחדל פעיל).
// משלוחים: האריח מוצג רק כש-enable_deliveries === 'true' (כמו התפריט, navConfig.js showDeliveries; כשל-סגור).
// הדף נטען בנפרד (dynamic, כמו /profile) כדי שקובץ ה-CSS הגדול של הפלטה לא ייכנס ל-bundle של שאר הדפים.
// השער של האזור כולו (הנהלה ראשית / מתכנת) נשאר ב-app/admin/layout.js.
import { checkPageAccess, getSessionEmployee, HEAD_MANAGEMENT_ROLES, DEVELOPER_ONLY_ROLES } from '@/lib/auth';
import { getCachedSetting } from '@/lib/settingsCache';
import { selectHub } from '@/lib/adminHubCatalog';
import AdminHubSwitch from '@/app/components/admin-hub/AdminHubSwitch';
import VariantFrame from '@/app/components/variant/VariantFrame';
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import LegacyAdminPage from './LegacyAdminPage';

export const dynamic = 'force-dynamic';

async function nedarimEnabled() {
  try {
    const s = await getCachedSetting('nedarim_plus_enabled');
    return !(s && s.value === 'false');
  } catch {
    return true; // תקלת DB: כמו היום (בלי הסתרה); הדפים עצמם נשארים בשער שלהם
  }
}

async function deliveriesEnabled() {
  try {
    const s = await getCachedSetting('enable_deliveries');
    return !!(s && s.value === 'true');
  } catch {
    return false; // תקלת DB: בלי האריח (כמו התפריט כשההגדרות לא נטענו)
  }
}

// "ישן / חדש" (4.10.2026, lib/uiVariantScreens.js מסך 'admin_hub'): ההכרעה בשרת (getRequestUiVariant — עקיפה אישית > הגדרת ארגון
// ui_variant_admin_hub > ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן). הישן: LegacyAdminPage.js (079fc226^1:app/admin/page.js כפי
// שהוא, עם EmailListCard / AdminHubA5Cards / FullEmailListModal בנתיבים המקוריים). בישן לא מחושבים השערים של המסך החדש.
export default async function AdminHubPage() {
  if ((await getRequestUiVariant('admin_hub')) === 'legacy') {
    // כרטיס "ניהול אתר" רק למתכנת - אותו שער כמו app/admin/site/layout.js (אחרת הוא מחזיר את ההנהלה ל-/admin: קישור מת).
    const showSite = await checkPageAccess(DEVELOPER_ONLY_ROLES);
    return (
      <VariantFrame screen="admin_hub" variant="legacy">
        <LegacyAdminPage showSite={showSite} />
      </VariantFrame>
    );
  }
  const [head, dev, me, nedarim, deliveries] = await Promise.all([
    checkPageAccess(HEAD_MANAGEMENT_ROLES),
    checkPageAccess(DEVELOPER_ONLY_ROLES),
    getSessionEmployee(),
    nedarimEnabled(),
    deliveriesEnabled(),
  ]);
  const { tools, categories } = selectHub({ head, dev }, { nedarimEnabled: nedarim, deliveriesEnabled: deliveries });
  return (
    <VariantFrame screen="admin_hub" variant="a5">
      <AdminHubSwitch tools={tools} categories={categories} userKey={me ? me.id : null} />
    </VariantFrame>
  );
}
