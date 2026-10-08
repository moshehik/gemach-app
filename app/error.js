'use client';

import { useEffect } from 'react';
import ErrorPage from './components/error-pages/ErrorPage';

// שגיאת רינדור בלתי צפויה בדף (מוסכמת Next: app/error.js, בתוך ה-layout) - עמוד השגיאה של האתר, בלי פרטים טכניים בתצוגה.
export default function Error({ error }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorPage code="500" title="תקלה בשרת" text="משהו השתבש אצלנו." icon="alert-tri" />;
}
