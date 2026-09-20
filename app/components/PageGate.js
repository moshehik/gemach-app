import NoAccessMessage from '@/app/components/NoAccessMessage';
import { canOpenPage } from '@/lib/permissions';

// Server-side page guard driven by the permissions catalog (/admin/permissions, "page:*" items):
// renders the page only when the current employee may open it (lib/permissions.js canOpenPage),
// otherwise the standard "no access" card. Use it from a layout.js:
//   <PageGate pageKey="page:customers">{children}</PageGate>
export default async function PageGate({ pageKey, children }) {
  if (!(await canOpenPage(pageKey))) {
    return <NoAccessMessage />;
  }
  return children;
}
