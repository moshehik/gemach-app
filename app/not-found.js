import ErrorPage from './components/error-pages/ErrorPage';

// 404 הגלובלי (מוסכמת Next: app/not-found.js) - עמוד השגיאה של האתר (זכוכית שקופה, שני קישורים בלבד). רינדור בתוך AppShell דרך app/layout.js.
export default function NotFound() {
  return <ErrorPage code="404" title="הדף לא נמצא" text="הקישור שגוי או שהדף הוסר." icon="search" />;
}
