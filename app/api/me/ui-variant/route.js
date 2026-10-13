import { handleUiVariantGet, handleUiVariantPostAll } from '@/app/lib/uiVariantRoute';

// GET /api/me/ui-variant — { success, canSelfSwitch, screens }: האם העובד המחובר (כל עובד פעיל, החלטת הבעלים 11.10.2026) רשאי לעבור בעצמו
// בין העיצוב הישן לחדש. קריאה בלבד; ההחלטה נעשית בשרת מה-DB (canEmployeeSelfSwitch), וה-POST אוכף אותה מחדש.
export async function GET() {
  return handleUiVariantGet();
}

// POST /api/me/ui-variant { value: 'a5' | 'legacy' } — כל המסכים בבת אחת (12.10.2026): לחצן "חזרה לממשק החדש" בכותרת הממשק הישן
// ו"האתר הישן" בתפריט החדש. אותן הרשאות כמו מעבר של מסך בודד (/api/me/ui-variant/<screen>), תמיד על העובד המאומת עצמו.
export async function POST(request) {
  return handleUiVariantPostAll(request);
}
