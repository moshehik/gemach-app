// תחליף ל-next/dynamic בחבילת הבדיקה: טעינה עצלה רגילה של React (ה-import הדינמי נארז ע"י esbuild לאותו קובץ)
import React, { Suspense } from 'react';
export default function dynamic(loader) {
  const Lazy = React.lazy(() => loader().then((m) => ({ default: m.default || m })));
  return function Dyn(props) { return React.createElement(Suspense, { fallback: null }, React.createElement(Lazy, props)); };
}
