'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from './BrandLogo';
import TopbarSearch from './TopbarSearch';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import ErrorReportButton from './ErrorReportButton';
import MessageHistoryButton from './MessageHistoryButton';
import OverdueRemindersWatcher from './OverdueRemindersWatcher';
import ShiftMessageWatcher from './ShiftMessageWatcher';
import { Icon } from '@/app/v3/ui';
import { useTopbarPanel } from './topbarPanel';

// Personal pinned-shortcuts prefs: a single shared, browser-wide localStorage key
// (not per-employee/cookie-scoped like /display-settings) — this is a convenience
// feature, not security-sensitive, so no server round-trip is warranted.
const PINNED_NAV_KEY = 'gemachPinnedNav';

// v3 app shell: סרגל עליון (במקום התפריט הצדדי) - ראו docs/redesign-v3/SHELL.md.
// לוגיקת הניווט וההרשאות מחושבת בשרת ב-layout.js ומועברת כ-`navGroups`; הרכיב הזה מחזיק רק
// מצב של ה-chrome (פאנלים נפתחים, מגירת מובייל, קיצורים מוצמדים) - שום דבר על auth/עסקי.

// שורת פריט בתפריט: קישור + (להנהלה ראשית/מתכנת בלבד) כפתור הצמדה לסרגל
function NavRow({ item, isActive, isHeadManagement, isPinned, togglePin, onClick, tabIndex, dataTbl }) {
  const pinnedNow = isPinned(item.href);
  return (
    <div className="v3-linkrow">
      <Link
        href={item.href}
        role={dataTbl ? 'menuitem' : undefined}
        {...(dataTbl ? { 'data-tbl': '' } : {})}
        className="v3-link"
        tabIndex={tabIndex}
        aria-current={isActive(item.href) ? 'page' : undefined}
        onClick={onClick}
      >
        <span className="v3-link__ic"><Icon name={item.icon} /></span>
        {item.label}
      </Link>
      {/* קיצור לסרגל: הנהלה ראשית/מתכנת בלבד (כמו בתפריט הצדדי הקודם, 2026-08-25) */}
      {isHeadManagement && (
        <button
          type="button"
          className={`v3-pinbtn${pinnedNow ? ' is-pinned' : ''}`}
          tabIndex={tabIndex}
          title={pinnedNow ? 'הסרה מהתפריט העליון' : 'הצמדה לתפריט העליון'}
          aria-label={pinnedNow ? `הסרת ${item.label} מהתפריט העליון` : `הצמדת ${item.label} לתפריט העליון`}
          aria-pressed={pinnedNow}
          onClick={(e) => togglePin(e, item)}
        >
          <Icon name="thumbtack" size="sm" />
        </button>
      )}
    </div>
  );
}

// לשונית ניווט עם תפריט נפתח (קבוצה עם יותר מפריט אחד)
function NavGroupTab({ group, active, isActive, isHeadManagement, isPinned, togglePin, onNavClick }) {
  const { close, itemProps, triggerProps } = useTopbarPanel({ hover: true });
  const label = group.tab?.label || group.label;
  return (
    <div {...itemProps} data-tab>
      <button type="button" {...triggerProps} className={`v3-topbar__tab${active ? ' is-active' : ''}`} data-tab-trigger>
        <Icon name={group.tab?.icon || group.items[0].icon} />
        {label}
        <Icon name="chevron-down" className="v3-topbar__chev" anim={false} />
      </button>
      <div className="v3-topbar__panel v3-tb-panel" role="menu" aria-label={label}>
        {group.items.map((item, idx) => (
          <div key={item.href}>
            {item.sepBefore && idx > 0 && <div className="v3-sep" role="separator" />}
            <NavRow
              item={item}
              dataTbl
              isActive={isActive}
              isHeadManagement={isHeadManagement}
              isPinned={isPinned}
              togglePin={togglePin}
              onClick={(e) => { onNavClick(e, item.href); close(false); }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AppShell({
  navGroups,
  isProgrammer,
  isHeadManagement,
  hideErrorReporting,
  hideInternalMessaging,
  showOverdueRemindersPopup,
  authToken,
  themePreference,
  children,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState(null); // מפתח קבוצה פתוחה באקורדיון של המגירה (null = הקבוצה הפעילה)
  const [pinned, setPinned] = useState([]); // [{href,label,icon}] — pinned shortcuts shown in the topbar

  // Load pinned shortcuts on mount, and stay in sync across tabs/windows sharing
  // the same browser profile (e.g. two monitors) via the storage event.
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

  // Pin toggle: adds/removes a denormalized {href,label,icon} copy so the
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

  // Topbar "×" unpin — open to everyone on purpose (see comment where it renders).
  const unpin = (e, href) => {
    e.preventDefault();
    e.stopPropagation();
    persistPinned(pinned.filter((p) => p.href !== href));
  };

  // מגירת מובייל: נעילת גלילה, Esc, וסגירה כשעוברים לרוחב דסקטופ / מנווטים
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleRefresh = () => {
    window.location.href = window.location.pathname;
  };

  const handleBack = () => {
    // router.back() is silently a no-op when the tab has no earlier history entry
    // (deep link, new tab, refresh) - user report "כפתור אחורה לא מגיב" (2026-09-09).
    // Falling back to the dashboard keeps the button always doing something visible.
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  // ניווט לקישור עם #hash (כמו /rentals#returned) בזמן שכבר נמצאים באותו path
  // (למשל /rentals#rented) הוא, עבור <Link> של Next, ניווט client-side שמעדכן
  // את ה-URL בלי לירות אירוע 'hashchange' אמיתי בדפדפן (זה קורה רק בניווט hash
  // טבעי) - כך שהעמוד היעד (שמאזין ל-hashchange, ר' app/rentals/page.js) לא
  // מתעדכן ונשאר על הלשונית הקודמת (דיווח 4c01513e). הפתרון: לזהות ניווט-hash
  // באותו path ולעדכן את window.location.hash ידנית, שכן כן יורה hashchange.
  const handleNavClick = (e, href) => {
    setMobileOpen(false);
    const hashIdx = href.indexOf('#');
    if (hashIdx === -1) return;
    const targetPath = href.slice(0, hashIdx);
    const targetHash = href.slice(hashIdx);
    if (targetPath !== pathname) return;
    e.preventDefault();
    if (window.location.hash !== targetHash) window.location.hash = targetHash;
  };

  // NOTE: href עם #hash לעולם לא מסומן פעיל (pathname לא כולל hash) - התנהגות קיימת, נשמרת בכוונה.
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));
  const groupActive = (g) => g.items.some((item) => isActive(item.href));

  // חצים ימינה/שמאלה בין לשוניות הסרגל (RTL: שמאלה = הבא ב-DOM)
  const onNavKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = e.target;
    if (!(t.matches && t.matches('[data-tab-trigger], [data-tab-link]'))) return;
    const all = [...e.currentTarget.querySelectorAll('[data-tab-trigger], [data-tab-link]')];
    const i = all.indexOf(t);
    if (i < 0) return;
    e.preventDefault();
    all[(i + (e.key === 'ArrowLeft' ? 1 : -1) + all.length) % all.length].focus();
  };

  return (
    <div className="app-shell v3-shell">
      {showOverdueRemindersPopup && <OverdueRemindersWatcher authToken={authToken} />}
      {!hideInternalMessaging && <ShiftMessageWatcher authToken={authToken} />}

      <div className="main">
        <header className="v3-topbar" data-v3="" dir="rtl" role="banner" id="v3Topbar">
          <Link href="/" className="v3-brand" aria-label="גמ״ח שמלות - לדף הבית" onClick={(e) => handleNavClick(e, '/')}>
            <BrandLogo />
          </Link>

          <nav className="v3-topbar__nav" aria-label="ניווט ראשי" onKeyDown={onNavKeyDown}>
            {navGroups.map((group) => {
              if (group.items.length === 1) {
                const item = group.items[0];
                const act = isActive(item.href);
                return (
                  <div className="v3-topbar__item" key={group.key} data-tab>
                    <Link
                      href={item.href}
                      className={`v3-topbar__tab${act ? ' is-active' : ''}`}
                      aria-current={act ? 'page' : undefined}
                      title={item.label}
                      data-tab-link
                      onClick={(e) => handleNavClick(e, item.href)}
                    >
                      <Icon name={item.icon} />
                      {group.tab?.label || item.label}
                    </Link>
                  </div>
                );
              }
              return (
                <NavGroupTab
                  key={group.key}
                  group={group}
                  active={groupActive(group)}
                  isActive={isActive}
                  isHeadManagement={isHeadManagement}
                  isPinned={isPinned}
                  togglePin={togglePin}
                  onNavClick={handleNavClick}
                />
              );
            })}
          </nav>

          {pinned.length > 0 && (
            <div className="v3-pins" aria-label="קיצורים מוצמדים">
              {pinned.map((item) => (
                <span className="v3-pin" key={item.href}>
                  <Link
                    href={item.href}
                    className={`v3-topbar__ib${isActive(item.href) ? ' is-active' : ''}`}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    title={item.label}
                    aria-label={item.label}
                    onClick={(e) => handleNavClick(e, item.href)}
                  >
                    <Icon name={item.icon} />
                  </Link>
                  {/* ההסרה מהתפריט העליון פתוחה לכולם בכוונה, בניגוד להצמדה (לעיל) -
                      gemachPinnedNav הוא מפתח משותף למחשב (לא פר-עובד), אז אם נגביל גם
                      את ההסרה להנהלה ראשית, עובד רגיל שמשתמש במחשב משותף עם קיצורים
                      שהוצמדו על ידי מישהו אחר נשאר בלי שום דרך להסיר אותם. */}
                  <button
                    type="button"
                    className="v3-pin__x"
                    title="הסרה מהתפריט העליון"
                    aria-label={`הסרת ${item.label} מהתפריט העליון`}
                    onClick={(e) => unpin(e, item.href)}
                  >
                    <Icon name="x" size="xs" anim={false} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="v3-topbar__act">
            {/* RTL: "back" (previous) points right like the pagination convention elsewhere
                in this design system, "forward" (next) points left — not the LTR-mirrored
                assumption of back=left/forward=right. */}
            <button type="button" className="v3-topbar__ib v3-hide-m" title="אחורה" aria-label="אחורה" onClick={handleBack}>
              <Icon name="chevron-end" />
            </button>
            <button type="button" className="v3-topbar__ib v3-hide-m" title="קדימה" aria-label="קדימה" onClick={() => router.forward()}>
              <Icon name="chevron-start" />
            </button>
            <button type="button" className="v3-topbar__ib v3-hide-m" title="ריענון וניקוי פילטרים" aria-label="ריענון וניקוי פילטרים" onClick={handleRefresh}>
              <Icon name="refresh" />
            </button>
            <TopbarSearch />
            <ThemeToggle employeeId={authToken} initialTheme={themePreference} className="v3-hide-m" />
            {isProgrammer && <MessageHistoryButton />}
            {!hideErrorReporting && <ErrorReportButton />}
            {authToken && !hideInternalMessaging && <NotificationBell employeeId={authToken} />}
            <UserMenu hideInternalMessaging={hideInternalMessaging} />
          </div>

          <button
            type="button"
            className="v3-burger"
            id="menuToggle"
            aria-expanded={mobileOpen}
            aria-controls="v3Drawer"
            aria-label={mobileOpen ? 'סגירת התפריט' : 'פתיחת התפריט'}
            title="תפריט"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Icon name={mobileOpen ? 'x' : 'menu'} size="lg" />
          </button>

          <div className={`v3-drawer${mobileOpen ? ' is-open' : ''}`} id="v3Drawer" aria-label="תפריט ראשי">
            {navGroups.map((group) => {
              if (group.items.length === 1) {
                const item = group.items[0];
                const act = isActive(item.href);
                return (
                  <Link
                    key={group.key}
                    href={item.href}
                    className={`v3-acc${act ? ' is-active' : ''}`}
                    aria-current={act ? 'page' : undefined}
                    onClick={(e) => handleNavClick(e, item.href)}
                  >
                    <span className="v3-link__ic"><Icon name={item.icon} /></span>
                    {group.tab?.label || item.label}
                  </Link>
                );
              }
              const isOpenAcc = openAcc === group.key || (openAcc === null && groupActive(group));
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    className={`v3-acc${groupActive(group) ? ' is-active' : ''}`}
                    aria-expanded={isOpenAcc}
                    onClick={() => setOpenAcc(isOpenAcc ? '' : group.key)}
                  >
                    <span className="v3-link__ic"><Icon name={group.tab?.icon || group.items[0].icon} /></span>
                    {group.tab?.label || group.label}
                    <Icon name="chevron-down" className="v3-topbar__chev" anim={false} />
                  </button>
                  <div className="v3-acc-body">
                    <div>
                      {group.items.map((item, idx) => (
                        <div key={item.href}>
                          {item.sepBefore && idx > 0 && <div className="v3-sep" role="separator" />}
                          <NavRow
                            item={item}
                            isActive={isActive}
                            isHeadManagement={isHeadManagement}
                            isPinned={isPinned}
                            togglePin={togglePin}
                            tabIndex={isOpenAcc ? undefined : -1}
                            onClick={(e) => handleNavClick(e, item.href)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="v3-dfoot">
              <button type="button" className="v3-topbar__ib v3-dbtn" title="אחורה" aria-label="אחורה" onClick={() => { setMobileOpen(false); handleBack(); }}>
                <Icon name="chevron-end" />
              </button>
              <button type="button" className="v3-topbar__ib v3-dbtn" title="קדימה" aria-label="קדימה" onClick={() => { setMobileOpen(false); router.forward(); }}>
                <Icon name="chevron-start" />
              </button>
              <button type="button" className="v3-topbar__ib v3-dbtn" title="ריענון וניקוי פילטרים" aria-label="ריענון וניקוי פילטרים" onClick={handleRefresh}>
                <Icon name="refresh" />
              </button>
              <ThemeToggle employeeId={authToken} initialTheme={themePreference} className="v3-dbtn" />
            </div>
          </div>
        </header>
        <div className={`v3-drawer-scrim${mobileOpen ? ' is-on' : ''}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />

        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}
