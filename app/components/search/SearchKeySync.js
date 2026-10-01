'use client';

// מדווח להורה את מחרוזת ה-query של הכתובת (useSearchParams) בכל שינוי — גם שינוי ללא ניווט (history.replaceState / pushState של Next).
// useSearchParams חייב לשבת בתוך <Suspense> (אחרת בנייה של עמוד סטטי נופלת: "useSearchParams() should be wrapped in a suspense boundary",
// כמו שהעטיפה של PageTracker ב-app/layout.js), ולכן ההורה מרנדר את הרכיב הזה עטוף ב-Suspense במקום לקרוא ל-hook בעצמו.
//   <Suspense fallback={null}><SearchKeySync onKey={setKey} /></Suspense>
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SearchKeySync({ onKey }) {
  const sp = useSearchParams();
  const key = sp ? sp.toString() : '';
  useEffect(() => { onKey(key); }, [key, onKey]);
  return null;
}
