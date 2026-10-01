import { handleUiVariantPost } from '@/app/lib/uiVariantRoute';

// POST /api/me/ui-variant/home — המעבר העצמאי של דף הבית בין הישן לחדש. הנהלה ראשית / מתכנת בלבד, לרשומה של עצמם בלבד
// (כל שאר העובדים: 403). גוף: { value: 'a5' | 'legacy' | null }. ר' app/api/me/ui-variant/shell/route.js ו-lib/uiVariantSelfSwitch.js.
export async function POST(request) {
  return handleUiVariantPost(request, 'home');
}
