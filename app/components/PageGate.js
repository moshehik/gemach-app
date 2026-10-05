import NoAccessMessage from '@/app/components/NoAccessMessage';
import { canOpenAnyPage } from '@/lib/permissions';

// Server-side page guard driven by the permissions catalog (/admin/permissions, "page:*" items):
// renders the page only when the current employee may open it (lib/permissions.js canOpenPage),
// otherwise the standard "no access" card. Use it from a layout.js:
//   <PageGate pageKey="page:customers">{children}</PageGate>
// A surface that several regular pages reach (the print routes - see lib/printAccess.js) passes
// `pageKeys` instead: rendered when the employee may open ANY of them.
// `fallback` (optional): what to render instead of the legacy "no access" card - a page that was moved to the new
// design passes its own window (app/board/layout.js -> BoardGate). Without it nothing changes.
export default async function PageGate({ pageKey, pageKeys, fallback, children }) {
  const keys = pageKeys || [pageKey];
  if (!(await canOpenAnyPage(keys))) {
    return fallback || <NoAccessMessage />;
  }
  return children;
}
