import { handleUiVariantPost } from '@/app/lib/uiVariantRoute';

// POST /api/me/ui-variant/shell — "האתר הישן" (האייקון בסרגל התפריט החדש) + המעבר העצמאי של ההנהלה (דף "עיצוב ותצוגה").
//
// גוף: { value: 'legacy' } → עקיפה אישית: התפריט חוזר לישן לעובד הזה בלבד, בלי קשר להגדרת הארגון.
//      { value: null }     → ביטול העקיפה האישית (חוזרים להגדרת הארגון ui_variant_shell).
//      { value: 'a5' }     → התפריט החדש — מותר רק להנהלה ראשית / מתכנת (התפקיד נקבע בשרת מה-DB); כל אחד אחר מקבל 403.
// זה החריג המבוקר לכלל "uiVariants נקבעים רק ע"י הבעלים (scripts/set-ui-variant.js)": PUT /api/me/design-prefs
// ממשיך למחוק uiVariants. כל הכללים והבדיקות בליבה הטהורה lib/uiVariantSelfSwitch.js; החיבור ל-cookie / prisma ב-app/lib/uiVariantRoute.js.
// מזוהה אך ורק לפי העוגייה — אין פרמטר id, עובד לא יכול לשנות לעובד אחר.
export async function POST(request) {
  return handleUiVariantPost(request, 'shell');
}
