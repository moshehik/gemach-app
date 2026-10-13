'use client';

// useEnterNavigation - מעבר בין שדות ב-Enter בטופס (ר' lib/enterNavigation.js לכללים המלאים).
//
// שימוש:
//   const onKeyDown = useEnterNavigation(() => save());        // onSubmit נקרא ב-Enter בשדה האחרון (אופציונלי)
//   <form onKeyDown={onKeyDown}> ... </form>                    // או כל אלמנט שמכיל את השדות (div / section)
// הטיפול בהאצלה (bubbling): הוא רץ אחרי מטפלי המקלדת של השדות עצמם (למשל בחירת הצעה ברשימה קוראת preventDefault ולכן Enter לא מקדם באותה לחיצה).
// בטופס שהתוכן שלו מוצג דרך wrapper בלי אלמנט משלו - אפשר <div style={{ display: 'contents' }} onKeyDown={onKeyDown}>.
//
// עבור טופס הרישום בעמדת הלקוח (app/customer-interface): אותו שימוש בדיוק; ה-hook לא תלוי בעיצוב ולא בפלטה.
import { useCallback, useEffect, useRef } from 'react';
import { handleEnterKey } from '@/lib/enterNavigation';

export default function useEnterNavigation(onSubmit) {
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);
  return useCallback((event) => {
    const fn = submitRef.current;
    handleEnterKey(event, { container: event.currentTarget, onSubmit: typeof fn === 'function' ? () => fn() : undefined });
  }, []);
}

export { handleEnterKey };
