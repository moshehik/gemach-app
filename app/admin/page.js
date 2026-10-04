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
import { GATE_ROLES, selectHub } from '@/lib/adminHubCatalog';
import AdminHubSwitch from '@/app/components/admin-hub/AdminHubSwitch';

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

export default async function AdminHubPage() {
  const [head, dev, headOnly, me, nedarim, deliveries] = await Promise.all([
    checkPageAccess(HEAD_MANAGEMENT_ROLES),
    checkPageAccess(DEVELOPER_ONLY_ROLES),
    checkPageAccess(GATE_ROLES.headOnly),
    getSessionEmployee(),
    nedarimEnabled(),
    deliveriesEnabled(),
  ]);
  const { tools, categories } = selectHub({ head, dev, headOnly }, { nedarimEnabled: nedarim, deliveriesEnabled: deliveries });
  return <AdminHubSwitch tools={tools} categories={categories} userKey={me ? me.id : null} />;
}
