import { handleUiVariantGet } from '@/app/lib/uiVariantRoute';

// GET /api/me/ui-variant — { success, canSelfSwitch, screens }: האם העובד המחובר (הנהלה ראשית / מתכנת) רשאי לעבור בעצמו
// בין העיצוב הישן לחדש. קריאה בלבד; ההחלטה נעשית בשרת לפי Employee.roleId, וה-POST אוכף אותה מחדש.
export async function GET() {
  return handleUiVariantGet();
}
