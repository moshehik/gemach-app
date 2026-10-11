import { handleUiVariantGet } from '@/app/lib/uiVariantRoute';

// GET /api/me/ui-variant — { success, canSelfSwitch, screens }: האם העובד המחובר (כל עובד פעיל, החלטת הבעלים 11.10.2026) רשאי לעבור בעצמו
// בין העיצוב הישן לחדש. קריאה בלבד; ההחלטה נעשית בשרת מה-DB (canEmployeeSelfSwitch), וה-POST אוכף אותה מחדש.
export async function GET() {
  return handleUiVariantGet();
}
