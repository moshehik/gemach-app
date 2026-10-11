import { handleUiVariantPost } from '@/app/lib/uiVariantRoute';

// POST /api/me/ui-variant/home — המעבר העצמאי של דף הבית בין הישן לחדש. כל עובד פעיל (החלטת הבעלים 11.10.2026), לרשומה של עצמו בלבד
// (לא מחובר: 401, מושבת: 403). גוף: { value: 'a5' | 'legacy' | null }. ר' app/api/me/ui-variant/shell/route.js ו-lib/uiVariantSelfSwitch.js.
export async function POST(request) {
  return handleUiVariantPost(request, 'home');
}
