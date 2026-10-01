'use client';

// המעטפת החדשה ("תפריט חדש", עיצוב A5 שאושר ב-1.10.2026) - מרונדרת רק כשהווריאנט 'shell' הוא 'a5' (ShellSwitch).
// מבנה ה-DOM והתנהגות הריחוף / הצמדה / מקלדת הועתקו מ-תצוגות-עיצוב\סיימתי-לעבוד\תפריט-חדש.html (שורות 2767-2797,
// 3598-4041), ורק מרכיבי הפלטה הממוספרים (design-system/COMPONENTS.md). מה שחסר בפלטה - ב-menu.css (מקומי).
// העץ (לשוניות, פאנלים, שורות משתמש/פעמון) מגיע מהשרת מוכן: lib/menu/buildMenuTree.js, מחושב ב-app/layout.js.
// הפעולות (התנתקות, כניסה, היסטוריית הודעות מערכת, "האתר הישן") נקראות כאן; הקוד המועתק מסומן // COPIED FROM.

import '@/design-system/components.css';
import './menu.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { findActive } from '@/lib/menu/buildMenuTree';
import { shiftClockInfo } from '@/lib/menu/shiftClock';
import { usePopup } from '../PopupProvider';
import LoginScreen from '../LoginScreen';
import ErrorReportButton from '../ErrorReportButton';
import MessageHistoryButton from '../MessageHistoryButton';
import OverdueRemindersWatcher from '../OverdueRemindersWatcher';
import ShiftMessageWatcher from '../ShiftMessageWatcher';
import { A5ShellProvider } from './A5ShellContext';
import { Ic, MenuRows, MenuSprite, SnLi, SOON_LABEL } from './menuParts';
import MenuTabItem from './MenuTabPanel';
import SearchBody, { useMenuSearch } from './MenuSearchPanel';
import BellBody, { useNotifications } from './MenuBell';
import { UserButton, UserPanelBody, userDisplay } from './MenuUserPanel';
import ManagerMessageDialog from './ManagerMessageDialog';
import useNavHistory from './useNavHistory';

const CLOSED = { id: null, pin: false, peek: false };
export default function MenuA5Shell({
  menuTree: tree,
  authToken,
  isProgrammer,
  hideInternalMessaging,
  showOverdueRemindersPopup,
  children,
}) {
  const pathname = usePathname();
  const popup = usePopup();
  const showAlert = popup && popup.showAlert;
  const rail = tree.rail || {};

  // ---- נתוני המשתמש (שם, מחלקה, משמרת פעילה) מ-/api/me - אותה קריאה מטמונית כמו UserMenu.js ----
  const [me, setMe] = useState(null);
  const [shift, setShift] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!tree.user || !tree.user.logged) return;
    fetchSharedJson('/api/me', { ttl: TTL.STATIC })
      .then((data) => {
        if (data && data.success) { setMe(data.employee); setShift(data.activeShift || null); }
      })
      .catch((err) => {
        if (!((err && err.message) || '').includes('HTTP 401')) console.warn('menu: /api/me failed', err && err.message);
      });
  }, [tree.user]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const info = useMemo(() => userDisplay(tree, me), [tree, me]);
  const shiftInfo = shift ? shiftClockInfo(shift.entryTime, now) : null;

  // ---- איזה פריט "נוכחי" ----
  const [hash, setHash] = useState('');
  useEffect(() => {
    const sync = () => setHash(window.location.hash || '');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [pathname]);
  const act = useMemo(() => findActive(tree, pathname, hash), [tree, pathname, hash]);

  // ---- מצב פתיחה של פאנלים (אחד בכל רגע): id, הצמדה (pin), הצצה (peek, רק בחיפוש) ----
  const [ui, setUi] = useState(CLOSED);
  const uiRef = useRef(ui);
  uiRef.current = ui; // eslint-disable-line react-hooks/refs
  const timers = useRef({ leave: 0, hover: 0, longPress: 0, focusPeek: 0 });
  const longFired = useRef(false);
  const noPeekUntil = useRef(0);
  const headerRef = useRef(null);
  const wrapRef = useRef(null);
  const ttRef = useRef(null);
  const searchInputRef = useRef(null);
  const drawerSearchRef = useRef(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [acc, setAcc] = useState(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const nav = useNavHistory(tree);
  const search = useMenuSearch();
  const notify = useCallback((message, type = 'info') => { if (showAlert) showAlert(message, type); }, [showAlert]);
  const bellOn = !!(rail.bell && rail.bell.show && authToken && !hideInternalMessaging);
  const nf = useNotifications({
    enabled: bellOn,
    employeeId: authToken,
    pathname,
    isOpen: ui.id === 'bell' || (drawerOpen && acc === 'bell'),
    onError: (m) => notify(m, 'error'),
  });

  const closeAll = useCallback(() => {
    clearTimeout(timers.current.leave);
    clearTimeout(timers.current.hover);
    setUi(CLOSED);
  }, []);
  const openItem = useCallback((id, pin = false, peek = false) => {
    clearTimeout(timers.current.leave);
    setUi({ id, pin, peek });
  }, []);
  const closeDrawer = useCallback((returnFocus) => {
    setDrawerOpen(false);
    if (returnFocus) {
      const b = headerRef.current && headerRef.current.querySelector('.sn-burger');
      if (b) b.focus();
    }
  }, []);

  // ---- ניווט / פעולות ----
  // COPIED FROM AppShell.js handleNavClick: ניווט #hash באותו path לא יורה hashchange ב-<Link>, אז מעדכנים ידנית.
  const onNavigate = useCallback((e, href) => {
    closeAll();
    setDrawerOpen(false);
    const i = href.indexOf('#');
    if (i === -1) return;
    const targetPath = href.slice(0, i);
    const targetHash = href.slice(i);
    if (targetPath !== pathname) return;
    e.preventDefault();
    if (window.location.hash !== targetHash) window.location.hash = targetHash;
  }, [closeAll, pathname]);

  const onGo = useCallback((fn, resetQuery) => {
    closeAll();
    setDrawerOpen(false);
    if (resetQuery) search.reset();
    fn();
  }, [closeAll, search]);

  // COPIED FROM UserMenu.js handleLogout (+ ניקוי היסטוריית הניווט של הטאב, כדי ששמות לקוחות לא ידלפו לעובדת הבאה).
  const handleLogout = useCallback(async () => {
    try {
      const overdueRes = await fetch('/api/orders/overdue', { cache: 'no-store' });
      if (overdueRes.ok) {
        const overdueData = await overdueRes.json();
        if (Array.isArray(overdueData.orders) && overdueData.orders.length > 0 && window.customConfirm) {
          const proceed = await window.customConfirm(
            `יש ${overdueData.orders.length} משפחות שעדיין לא החזירו שמלות ומועד ההחזרה שלהן עבר. לצאת בכל זאת?`
          );
          if (!proceed) return;
        }
      }
    } catch (e) {
      // best-effort - לא קשור להצלחת ההתנתקות עצמה
    }
    setBusy(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error:', (err && err.message) || 'Failed to fetch');
    } finally {
      nav.clearOnLogout();
      window.location.href = '/';
    }
  }, [nav]);

  // "האתר הישן" (זמני): עקיפה אישית shell=legacy, בכיוון אחד בלבד (השרת מקבל רק 'legacy' / null), ואז טעינה מלאה.
  const handleOldSite = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/me/ui-variant/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'legacy' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (e) {
      setBusy(false);
      notify('המעבר לאתר הישן נכשל. נסו שוב.', 'error');
    }
  }, [notify]);

  const clickHidden = (selector) => {
    const el = wrapRef.current && wrapRef.current.querySelector(selector);
    if (el) el.click();
  };

  const onAction = useCallback((item) => {
    closeAll();
    setDrawerOpen(false);
    switch (item.action) {
      case 'logout': handleLogout(); break;
      case 'login': setLoginOpen(true); break;
      case 'system-messages-history': clickHidden('[data-sn-hist-open]'); break;
      case 'message-to-manager': setMsgOpen(true); break;
      case 'switch-to-legacy-shell': handleOldSite(); break;
      default: break;
    }
  }, [closeAll, handleLogout, handleOldSite]);

  // ---- ריחוף / לחיצה / מקלדת ----
  const triggerOf = (itemEl) => itemEl.querySelector(':scope > [data-sn-trigger]');

  const handlers = useMemo(() => ({
    enter(e, id) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timers.current.leave);
      if (id !== 'search') {
        if (uiRef.current.id !== id) openItem(id, false);
      } else {
        clearTimeout(timers.current.hover);
        if (uiRef.current.id !== 'search') {
          timers.current.hover = setTimeout(() => { if (uiRef.current.id !== 'search') openItem('search', false, true); }, 150);
        }
      }
    },
    leave(e, id) {
      if (e.pointerType !== 'mouse') return;
      if (id === 'search') clearTimeout(timers.current.hover);
      if (uiRef.current.id === id && uiRef.current.pin) return;
      timers.current.leave = setTimeout(() => {
        if (uiRef.current.id === id && !uiRef.current.pin) closeAll();
      }, 140);
    },
    toggle(id) {
      const cur = uiRef.current;
      if (cur.id !== id) openItem(id, true);
      else if (!cur.pin) setUi({ id, pin: true, peek: false });
      else closeAll();
    },
    key(e, id) {
      const itemEl = e.currentTarget;
      const t = e.target;
      const onTrigger = t.hasAttribute('data-sn-trigger') || t.classList.contains('sn-tab');
      const rowsOf = () => [...itemEl.querySelectorAll('.sn-panel :is(a.sn-link, button.sn-link, .nf-row)')];
      const rows = rowsOf();
      const i = rows.indexOf(document.activeElement);
      const openKb = () => flushSync(() => { if (id === 'search') openItem('search', false, true); else openItem(id, true); });
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (onTrigger) { openKb(); const r = rowsOf(); if (r[0]) r[0].focus(); }
        else if (rows.length) rows[(i + 1) % rows.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (onTrigger) { openKb(); const r = rowsOf(); if (r.length) r[r.length - 1].focus(); }
        else if (rows.length) rows[(i - 1 + rows.length) % rows.length].focus();
      } else if (!onTrigger && e.key === 'Home' && rows.length) { e.preventDefault(); rows[0].focus(); }
      else if (!onTrigger && e.key === 'End' && rows.length) { e.preventDefault(); rows[rows.length - 1].focus(); }
    },
  }), [closeAll, openItem]);

  // חיצים ימינה/שמאלה בין הלשוניות (RTL: שמאלה = הבא).
  const onNavKey = useCallback((e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const item = e.target.closest('.sn-item');
    if (!item) return;
    // לשונית "בקרוב" לא ניתנת למיקוד - מדלגים עליה בחיצים
    const tabs = [...e.currentTarget.querySelectorAll('.sn-item')].filter((el) => !el.hasAttribute('data-soon'));
    const idx = tabs.indexOf(item);
    if (idx < 0) return;
    e.preventDefault();
    const nx = tabs[(idx + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length];
    const viaMenu = !!uiRef.current.id && !e.target.classList.contains('sn-tab') && !e.target.classList.contains('sn-cv');
    const hasPanel = !!nx.querySelector(':scope > .sn-panel');
    if (viaMenu && hasPanel) {
      flushSync(() => openItem(nx.getAttribute('data-sn'), true));
      const first = nx.querySelector('.sn-link');
      if (first) first.focus();
    } else {
      closeAll();
      const tab = nx.querySelector('.sn-tab');
      if (tab) tab.focus();
    }
  }, [closeAll, openItem]);

  // הצצה (ריחוף) מציגה גם את שורת החיפוש; לחיצה בתוכה = הצמדה, כדי שהפאנל לא ייסגר כשהעכבר יוצא ממנו באמצע הקלדה.
  const onSearchFieldFocus = (e) => {
    if (!e.target.matches || !e.target.matches('input')) return;
    const cur = uiRef.current;
    if (cur.id === 'search' && (cur.peek || !cur.pin)) { clearTimeout(timers.current.leave); setUi({ id: 'search', pin: true, peek: false }); }
  };

  // חיפוש: ריחוף/מיקוד = הצצה (peek): שורת חיפוש + "נצפו לאחרונה"; לחיצה = שורת החיפוש, ממוקדת ומוצמדת; מגע: לחיצה ארוכה = peek.
  const searchBtn = {
    onClick: () => {
      if (longFired.current) { longFired.current = false; return; }
      clearTimeout(timers.current.hover);
      const cur = uiRef.current;
      if (cur.id !== 'search') openItem('search', true);
      else if (cur.peek || !cur.pin) setUi({ id: 'search', pin: true, peek: false });
      else closeAll();
    },
    onFocus: (e) => {
      if (Date.now() < noPeekUntil.current || !e.currentTarget.matches(':focus-visible')) return;
      const el = e.currentTarget;
      clearTimeout(timers.current.focusPeek);
      timers.current.focusPeek = setTimeout(() => {
        if (document.activeElement === el && uiRef.current.id !== 'search') openItem('search', false, true);
      }, 150);
    },
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      longFired.current = false;
      clearTimeout(timers.current.longPress);
      timers.current.longPress = setTimeout(() => {
        longFired.current = true;
        setUi({ id: 'search', pin: true, peek: true });
      }, 500);
    },
    onPointerUp: () => clearTimeout(timers.current.longPress),
    onPointerCancel: () => clearTimeout(timers.current.longPress),
    onPointerLeave: () => clearTimeout(timers.current.longPress),
    onContextMenu: (e) => { if (longFired.current) e.preventDefault(); },
  };

  // מיקוד בשדה החיפוש כשהפאנל נפתח בלחיצה (לא בהצצה).
  useEffect(() => {
    if (ui.id === 'search' && ui.pin && !ui.peek) {
      const t = setTimeout(() => { if (searchInputRef.current) searchInputRef.current.focus(); }, 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [ui]);

  // הפאנל הפתוח לא יוצא מהמסך (כמו open() בעיצוב).
  useLayoutEffect(() => {
    if (!ui.id || !headerRef.current) return;
    const p = headerRef.current.querySelector('.sn-item.open > .sn-panel');
    if (!p) return;
    p.style.translate = '';
    const r = p.getBoundingClientRect();
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    if (dx) p.style.translate = `${dx}px 0`;
  }, [ui]);

  // Escape / לחיצה מחוץ לסרגל.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (uiRef.current.id) {
        const item = headerRef.current && headerRef.current.querySelector('.sn-item.open');
        const trig = item && triggerOf(item);
        closeAll();
        if (trig) { noPeekUntil.current = Date.now() + 600; trig.focus(); }
      }
      setDrawerOpen((d) => { if (d) { const b = headerRef.current && headerRef.current.querySelector('.sn-burger'); if (b) b.focus(); } return false; });
    };
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.snav')) return;
      closeAll();
      setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [closeAll]);

  // מגירת הנייד: נעילת גלילה, וסגירה כשהמסך מתרחב.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width:768px)');
    const on = (e) => { if (e.matches) setDrawerOpen(false); };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // אין סרגל צד במעטפת החדשה: כפתור ה-AI הצף לא צריך להשאיר מקום לו (AIFloatingWidget קורא --sidebar-current-w).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sidebar-current-w', '0px');
    return () => root.style.removeProperty('--sidebar-current-w');
  }, []);

  // טולטיפ (פלטה: טולטיפ 1-6, .pl-tt) - האצלת אירועים על כל אזור המעטפת.
  useEffect(() => {
    const wrap = wrapRef.current;
    const tt = ttRef.current;
    if (!wrap || !tt) return undefined;
    let cur = null;
    const hide = () => { tt.classList.remove('on'); cur = null; };
    const show = (el) => {
      cur = el;
      tt.textContent = el.getAttribute('data-tip');
      tt.classList.add('on');
      const r = el.getBoundingClientRect();
      const w = tt.offsetWidth;
      const h = tt.offsetHeight;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
      let y = r.top - h - 10;
      if (y < 8) y = r.bottom + 10;
      tt.style.left = `${x}px`;
      tt.style.top = `${y}px`;
    };
    const over = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== cur) show(t); else if (!t && cur) hide(); };
    const out = (e) => { if (e.target.closest && e.target.closest('[data-tip]')) hide(); };
    const fin = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) show(t); };
    wrap.addEventListener('mouseover', over);
    wrap.addEventListener('mouseout', out);
    wrap.addEventListener('focusin', fin);
    wrap.addEventListener('focusout', out);
    wrap.addEventListener('click', hide, true);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      wrap.removeEventListener('mouseover', over);
      wrap.removeEventListener('mouseout', out);
      wrap.removeEventListener('focusin', fin);
      wrap.removeEventListener('focusout', out);
      wrap.removeEventListener('click', hide, true);
      window.removeEventListener('scroll', hide);
    };
  }, []);

  // ---- לוגו ----
  const brand = tree.brand || {};
  const [logoOk, setLogoOk] = useState(!!brand.hasLogoSetting);
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl || '/api/logo');
  useEffect(() => {
    // COPIED FROM BrandLogo.js: ניקוי מטמון הלוגו כשעודכן (logo_timestamp / האירוע logoUpdated).
    try {
      const ts = localStorage.getItem('logo_timestamp');
      if (ts) setLogoUrl(`${brand.logoUrl || '/api/logo'}?v=${ts}`);
    } catch (e) { /* ignore */ }
    const onLogo = (e) => { setLogoUrl(`${brand.logoUrl || '/api/logo'}?v=${e.detail || Date.now()}`); setLogoOk(true); };
    window.addEventListener('logoUpdated', onLogo);
    return () => window.removeEventListener('logoUpdated', onLogo);
  }, [brand.logoUrl]);

  const tabs = tree.tabs || [];
  const userItems = (tree.user && tree.user.items) || [];
  const bellRows = (rail.bell && rail.bell.rows) || [];
  const searchOn = !!(rail.search && rail.search.show);
  const burgerCount = nf.unread > 99 ? '99+' : String(nf.unread);
  const clearRecents = () => {
    nav.clearAll();
    try { localStorage.removeItem('agy_history'); window.dispatchEvent(new Event('agy_history_updated')); } catch (e) { /* ignore */ }
  };

  // ---- מגירת נייד: אקורדיון אחד פתוח ----
  const toggleAcc = (id) => setAcc((cur) => (cur === id ? null : id));
  const q = search.q.trim();

  return (
    <A5ShellProvider value={{ menuTree: tree }}>
      <div className="a5-shell">
        {showOverdueRemindersPopup && <OverdueRemindersWatcher authToken={authToken} />}
        {!hideInternalMessaging && <ShiftMessageWatcher authToken={authToken} />}
        {loginOpen && <LoginScreen isModal onClose={() => setLoginOpen(false)} />}

        <div className="gm-ds gm-menu" ref={wrapRef}>
          <MenuSprite />
          <header className="snav" id="snav" role="banner" ref={headerRef} data-sticky-nav onBlur={(e) => {
            if (uiRef.current.id && e.relatedTarget && !e.relatedTarget.closest('.sn-item')) closeAll();
          }}>
            <Link
              className="sn-brand"
              href={brand.href || '/'}
              aria-label={`${brand.name || ''} - לדף הבית`}
              data-tip={brand.tooltip || undefined}
              onClick={(e) => onNavigate(e, brand.href || '/')}
            >
              <span className={`sn-mark${brand.hasLogoSetting && logoOk ? ' ph' : ''}`}>
                {brand.hasLogoSetting && logoOk
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoUrl} alt="לוגו הארגון" onError={() => setLogoOk(false)} />
                  : <Ic n="dress" />}
              </span>
              <span className="sn-name">{brand.name}</span>
              {brand.subtitle ? <span className="sn-tag">{brand.subtitle}</span> : null}
            </Link>

            <nav className="sn-nav" id="snNav" aria-label="ניווט ראשי" onKeyDown={onNavKey}>
              {tabs.map((tab) => (
                <MenuTabItem
                  key={tab.id}
                  tab={tab}
                  active={act.tabId === tab.id}
                  activeItemId={act.itemId}
                  open={ui.id === tab.id}
                  handlers={handlers}
                  onNavigate={onNavigate}
                  onAction={onAction}
                />
              ))}
            </nav>

            <div className="sn-act" id="snAct">
              {searchOn && (
                <div
                  className={`sn-item${ui.id === 'search' ? ' open' : ''}${ui.id === 'search' && ui.peek ? ' peek' : ''}`}
                  data-sn="search"
                  onPointerEnter={(e) => handlers.enter(e, 'search')}
                  onPointerLeave={(e) => handlers.leave(e, 'search')}
                  onKeyDown={(e) => handlers.key(e, 'search')}
                  onFocus={onSearchFieldFocus}
                >
                  <button
                    type="button"
                    className="sn-ib"
                    data-sn-trigger
                    aria-haspopup="true"
                    aria-expanded={ui.id === 'search' ? 'true' : 'false'}
                    aria-label="חיפוש"
                    data-tip="חיפוש"
                    {...searchBtn}
                  >
                    <Ic n="search" />
                  </button>
                  <div className="sn-panel sn-search" role="dialog" aria-label="חיפוש">
                    <SearchBody
                      idPrefix="snp"
                      search={search}
                      nav={nav}
                      tree={tree}
                      menu
                      onGo={onGo}
                      onClearRecents={clearRecents}
                      inputRef={searchInputRef}
                    />
                  </div>
                </div>
              )}

              {rail.errorReport && rail.errorReport.show && (
                <ErrorReportButton
                  trigger={({ onOpen, unreadCount }) => (
                    <button type="button" className="sn-ib" id="snErr" data-sn-err aria-haspopup="dialog" aria-label="דיווח על שגיאה" data-tip="דיווח על שגיאה בעמוד" onClick={onOpen}>
                      <Ic n="sn-bug" />
                      {unreadCount > 0 && <span className="sn-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                    </button>
                  )}
                />
              )}

              {isProgrammer && (
                <MessageHistoryButton trigger={({ onOpen }) => <button type="button" hidden data-sn-hist-open onClick={onOpen} />} />
              )}

              {rail.oldSite && rail.oldSite.show && (
                <button
                  type="button"
                  className="sn-ib"
                  id="snOld"
                  disabled={busy}
                  aria-label="האתר הישן (קישור זמני)"
                  data-tip="האתר הישן (זמני) · קישור זמני, עד שכל המסכים יעברו לאתר החדש"
                  onClick={() => onAction({ action: rail.oldSite.action })}
                >
                  <Ic n="ext" />
                </button>
              )}

              {bellOn && (
                <div
                  className={`sn-item${ui.id === 'bell' ? ' open' : ''}`}
                  data-sn="bell"
                  onPointerEnter={(e) => handlers.enter(e, 'bell')}
                  onPointerLeave={(e) => handlers.leave(e, 'bell')}
                  onKeyDown={(e) => handlers.key(e, 'bell')}
                >
                  <button
                    type="button"
                    className={`sn-ib${nf.ring ? ' nf-ring' : ''}`}
                    data-sn-trigger
                    aria-haspopup="true"
                    aria-expanded={ui.id === 'bell' ? 'true' : 'false'}
                    aria-label={nf.unread ? `התראות · ${nf.unread} ${nf.unread === 1 ? 'חדשה' : 'חדשות'}` : 'התראות'}
                    data-tip="התראות"
                    onClick={() => handlers.toggle('bell')}
                  >
                    <Ic n="bell" />
                    {nf.unread > 0 && <span className="sn-badge">{nf.unread > 99 ? '99+' : nf.unread}</span>}
                  </button>
                  <div className="sn-panel sn-bell" role="menu" aria-label="התראות">
                    <BellBody nf={nf} rows={bellRows} activeItemId={act.itemId} onNavigate={onNavigate} onAction={onAction} />
                  </div>
                </div>
              )}

              {tree.user && tree.user.logged && shiftInfo && rail.shiftClock && rail.shiftClock.show && (
                shiftInfo.kind === 'stale' ? (
                  <span className="sn-clock warn" data-tip={shiftInfo.tip}>
                    <i />{shiftInfo.text}
                  </span>
                ) : (
                  <span className="sn-clock" data-tip="מצב עבודה · שעות מתחילת המשמרת">
                    <i />במשמרת <bdi>{shiftInfo.text}</bdi>
                  </span>
                )
              )}

              <div
                className={`sn-item${ui.id === 'user' ? ' open' : ''}`}
                data-sn="user"
                onPointerEnter={(e) => handlers.enter(e, 'user')}
                onPointerLeave={(e) => handlers.leave(e, 'user')}
                onKeyDown={(e) => handlers.key(e, 'user')}
              >
                <UserButton
                  info={info}
                  open={ui.id === 'user'}
                  tip={info.name ? `${info.name}${tree.user.roleLabel ? ` · ${tree.user.roleLabel}` : ''}` : undefined}
                  onClick={() => handlers.toggle('user')}
                />
                <div className="sn-panel" id="snUserPanel" role="menu" aria-label="משתמש">
                  <UserPanelBody tree={tree} info={info} items={userItems} activeItemId={act.itemId} onNavigate={onNavigate} onAction={onAction} />
                </div>
              </div>
            </div>

            <button
              type="button"
              className="sn-burger"
              id="snBurger"
              aria-expanded={drawerOpen ? 'true' : 'false'}
              aria-controls="snDrawer"
              aria-label={drawerOpen ? 'סגירת התפריט' : 'פתיחת התפריט'}
              data-tip="תפריט"
              onClick={() => { closeAll(); setDrawerOpen((d) => !d); }}
            >
              <Ic n="menu" cls="m" />
              <Ic n="x" cls="x" />
              {nf.unread > 0 && <span className="sn-badge">{burgerCount}</span>}
            </button>

            <div className={`sn-drawer${drawerOpen ? ' open' : ''}`} id="snDrawer" aria-label="תפריט ראשי">
              {drawerOpen && searchOn && (
                <SearchBody
                  idPrefix="snd"
                  search={search}
                  nav={nav}
                  tree={tree}
                  menu={false}
                  drawer
                  onGo={onGo}
                  onClearRecents={clearRecents}
                  inputRef={drawerSearchRef}
                />
              )}
              <div style={q ? { display: 'none' } : undefined}>
                {bellOn && (
                  <>
                    <button type="button" className="sn-acc" id="ntAcc" aria-expanded={acc === 'bell' ? 'true' : 'false'} onClick={() => toggleAcc('bell')}>
                      <SnLi n="bell" />
                      התראות
                      {nf.unread > 0 && <span className="nf-chip">{burgerCount}</span>}
                      <Ic n="chev" cls="sn-chev" />
                    </button>
                    <div className="sn-ab"><div><BellBody nf={nf} rows={bellRows} activeItemId={act.itemId} onNavigate={onNavigate} onAction={onAction} /></div></div>
                  </>
                )}
                {tabs.map((tab) => {
                  const hasMenu = (tab.items || []).some((x) => x.kind === 'link' || x.kind === 'action');
                  const isAct = act.tabId === tab.id;
                  if (tab.soon) {
                    return (
                      <span key={tab.id} className="sn-acc is-miss" aria-disabled="true" data-tip={tab.tip || undefined}>
                        <SnLi n={tab.icon} />{tab.label}<span className="sn-k">{SOON_LABEL}</span>
                      </span>
                    );
                  }
                  if (!hasMenu) {
                    return (
                      <Link key={tab.id} className={`sn-acc${isAct ? ' active' : ''}`} href={tab.href || '/'} onClick={(e) => onNavigate(e, tab.href || '/')}>
                        <SnLi n={tab.icon} />{tab.label}
                      </Link>
                    );
                  }
                  return (
                    <div key={tab.id}>
                      <div className={`sn-accrow${acc === tab.id ? ' open' : ''}`}>
                        {tab.href ? (
                          <Link className={`sn-acc${isAct ? ' active' : ''}`} href={tab.href} onClick={(e) => onNavigate(e, tab.href)}>
                            <SnLi n={tab.icon} />{tab.label}
                          </Link>
                        ) : (
                          <button type="button" className={`sn-acc${isAct ? ' active' : ''}`} onClick={() => toggleAcc(tab.id)}>
                            <SnLi n={tab.icon} />{tab.label}
                          </button>
                        )}
                        <button type="button" className="sn-accx" aria-expanded={acc === tab.id ? 'true' : 'false'} aria-label={`תפריט ${tab.label}`} onClick={() => toggleAcc(tab.id)}>
                          <Ic n="chev" />
                        </button>
                      </div>
                      <div className="sn-ab"><div><MenuRows items={tab.items} activeItemId={act.itemId} onNavigate={onNavigate} onAction={onAction} /></div></div>
                    </div>
                  );
                })}
                <div>
                  <div className={`sn-accrow${acc === 'user' ? ' open' : ''}`}>
                    <span className="sn-acc" style={{ cursor: 'default' }}>
                      <SnLi n="user" />
                      <span>{info.logged ? info.name : 'אורח'}</span>
                    </span>
                    <button type="button" className="sn-accx" aria-expanded={acc === 'user' ? 'true' : 'false'} aria-label="תפריט משתמש" onClick={() => toggleAcc('user')}>
                      <Ic n="chev" />
                    </button>
                  </div>
                  <div className="sn-ab"><div><MenuRows items={userItems} activeItemId={act.itemId} onNavigate={onNavigate} onAction={onAction} /></div></div>
                </div>
                <div className="sn-dtools">
                  {rail.errorReport && rail.errorReport.show && (
                    <button type="button" className="sn-link" onClick={() => { setDrawerOpen(false); clickHidden('[data-sn-err]'); }}>
                      <SnLi n="sn-bug" />דיווח על שגיאה
                    </button>
                  )}
                  {rail.oldSite && rail.oldSite.show && (
                    <button type="button" className="sn-link" disabled={busy} data-tip="האתר הישן (זמני) · קישור זמני, עד שכל המסכים יעברו לאתר החדש" onClick={() => onAction({ action: rail.oldSite.action })}>
                      <SnLi n="ext" />האתר הישן
                    </button>
                  )}
                </div>
                <div className="sn-dfoot">
                  <span className="sn-av">{info.initials || <Ic n="user" cls="sm" />}</span>
                  <div>
                    <b>{info.logged ? info.name : 'אורח'}</b>
                    {shiftInfo ? (shiftInfo.kind === 'stale' ? <small className="snShiftWarn" data-tip={shiftInfo.tip}>{shiftInfo.text}</small> : <small>במשמרת <bdi className="snShiftM">{shiftInfo.text}</bdi></small>) : null}
                  </div>
                </div>
              </div>
            </div>
          </header>
          <div id="snScrim" className={drawerOpen ? 'on' : ''} onClick={() => setDrawerOpen(false)} />
          <div className="pl-tt" role="tooltip" ref={ttRef} />
          {tree.meta && tree.meta.managementMessages && !hideInternalMessaging && tree.user && tree.user.logged && (
            <ManagerMessageDialog
              open={msgOpen}
              onClose={() => setMsgOpen(false)}
              onSent={() => notify('ההודעה נשלחה למנהל', 'success')}
            />
          )}
        </div>

        {/* תוכן הדף: אותם class-ים כמו במעטפת הישנה (.app-shell > .main > .content), כדי שריווח הדפים, כיוון הטקסט וגודל הטקסט
            (data-text-scale) יישארו כפי שהם. */}
        <div className="app-shell a5-body">
          <div className="main">
            <div className="content">{children}</div>
          </div>
        </div>
      </div>
    </A5ShellProvider>
  );
}
