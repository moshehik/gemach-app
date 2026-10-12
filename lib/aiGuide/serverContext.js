// lib/aiGuide/serverContext.js - טוען (שרת בלבד) את ההקשר שמדריך האתר צריך לכל שאלה: מי המשתמשת, מה מותר לה, הגדרות הארגון,
// עץ התפריט האמיתי שלה (אותו buildMenuTree ש-app/layout.js מריץ) ובאיזו תצוגה (ישן/חדש) היא נמצאת.
// אין כאן שאילתת DB משלו: העובדת (employeeId/roleId) מגיעה מ-loadEmployeeAccess שכבר רץ בנתיב ה-AI, וההגדרות מה-cache המשותף.
import { getAllCachedSettings } from '../settingsCache';
import { resolvePageAccess } from '../permissions';
import { buildMenuTree, NAV_PAGE_KEYS, MENU_PAGE_KEYS, deriveLegacyFlags, settingsToMap } from '../menu/buildMenuTree';
import { selectHub, accessForRole } from '../adminHubCatalog';
import { resolveUiVariants, sanitizeUiVariants } from '../uiVariant';
import { readSignedDesignPrefs } from '../../app/lib/designPrefsCookie';
import { PAGES, TASKS, TARGETS } from './index';
import { collectPermissionKeys } from './access';
import { menuItemIdsOf } from './knowledge';

/**
 * @param {{ employeeId: string|null, roleId: number|null, cookieStore: any, currentPath?: string }} p
 *   cookieStore = ה-store הרגיל של next/headers (לקריאת עוגיית העדפות העיצוב החתומה)
 */
export async function loadGuideContext({ employeeId, roleId, cookieStore, currentPath = '/' }) {
  const rows = await getAllCachedSettings().catch(() => []);
  const settings = settingsToMap(rows);
  const logged = !!employeeId;
  const keys = [...new Set([...NAV_PAGE_KEYS, ...MENU_PAGE_KEYS, ...collectPermissionKeys({ pages: PAGES, targets: TARGETS, tasks: TASKS })])];
  let perms = null;
  if (logged) perms = await resolvePageAccess(roleId, employeeId, keys).catch(() => null);
  const flags = deriveLegacyFlags({ logged, roleId, permissions: perms, settings });
  const requireLogin = settings.require_login === 'true';
  const head = !!flags.isHeadManagement || (!logged && !requireLogin);
  const prog = logged && roleId === 2;
  const adminTools = selectHub(
    accessForRole(roleId, { logged, requireLogin }),
    { nedarimEnabled: settings.nedarim_plus_enabled !== 'false', deliveriesEnabled: !!flags.showDeliveries },
  ).tools;
  const tree = buildMenuTree({
    user: logged ? { id: employeeId, roleId } : null,
    roleId,
    permissions: perms,
    settings: rows,
    flags,
    homeA5: true, // אנחנו מתארים את הממשק החדש: קישורי "בית" עם פרמטרים
    available: { 'order-stock': true },
    adminTools,
  });
  const prefs = employeeId ? readSignedDesignPrefs(cookieStore, employeeId) : null;
  const variants = resolveUiVariants({ userVariants: sanitizeUiVariants(prefs && prefs.uiVariants), settings: rows, pathname: currentPath, roleId });
  return {
    logged, roleId, head, prog, perms: perms || {}, settings, tree, variants, currentPath,
    menuItemIds: menuItemIdsOf(tree),
    hubToolIds: new Set(adminTools.map((t) => t.id)),
    rail: tree.rail,
  };
}
