'use client';

// GuideProvider - "הצבעה" על אלמנטים באתר (עוזר ה-AI: כפתור "הצג לי"; וגם קישור עומק `?gm_guide=id1,id2` שאפשר לשתף).
// מנווט לדף, חושף את האלמנט (פותח את תפריט הסרגל / לשונית / חלונית), גולל למרכז ומדגיש אותו בהילה + בועת הסבר ("צעד 1/3").
//
// אבטחה: מקבל אך ורק מזהים מרישום היעדים (lib/aiGuide/targetsIndex.js). אין סלקטור שרירותי, אין URL שמגיע מהמודל או מהכתובת:
// נתיב הניווט ופרמטר ה-query נלקחים מהרישום; מזהה לא מוכר נזרק בשקט. מצב נפילה: אלמנט לא נמצא תוך כמה שניות => הודעה ידידותית
// ו(אם יש) הדגשת היעד האב (הלשונית/הקבוצה הקרובה). נסגר ב-Esc, בלחיצה מחוץ לבועה, בכפתור סגירה, או אוטומטית אחרי כמה שניות.
// עיצוב: טוקנים של הפלטה (--gm-*) בלבד; כבוד ל-prefers-reduced-motion; RTL; נייד (הבועה נשארת בתוך המסך).
//
// ממשק: window.gmGuide.show(['menu.order-new', ...]) / hide(); אירוע window 'gm:guide' (detail: { ids }).
// אירועים שהפרובידר שולח: 'gm:guide-started' (detail: { rect }) כדי שווידג'ט ה-AI ייסגר אם הוא מסתיר את היעד.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { getTarget } from '@/lib/aiGuide/targetsIndex';
import { GUIDE_PARAM, MAX_GUIDE_STEPS, ANY_ROUTE, parseGuideParam, routeMatches } from '@/lib/aiGuide/schema';
import './guide.css';

const FIND_TIMEOUT_MS = 5000;
const AUTO_HIDE_MS = 16000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

/** האם אלמנט באמת נראה למשתמשת (לא display:none / visibility:hidden / שקוף / ללא גודל). */
function isShown(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cs = window.getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  }
  return true;
}
function findEl(id) {
  const list = document.querySelectorAll(`[data-guide-id="${CSS.escape(id)}"]`);
  for (const el of list) if (isShown(el)) return el;
  return null;
}

/** חושף פאנל/מגירה של התפריט העליון (דסקטופ: החץ של הלשונית; נייד: המבורגר + אקורדיון). */
async function revealMenu(tabId) {
  if (isMobile()) {
    const drawer = document.getElementById('snDrawer');
    if (drawer && !drawer.classList.contains('open')) {
      const burger = document.getElementById('snBurger');
      if (burger) { burger.click(); await sleep(320); }
    }
    const acc = document.querySelector(`#snDrawer [data-guide-acc="${CSS.escape(tabId)}"]`);
    if (acc && acc.getAttribute('aria-expanded') !== 'true') { acc.click(); await sleep(260); }
    return;
  }
  const item = document.querySelector(`.snav .sn-item[data-sn="${CSS.escape(tabId)}"]`);
  if (!item || item.classList.contains('open')) return;
  const trigger = item.querySelector(':scope > [data-sn-trigger]');
  if (trigger) { trigger.click(); await sleep(260); }
}

async function runReveal(steps) {
  for (const s of steps || []) {
    if (s.menu) await revealMenu(s.menu);
    else if (s.click) {
      const el = findEl(s.click);
      if (el) { el.click(); await sleep(260); }
    } else if (s.wait) await sleep(s.wait);
  }
}

/** ממתין לאלמנט (MutationObserver + בדיקה תקופתית) עד timeout; מחזיר אלמנט או null. */
function waitForEl(id, timeout) {
  return new Promise((resolve) => {
    const first = findEl(id);
    if (first) { resolve(first); return; }
    let done = false;
    const finish = (el) => { if (done) return; done = true; mo.disconnect(); clearInterval(iv); clearTimeout(to); resolve(el); };
    const check = () => { const el = findEl(id); if (el) finish(el); };
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-expanded'] });
    const iv = setInterval(check, 250);
    const to = setTimeout(() => finish(null), timeout);
  });
}

function targetUrl(t) {
  const q = t.query ? `?${t.query}` : '';
  return `${t.route}${q}`;
}

export default function GuideProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const sessionRef = useRef(null); // { ids:[], idx, token }
  const tokenRef = useRef(0);
  const hideTimer = useRef(null);
  const [view, setView] = useState(null); // { idx, total, label, hint, rect, missing, message }
  const [mounted, setMounted] = useState(false);
  const elRef = useRef(null);
  const bubbleRef = useRef(null);
  const [bubblePos, setBubblePos] = useState(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  const hide = useCallback(() => {
    tokenRef.current += 1;
    sessionRef.current = null;
    elRef.current = null;
    clearTimeout(hideTimer.current);
    setView(null);
    setBubblePos(null);
  }, []);

  const armAutoHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => hide(), AUTO_HIDE_MS);
  }, [hide]);

  /** מציג את הצעד הנוכחי של הסשן (מנווט אם צריך, חושף, מחפש, מדגיש). */
  const runStep = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess) return;
    const token = ++tokenRef.current;
    const alive = () => tokenRef.current === token && sessionRef.current === sess;
    const id = sess.ids[sess.idx];
    const target = getTarget(id);
    const total = sess.ids.length;
    if (!target) { setView({ idx: sess.idx, total, label: '', rect: null, missing: true, message: 'לא מצאתי את המקום הזה באתר.' }); armAutoHide(); return; }

    // 1) ניווט: דף אחר => ממשיכים כשהנתיב ישתנה (האפקט על pathname קורא שוב ל-runStep)
    if (target.route !== ANY_ROUTE && !routeMatches(target.route, pathRef.current)) {
      if (target.route.includes(':')) {
        // אלמנט בתוך רשומה (כרטיס הזמנה/לקוח...) - אי אפשר לנווט אליו בלי לדעת איזו רשומה
        const parent = target.parent ? getTarget(target.parent) : null;
        setView({ idx: sess.idx, total, label: target.label, rect: null, missing: true, message: `"${target.label}" נמצא בתוך כרטיס. פתחי קודם את הרשומה הרצויה ואז בקשי שוב.${parent ? '' : ''}` });
        armAutoHide();
        return;
      }
      sess.pendingRoute = target.route;
      setView({ idx: sess.idx, total, label: target.label, rect: null, missing: false, message: `עוברת אל "${target.label}"...` });
      router.push(targetUrl(target));
      return;
    }
    sess.pendingRoute = null;

    // 2) חשיפה + חיפוש (גם לאלמנט שנטען באיחור)
    let el = findEl(id);
    if (!el && target.reveal && target.reveal.length) { await runReveal(target.reveal); if (!alive()) return; }
    if (!el) el = await waitForEl(id, FIND_TIMEOUT_MS);
    if (!alive()) return;

    // 3) נפילה: האלמנט לא נמצא => היעד האב הקרוב
    let usedFallback = null;
    if (!el) {
      let p = target.parent ? getTarget(target.parent) : null;
      let guard = 0;
      while (p && !el && guard++ < 4) {
        const found = findEl(p.id) || (p.reveal && p.reveal.length ? (await runReveal(p.reveal), findEl(p.id)) : null);
        if (found) { el = found; usedFallback = p; }
        else p = p.parent ? getTarget(p.parent) : null;
      }
      if (!alive()) return;
    }
    if (!el) {
      setView({ idx: sess.idx, total, label: target.label, rect: null, missing: true, message: `לא הצלחתי למצוא את "${target.label}" בדף הנוכחי. נסי לחפש אותו בסרגל העליון (אייקון החיפוש).` });
      armAutoHide();
      return;
    }

    // 4) גלילה למרכז והדגשה
    elRef.current = el;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch { el.scrollIntoView(); }
    await sleep(reducedMotion() ? 60 : 420);
    if (!alive()) return;
    const rect = el.getBoundingClientRect();
    const hint = usedFallback ? `לא מצאתי את "${target.label}" כרגע. זה המקום הקרוב: ${usedFallback.label}` : (target.hint || target.label);
    setView({ idx: sess.idx, total, label: usedFallback ? usedFallback.label : target.label, hint, rect: rectToObj(rect), missing: false, fallback: !!usedFallback });
    try { window.dispatchEvent(new CustomEvent('gm:guide-started', { detail: { rect: rectToObj(rect) } })); } catch { /* ignore */ }
    armAutoHide();
  }, [armAutoHide, router]);

  const start = useCallback((rawIds) => {
    const ids = [];
    for (const raw of Array.isArray(rawIds) ? rawIds : []) {
      const id = String(raw || '').trim().toLowerCase();
      if (id && getTarget(id) && !ids.includes(id)) ids.push(id);
      if (ids.length >= MAX_GUIDE_STEPS) break;
    }
    if (!ids.length) return false;
    sessionRef.current = { ids, idx: 0, pendingRoute: null };
    runStep();
    return true;
  }, [runStep]);

  const go = useCallback((delta) => {
    const sess = sessionRef.current;
    if (!sess) return;
    const next = sess.idx + delta;
    if (next < 0 || next >= sess.ids.length) { if (next >= sess.ids.length) hide(); return; }
    sess.idx = next;
    runStep();
  }, [hide, runStep]);

  // API גלובלי + אירוע
  useEffect(() => {
    const api = { show: (ids) => start(ids), hide, isActive: () => !!sessionRef.current };
    window.gmGuide = api;
    const onEvt = (e) => start(e && e.detail && e.detail.ids);
    window.addEventListener('gm:guide', onEvt);
    return () => { window.removeEventListener('gm:guide', onEvt); if (window.gmGuide === api) delete window.gmGuide; };
  }, [start, hide]);

  // קישור עומק: ?gm_guide=... (קורא וגם מנקה מהכתובת). וגם המשך סשן אחרי ניווט.
  useEffect(() => {
    const sess = sessionRef.current;
    if (sess && sess.pendingRoute && routeMatches(sess.pendingRoute, pathname)) { runStep(); return; }
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(GUIDE_PARAM);
      if (raw) {
        url.searchParams.delete(GUIDE_PARAM);
        window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
        start(parseGuideParam(raw));
      }
    } catch { /* ignore */ }
  }, [pathname, runStep, start]);

  // מעקב אחרי מיקום האלמנט (גלילה, שינוי גודל, מסגרת הנפשה) כל עוד ההדגשה פעילה. אלמנט שנעלם (תפריט שנסגר) => מסיימים.
  const hasRect = !!(view && view.rect);
  const stepIdx = view ? view.idx : -1;
  useEffect(() => {
    if (!hasRect || !elRef.current) return undefined;
    let raf = 0;
    let last = '';
    let hiddenSince = 0;
    const tick = () => {
      const el = elRef.current;
      if (!el) return;
      if (el.isConnected && isShown(el)) {
        hiddenSince = 0;
        const r = rectToObj(el.getBoundingClientRect());
        const key = JSON.stringify(r);
        if (key !== last) { last = key; setView((v) => (v && v.rect ? { ...v, rect: r } : v)); }
      } else {
        hiddenSince = hiddenSince || Date.now();
        if (Date.now() - hiddenSince > 700) { hide(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasRect, stepIdx, hide]);

  // סגירה: Esc, לחיצה מחוץ לבועה
  useEffect(() => {
    if (!view) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    const onDown = (e) => {
      if (bubbleRef.current && bubbleRef.current.contains(e.target)) return;
      // לחיצה על היעד עצמו (או מחוץ לו) מסיימת את ההדגשה; הלחיצה ממשיכה כרגיל לאלמנט
      hide();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown, true); };
  }, [view, hide]);

  // מיקום הבועה לפי גודלה
  useLayoutEffect(() => {
    if (!view || !bubbleRef.current) return;
    const b = bubbleRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!view.rect) { setBubblePos({ top: Math.max(12, vh / 2 - b.height / 2), left: Math.max(8, vw / 2 - b.width / 2), place: 'center', arrow: 0 }); return; }
    const r = view.rect;
    const gap = 14;
    let place = 'below';
    let top = r.top + r.height + gap;
    if (top + b.height > vh - 8) { place = 'above'; top = r.top - b.height - gap; }
    if (top < 8) { place = 'below'; top = Math.min(vh - b.height - 8, Math.max(8, r.top + r.height + gap)); }
    const cx = r.left + r.width / 2;
    const left = Math.max(8, Math.min(vw - b.width - 8, cx - b.width / 2));
    const arrow = Math.max(18, Math.min(b.width - 18, cx - left));
    setBubblePos({ top, left, place, arrow });
  }, [view]);

  if (!mounted || !view) return null;
  const r = view.rect;
  const pad = 5;
  const ringStyle = r ? { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 } : null;
  const multi = view.total > 1;
  return createPortal(
    <div className="gm-guide" dir="rtl" data-guide-overlay="">
      {ringStyle && <div className={`gm-guide-ring${reducedMotion() ? ' is-still' : ''}`} style={ringStyle} aria-hidden="true" />}
      <div
        ref={bubbleRef}
        className={`gm-guide-bubble${view.missing ? ' is-missing' : ''}`}
        data-place={bubblePos ? bubblePos.place : 'below'}
        style={bubblePos ? { top: bubblePos.top, left: bubblePos.left, '--gm-guide-arrow': `${bubblePos.arrow}px` } : { top: -9999, left: -9999 }}
        role="status"
        aria-live="polite"
      >
        {multi && <div className="gm-guide-step">צעד {view.idx + 1} מתוך {view.total}</div>}
        <div className="gm-guide-text">{view.missing ? view.message : (view.hint || view.label)}</div>
        <div className="gm-guide-actions">
          {multi && view.idx > 0 && <button type="button" className="gm-guide-btn" onClick={() => go(-1)}>הקודם</button>}
          {multi && view.idx < view.total - 1 && <button type="button" className="gm-guide-btn is-primary" onClick={() => go(1)}>הבא</button>}
          <button type="button" className="gm-guide-btn" onClick={hide}>{multi && view.idx < view.total - 1 ? 'סיום' : 'הבנתי'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function rectToObj(r) {
  return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
}
