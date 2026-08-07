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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemachSidebarState');
      if (saved) setSidebarState(saved);
    } catch (e) {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-sidebar', sidebarState);
  }, [sidebarState]);

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
          <button type="button" className="icon-btn" title="אחורה" onClick={() => router.back()}>
            <svg className="icon"><use href="#i-chevron-start" /></svg>
          </button>
          <button type="button" className="icon-btn" title="קדימה" onClick={() => router.forward()}>
            <svg className="icon"><use href="#i-chevron-end" /></svg>
          </button>
          {activeMeta && (
            <div className="crumb">
              <svg className="icon"><use href={`#${activeMeta.icon}`} /></svg>
              <span>{activeMeta.groupLabel} / {activeMeta.label}</span>
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
