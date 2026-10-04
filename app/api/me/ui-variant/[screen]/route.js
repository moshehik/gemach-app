import { NextResponse } from 'next/server';
import { handleUiVariantPost } from '@/app/lib/uiVariantRoute';
import { isSelfSwitchScreen } from '@/lib/uiVariantSelfSwitch';

// POST /api/me/ui-variant/<screen> — מעבר עצמאי "ישן / חדש" לכל מסך שברשומה המרכזית (lib/uiVariantScreens.js) מסומן selfSwitch
// ושתי הגרסאות שלו קיימות (4.10.2026: profile, admin_hub, attendance, error_report; shell / home נשארים בנתיבים הסטטיים שלהם,
// שגוברים על הנתיב הדינמי הזה ומתנהגים בדיוק אותו דבר). אותה ליבה בדיוק (lib/uiVariantSelfSwitch.js): הנהלה ראשית / מתכנת בלבד,
// לרשומה של עצמם בלבד (התפקיד מה-DB, העובד מהעוגייה המאומתת), גוף: { value: 'a5' | 'legacy' | null }.
// מסך לא מוכר / שלא ניתן להחלפה -> 404 עוד לפני שנוגעים בעוגייה או ב-DB.
export async function POST(request, { params }) {
  const { screen } = (await params) || {};
  if (!isSelfSwitchScreen(screen)) {
    return NextResponse.json({ success: false, error: 'המסך הזה לא ניתן להחלפה בין ישן לחדש' }, { status: 404 });
  }
  return handleUiVariantPost(request, screen);
}
