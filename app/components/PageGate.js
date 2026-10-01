import NoAccessMessage from '@/app/components/NoAccessMessage';
import { canOpenAnyPage } from '@/lib/permissions';

// Server-side page guard driven by the permissions catalog (/admin/permissions, "page:*" items):
// renders the page only when the current employee may open it (lib/permissions.js canOpenPage),
// otherwise the standard "no access" card. Use it from a layout.js:
//   <PageGate pageKey="page:customers">{children}</PageGate>
// A surface that several regular pages reach (the print routes - see lib/printAccess.js) passes
// `pageKeys` instead: rendered when the employee may open ANY of them.
export default async function PageGate({ pageKey, pageKeys, children }) {
  const keys = pageKeys || [pageKey];
  if (!(await canOpenAnyPage(keys))) {
    return <NoAccessMessage />;
  }
  return children;
}
