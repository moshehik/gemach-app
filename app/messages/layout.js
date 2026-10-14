import PageGate from '@/app/components/PageGate';
import { isInternalMessagingOff } from '@/lib/messagingGate';
import MessagingOff from './MessagingOff';

// Access is decided by the "page:messages" item of the permissions catalog (lib/permissionsMetadata.js,
// editable at /admin/permissions) - see lib/permissions.js canOpenPage().
// On top of that (report f1f46d04): when the internal-messaging system is switched off in the site settings
// (hide_internal_messaging = 'true') the page is closed for everyone, also on a direct URL - the menus already hide it.
export default async function MessagesLayout({ children }) {
  if (await isInternalMessagingOff()) return <MessagingOff />;
  return <PageGate pageKey="page:messages">{children}</PageGate>;
}
