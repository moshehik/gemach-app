'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from './BrandLogo';
import TopbarSearch from './TopbarSearch';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import ErrorReportButton from './ErrorReportButton';
import MessageHistoryButton from './MessageHistoryButton';

// Personal pinned-shortcuts prefs: a single shared, browser-wide localStorage key
// (not per-employee/cookie-scoped like /display-settings) — this is a convenience
// feature, not security-sensitive, so no server round-trip is warranted.
const PINNED_NAV_KEY = 'gemachPinnedNav';

// New "אריג" app shell: right-side sidebar (RTL) + topbar, replacing the old
// horizontal navbar + floating GlobalSidebar widget. Real navigation/role-gating
// logic is computed server-side in layout.js and passed in as `navGroups`; this
// component only owns shell-chrome interaction state (sidebar collapse/drawer,
// nothing about auth/business logic).
export default function AppShell({
  navGroups,
  isProgrammer,
  hideErrorReporting,
  hideInternalMessaging,
  authToken,
  themePreference,
  children,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarState, setSidebarState] = useState('expanded'); // expanded | collapsed | hidden
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState([]); // [{href,label,icon}] — pinned sidebar shortcuts shown in the topbar

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemachSidebarState');
      if (saved) setSidebarState(saved);
    } catch (e) {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-sidebar', sidebarState);
  }, [sidebarState]);

  // Load pinned shortcuts on mount, and stay in sync across tabs/windows sharing
  // the same browser profile (e.g. two monitors) via the storage event — cheap
  // to add and matches the robustness of the sidebar-state prefs above.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PINNED_NAV_KEY);
      if (saved) setPinned(JSON.parse(saved));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key !== PINNED_NAV_KEY) return;
      try {
        setPinned(e.newValue ? JSON.parse(e.newValue) : []);
      } catch (err) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const persistPinned = (next) => {
    setPinned(next);
    try { localStorage.setItem(PINNED_NAV_KEY, JSON.stringify(next)); } catch (e) {}
  };

  const isPinned = (href) => pinned.some((p) => p.href === href);

  // Sidebar pin toggle: adds/removes a denormalized {href,label,icon} copy so the
  // topbar row can render without needing the full navGroups tree.
  const togglePin = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    persistPinned(
      isPinned(item.href)
        ? pinned.filter((p) => p.href !== item.href)
        : [...pinned, { href: item.href, label: item.label, icon: item.icon }]
    );
  };

  // Topbar "×" unpin — stops the click from bubbling into the pinned icon's own
  // <Link> (it would otherwise also navigate).
  const unpin = (e, href) => {
    e.preventDefault();
    e.stopPropagation();
    persistPinned(pinned.filter((p) => p.href !== href));
  };

  const handleMenuToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setMobileOpen((v) => !v);
      return;
    }
    setSidebarState((prev) => {
      const next = prev === 'expanded' ? 'collapsed' : prev === 'collapsed' ? 'hidden' : 'expanded';
      try { localStorage.setItem('gemachSidebarState', next); } catch (e) {}
      return next;
    });
  };

  const handleRefresh = () => {
    window.location.href = window.location.pathname;
  };

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));
  const activeMeta = navGroups.flatMap((g) => g.items).find((item) => isActive(item.href));

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="brand">
          <BrandLogo />
        </div>
        {navGroups.map((group) => (
          <div className="nav-group" key={group.key}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isActive(item.href) ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <svg className="icon"><use href={`#${item.icon}`} /></svg>
                <span className="nav-label">{item.label}</span>
                <button
                  type="button"
                  className={`nav-pin-btn${isPinned(item.href) ? ' pinned' : ''}`}
                  title={isPinned(item.href) ? 'הסרה מהתפריט העליון' : 'הצמדה לתפריט העליון'}
                  onClick={(e) => togglePin(e, item)}
                >
                  <svg className="icon"><use href="#i-thumbtack" /></svg>
                </button>
              </Link>
            ))}
          </div>
        ))}
      </aside>

      <div className="main">
        <div className="topbar">
          <button type="button" className="icon-btn menu-toggle" id="menuToggle" title="תפריט" onClick={handleMenuToggle}>
            <svg className="icon"><use href="#i-menu" /></svg>
          </button>
          {/* RTL: "back" (previous) points right like the pagination convention elsewhere
              in this design system, "forward" (next) points left — not the LTR-mirrored
              assumption of back=left/forward=right. */}
          <button type="button" className="icon-btn" title="אחורה" onClick={() => router.back()}>
            <svg className="icon"><use href="#i-chevron-end" /></svg>
          </button>
          <button type="button" className="icon-btn" title="קדימה" onClick={() => router.forward()}>
            <svg className="icon"><use href="#i-chevron-start" /></svg>
          </button>
          {activeMeta && (
            <div className="crumb">
              <svg className="icon"><use href={`#${activeMeta.icon}`} /></svg>
              <span>{activeMeta.groupLabel} / {activeMeta.label}</span>
            </div>
          )}

          {pinned.length > 0 && (
            <div className="topbar-pins">
              {pinned.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`icon-btn topbar-pin-icon${isActive(item.href) ? ' active' : ''}`}
                  title={item.label}
                >
                  <svg className="icon"><use href={`#${item.icon}`} /></svg>
                  <button
                    type="button"
                    className="topbar-pin-remove"
                    title="הסרה מהתפריט העליון"
                    onClick={(e) => unpin(e, item.href)}
                  >
                    <svg className="icon"><use href="#i-x" /></svg>
                  </button>
                </Link>
              ))}
            </div>
          )}

          <TopbarSearch />

          <button type="button" className="icon-btn" title="ריענון וניקוי פילטרים" onClick={handleRefresh}>
            <svg className="icon"><use href="#i-refresh" /></svg>
          </button>
          <ThemeToggle employeeId={authToken} initialTheme={themePreference} />
          {isProgrammer && <MessageHistoryButton />}
          {!hideErrorReporting && <ErrorReportButton />}
          {authToken && !hideInternalMessaging && <NotificationBell employeeId={authToken} />}
          <UserMenu />
        </div>

        {mobileOpen && (
          <div className="sidebar-backdrop open" onClick={() => setMobileOpen(false)} />
        )}

        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}
