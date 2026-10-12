// lib/modelDisplayServer.js - קריאת ההגדרה useModelNames בצד השרת (מטמון 30 שנ' של lib/settingsCache.js) לשימוש lib/modelDisplay.js.
// useModelNames === false (נווה יעקב) -> מספר דגם בלבד בכל מסמך / תיאור / מייל; אחרת שם תיאורי אמיתי אם יש, ואם לא - מספר.
// שגיאת DB לא שוברת תצוגה: במקרה כזה מחזירים {} (התנהגות ברירת המחדל - שם אמיתי או מספר).
import { getCachedSetting } from '@/lib/settingsCache';
import { modelNamesEnabled } from '@/lib/modelDisplay';

/** @returns {Promise<{useModelNames?: boolean}>} */
export async function getModelDisplayOpts(client) {
  try {
    const row = await getCachedSetting('useModelNames', client);
    return { useModelNames: modelNamesEnabled(row ? row.value : undefined) };
  } catch {
    return {};
  }
}
