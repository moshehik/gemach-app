'use client';

// /dashboard/dresses/[id] - כרטיס הדגם. עטיפה דקה בלבד: הבחירה בין הכרטיס הישן (LegacyDressCardPage.js, הקוד הקודם של הקובץ הזה,
// הועבר כמו שהוא) לבין כרטיס ה-A5 החדש נעשית ב-DressCardSwitch לפי useUiVariant('model_card'). ברירת המחדל (אין שורת
// ui_variant_model_card) = 'legacy' = הכרטיס הישן בדיוק כמו קודם; המתכנת מקבל את החדש (newExists ב-lib/uiVariantScreens.js).
// /dashboard/dresses/new (אשף דגם חדש) ממשיך להיות מוגש מהקובץ הישן בשתי הגרסאות.
import DressCardSwitch from '@/app/components/dress-card/DressCardSwitch';

export default function DressCardRoute({ params }) {
  return <DressCardSwitch params={params} />;
}
