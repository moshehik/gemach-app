/* A5 shell adapter: סרגל אתר עליון, חיפוש, פעמון התראות, שעון משמרת, תפריט משתמש, תחתית, פס הודעות.
   קריאה בלבד מול השרת; נתיבי הכתיבה (סימון נקרא / ארכוב / יציאה) כתובים לפי הקוד הקיים ולא הורצו בבדיקות. */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  const api = (p, o) => (A5.api ? A5.api(p, o) : fetch(p, { credentials: 'same-origin' }).then(r => r.json()));

  /* ---------- מצב ---------- */
  const st = { boot: null, me: null, activeShift: null, settings: {}, ready: null, notif: null };

  /* ---------- מפת ניווט: תווית באב-טיפוס -> כתובת אמיתית + כלל תצוגה ----------
     src:'nav'   = מופיע ב-navGroups מ-/api/a5/boot (אותו סינון הרשאות כמו התפריט הצדדי באתר)
     כל השאר: כתובת קבועה + כלל זהה לקוד החי (UserMenu.js, app/page.js QUICK_LINKS, app/admin/page.js). */
  const head = () => !!(st.boot && st.boot.isHead);
  const authed = () => !!(st.boot && st.boot.authenticated && st.boot.employee);
  const msgOn = () => (st.settings.hide_internal_messaging || 'false') !== 'true';
  const EXTRA = {
    'מחירון':        { href: '/dashboard/pricelist', ok: head },   // app/dashboard/pricelist/layout.js: הנהלה ראשית/מתכנת
    'ניהול מחירון':  { href: '/dashboard/pricelist', ok: head },   // כרטיס ב-app/admin/page.js
    'לוח ניהול':     { href: '/admin', ok: head },                  // navConfig: showAdminTab=isHead
    'הגדרות מערכת':  { href: '/admin/settings', ok: head },
    'ניהול אתר':     { href: '/admin/site', ok: head },
    'הרשאות':        { href: '/admin/permissions', ok: head },
    'הודעות':        { href: '/messages', ok: () => authed() && msgOn() },  // UserMenu: hide_internal_messaging
    'שעון נוכחות':   { href: '/punch-clock', ok: authed },
    'השעות שלי':     { href: '/my-hours', ok: authed },
    'עיצוב ותצוגה':  { href: '/display-settings', ok: authed },
    'הפרופיל שלי':   { href: '/profile', ok: authed },
  };
  function navItems() { return ((st.boot && st.boot.navGroups) || []).flatMap(g => g.items || []); }
  function navFind(label) { return navItems().find(i => i.label === label); }
  function navHref(label) {
    const n = navFind(label); if (n) return n.href;
    if (label === 'בית וחיפוש') return '/';
    return EXTRA[label] ? EXTRA[label].href : null;
  }
  function visible(label) {
    if (!st.boot) return false;
    if (navFind(label)) return true;
    if (label === 'בית וחיפוש') return true;
    return EXTRA[label] ? !!EXTRA[label].ok() : false;
  }

  /* מבנה זהה ל-NAV בקובץ ה-HTML; פריטים מוסתרים מוסרים, מפרידים כפולים/בקצה נמחקים, קבוצה ריקה נמחקת.
     כל פריט מקבל גם href. */
  const NAV_PROTO = [
    { k: 'home', label: 'בית וחיפוש', icon: 'home' },
    { k: 'orders', label: 'הזמנות', icon: 'file', items: [
      { l: 'הזמנה חדשה', i: 'plus' }, { l: 'רשימת הזמנות', i: 'file' }, '-',
      { l: 'השכרות', i: 'truck' }, { l: 'החזרות', i: 'check' }, { l: 'משלוחים', i: 'box' }, '-',
      { l: 'זיכויים וחובות', i: 'wallet' }, { l: 'תיקונים', i: 'scissors' }] },
    { k: 'inv', label: 'מלאי', icon: 'bag', items: [{ l: 'קטלוג דגמים', i: 'bag' }, { l: 'מחירון', i: 'tag' }] },
    { k: 'people', label: 'אנשים', icon: 'users', items: [
      { l: 'לקוחות', i: 'users' }, { l: 'עובדים ונוכחות', i: 'userck' }, { l: 'לוח חודשי', i: 'cal' }, { l: 'עמדת לקוח', i: 'eye' }] },
    { k: 'admin', label: 'ניהול', icon: 'shield', items: [
      { l: 'לוח ניהול', i: 'shield' }, '-', { l: 'הגדרות מערכת', i: 'gear' }, { l: 'ניהול אתר', i: 'sliders' }, { l: 'הרשאות', i: 'lock' }, { l: 'ניהול מחירון', i: 'tag' }] },
    { k: 'more', label: 'עוד', icon: 'menu', items: [
      { l: 'הודעות', i: 'msg' }, { l: 'שעון נוכחות', i: 'clock' }, { l: 'השעות שלי', i: 'clock' }, { l: 'עיצוב ותצוגה', i: 'sun' }] },
  ];
  function buildNav() {
    const out = [];
    NAV_PROTO.forEach(g => {
      if (!g.items) { out.push({ k: g.k, label: g.label, icon: g.icon, href: navHref(g.label) }); return; }
      let items = g.items.filter(x => x === '-' || visible(x.l)).map(x => (x === '-' ? x : { l: x.l, i: x.i, href: navHref(x.l) }));
      items = items.filter((x, idx, a) => !(x === '-' && (idx === 0 || idx === a.length - 1 || a[idx - 1] === '-')));
      if (items.some(x => x !== '-')) out.push({ k: g.k, label: g.label, icon: g.icon, items });
    });
    return out;
  }

  /* ---------- משתמש ---------- */
  function user() {
    const e = st.boot && st.boot.employee, me = st.me;
    if (!e) return { loggedIn: false, initial: '?', name: 'אורח', role: 'אורח', sub: 'התחברות לא פעילה', dept: '' };
    const first = (me && me.firstName) || e.firstName || '', last = (me && me.lastName) || '';
    const name = (first + ' ' + last).trim() || e.name;
    const dept = (me && me.department && me.department.name) || '';
    /* UserMenu.js מציג "שם פרטי + שם משפחה" ואת שם המחלקה; תפקיד = roleLabel של boot */
    return { loggedIn: true, initial: (name || 'U').charAt(0), name, role: e.roleLabel, dept,
      sub: e.roleLabel + (dept && dept !== e.roleLabel ? ' · ' + dept : '') };
  }
  function branchName() { return (st.settings.gmach_name || '').replace(/^גמ"ח שמלות\s*/, '') || ''; }

  /* ---------- משמרת ----------
     המקור האמיתי: /api/me -> activeShift (Shift של היום בלי exitTime). באתר החי אין שעון "משך משמרת" -
     רק "בעבודה כעת / לא בעבודה" בתפריט המשתמש; כאן מחשבים את משך המשמרת מ-entryTime. */
  function shift() {
    const s = st.activeShift; if (!s || !s.entryTime) return null;
    return { start: new Date(s.entryTime).getTime() };
  }
  function shiftText() {
    const s = shift(); if (!s) return null;
    const m = Math.max(0, Math.floor((Date.now() - s.start) / 60000));
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }

  /* ---------- חיפוש ---------- */
  const LS_HIST = 'agy_history';
  function recent() {
    let h = []; try { h = JSON.parse(localStorage.getItem(LS_HIST) || '[]'); } catch (e) { /* ריק */ }
    return h.map(x => {
      const id = encodeURIComponent(x.id);
      if (x.type === 'customer') return { l: x.name, sub: x.subtext || '', i: 'user', href: '/customers/' + id };
      if (x.type === 'dress') return { l: x.name, sub: x.subtext || '', i: 'bag', href: '/dashboard/dresses/' + id };
      if (x.type === 'rental') return { l: x.name, sub: x.subtext || '', i: 'file', href: '/rentals?orderId=' + id };
      return { l: x.name, sub: x.subtext || '', i: 'file', href: '/orders/' + id };
    });
  }
  function pages() {
    const p = [];
    buildNav().forEach(g => { if (!g.items) p.push({ l: g.label, i: g.icon, g: '', href: g.href }); else g.items.forEach(x => { if (x !== '-') p.push({ l: x.l, i: x.i, g: g.label, href: x.href }); }); });
    return p;
  }
  function searchPages(q) { q = (q || '').trim(); return q ? pages().filter(p => p.l.includes(q) || p.g.includes(q)) : []; }
  /* כמו TopbarSearch.js: מינימום 2 תווים, הזמנות ואז לקוחות, עד 15. הקורא אחראי לעיכוב (350ms). */
  const CAP = 15;
  async function searchData(q) {
    q = (q || '').trim();
    if (q.length < 2) return { orders: [], customers: [], total: 0 };
    const d = await api('/api/global-search?q=' + encodeURIComponent(q));
    const orders = (d.orders || []).map(o => ({ l: 'הזמנה #' + o.orderId + ' · ' + ((o.firstName || '') + ' ' + (o.lastName || '')).trim(), i: 'file', href: '/orders/' + o.orderId }));
    const customers = (d.customers || []).map(c => ({ l: 'לקוח: ' + ((c.firstName || '') + ' ' + (c.lastName || '')).trim(), sub: c.phone1 || c.city || '', i: 'user', href: '/customers/' + c.id }));
    /* האתר החי חותך את הרשימה המאוחדת ל-15, כך שעם 15+ הזמנות לא מוצג אף לקוח; כאן: עד 8 הזמנות והשאר לקוחות (סה"כ 15) */
    const no = Math.min(orders.length, customers.length ? 8 : CAP);
    return { orders: orders.slice(0, no), customers: customers.slice(0, CAP - no), total: orders.length + customers.length };
  }
  const viewAllHref = q => '/?q=' + encodeURIComponent((q || '').trim());

  /* ---------- התראות (פעמון) ----------
     האתר מציג פעמון רק כשיש מחובר/ת ו-hide_internal_messaging אינו 'true' (AppShell.js). */
  const bellEnabled = () => authed() && msgOn();
  function notifIcon(n) {
    if (n.category === 'shift_handover') return 'clock';
    if (n.category === 'management') return 'shield';
    if (/רזרבה/.test(n.title || '')) return 'bag';
    return n.senderId ? 'msg' : 'bell';
  }
  /* התראות מערכת מזכירות "בהזמנה #12345" - משם נגזר קישור כניסה; אחרת אין כפתור כניסה (href=null) */
  function notifHref(n) { const m = /הזמנה\s*#(\d+)/.exec((n.title || '') + ' ' + (n.content || '')); return m ? '/orders/' + m[1] : null; }
  function mapNotif(n) {
    const who = n.sender ? ((n.sender.firstName || '') + ' ' + (n.sender.lastName || '')).trim() : 'מערכת';
    return { id: n.id, ts: new Date(n.createdAt).getTime(), who, unread: !n.isRead, icon: notifIcon(n),
      title: n.title || 'הודעה', sub: n.content || '', href: notifHref(n), category: n.category || null, handled: !!n.handledAt };
  }
  /* רשימה מלאה (עד 150, לא מאורכבות) בפורמט שורת ההתראה באב-טיפוס: {id,ts,who,unread,icon,title,sub,href} */
  async function notifications() {
    if (!bellEnabled()) return [];
    const d = await api('/api/notifications');
    if (!d || !d.success) return [];
    st.notif = (d.notifications || []).filter(n => !n.isArchived).map(mapNotif);
    return st.notif;
  }
  /* מונה בלבד (הבדיקה הקלה שהאתר מריץ כל 120 שנ') */
  async function unreadCount() {
    if (!bellEnabled()) return 0;
    const d = await api('/api/notifications?light=1');
    return d && d.success ? d.unreadCount : 0;
  }
  /* כתיבה - לפי NotificationBell.js / app/api/notifications/{read,archive}/route.js. לא הורצו בבדיקות. */
  async function markRead(id) { return api('/api/notifications/read', { method: 'POST', body: { notificationId: id } }); }
  async function markAllRead(ids) {
    /* אין נתיב "הכול" בשרת: מסמנים אחד-אחד רק את הלא-נקראות (ids = מזהי השורות שבתצוגה) */
    const list = ids || (st.notif || []).filter(n => n.unread).map(n => n.id);
    return Promise.all(list.map(markRead));
  }
  /* "הסרה"/"ניקוי" באב-טיפוס = ארכוב (הודעה מאורכבת לא מופיעה בפעמון וניתנת לשחזור ב-/messages) */
  async function archive(id) { return api('/api/notifications/archive', { method: 'POST', body: { notificationId: id, archive: true } }); }
  async function archiveAll(ids) { return Promise.all((ids || (st.notif || []).map(n => n.id)).map(archive)); }

  /* ---------- פס הודעות (nbArea) ----------
     מקורות אמיתיים באתר: (1) חלונית "הזמנות שלא הוחזרו" (OverdueRemindersWatcher, כשההגדרה enable_unreturned_orders_popup='true')
     מ-/api/orders/overdue; (2) הודעות "בין משמרות" שלא טופלו (ShiftMessageWatcher) כשהודעות פנימיות פעילות.
     מחזיר מערך בפורמט DEMO של nbAdd: {kind, title, detail, rows:[[icon,text]], go?, href?} */
  async function notices() {
    const out = [];
    const on = k => String(st.settings[k]) === 'true';
    if (!authed()) return out;
    if (on('enable_unreturned_orders_popup')) {
      try {
        const d = await api('/api/orders/overdue');
        const os = (d && d.orders) || [];
        if (os.length) {
          out.push({ kind: 'warning', title: os.length === 1 ? 'משפחה אחת עוד לא החזירה שמלות' : os.length + ' משפחות עוד לא החזירו שמלות',
            detail: 'מועד ההחזרה שלהן עבר',
            rows: os.slice(0, 5).map(o => ['user', 'הזמנה #' + o.orderId + ' · ' + o.customerName + ' · ' + o.daysLate + ' ימי איחור']),
            go: 1, href: '/orders/' + os[0].orderId, more: Math.max(0, os.length - 5) });
        }
      } catch (e) { /* best-effort, כמו באתר */ }
    }
    if (bellEnabled() && on('shift_handover_notes')) {
      try {
        const l = (st.notif || await notifications()).filter(n => n.category === 'shift_handover' && !n.handled);
        l.slice(0, 2).forEach(n => out.push({ kind: 'info', title: 'הודעה למשמרת הבאה', detail: n.who,
          rows: [['note', n.sub || n.title]], id: n.id }));
      } catch (e) { /* ריק */ }
    }
    return out;
  }

  /* ---------- יציאה ----------
     כמו UserMenu.handleLogout: בדיקת "משפחות באיחור" (אישור), POST /api/logout, ואז '/' בטעינה מלאה.
     confirmFn(text)->Promise<boolean> (ברירת מחדל: confirm של הדפדפן). */
  async function logout(confirmFn) {
    try {
      const d = await api('/api/orders/overdue');
      if (d && Array.isArray(d.orders) && d.orders.length) {
        const ask = confirmFn || (t => Promise.resolve(window.confirm(t)));
        const ok = await ask('יש ' + d.orders.length + ' משפחות שעדיין לא החזירו שמלות ומועד ההחזרה שלהן עבר. לצאת בכל זאת?');
        if (!ok) return false;
      }
    } catch (e) { /* לא חוסם יציאה */ }
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ממשיכים */ }
    window.location.href = '/';
    return true;
  }

  /* ---------- תחתית ----------
     קבוצות/מפתחות כמו syncFooter באב-טיפוס. מחזיר רק קישורים שמותרים למשתמש (C-1.25). */
  function footer() {
    const F = (label, key, href, ok) => (ok ? { label, key, href } : null);
    const hasNav = h => navItems().some(i => i.href === h);
    const nav = [F('הזמנות', 'orders', '/orders', hasNav('/orders')), F('לקוחות', 'customers', '/customers', hasNav('/customers')),
      F('שמלות', 'dresses', '/dashboard/dresses', hasNav('/dashboard/dresses')), F('סיכום כספי', 'dashboard', '/dashboard', head())].filter(Boolean);
    /* GAP: באתר אין עמוד "מדריך למשתמש"; "דיווח על תקלה" הוא חלון (ErrorReportButton) ללא כתובת - מוצג רק כשההגדרה hide_error_reporting אינה 'true' */
    const help = [F('דיווח על תקלה', 'report', null, authed() && String(st.settings.hide_error_reporting) !== 'true')].filter(Boolean);
    const me = [F('הפרופיל שלי', 'profile', '/profile', authed()), F('הגדרות תצוגה', 'display', '/display-settings', authed())].filter(Boolean);
    return { groups: [{ h: 'ניווט מהיר', links: nav }, { h: 'עזרה', links: help }, { h: 'החשבון שלי', links: me }],
      name: st.settings.gmach_name || 'גמ״ח שמלות', ver: null, date: null, privacy: PRIVACY };
  }
  /* נוסח "מדיניות פרטיות" החי (חלון ב-app/page.js) - כרגע טקסט זמני באתר עצמו */
  const PRIVACY = { title: 'מדיניות פרטיות', paragraphs: [
    'טקסט זמני למדיניות פרטיות.',
    'כאן יפורטו התנאים הנוגעים לאיסוף ושמירת מידע של משתמשים ולקוחות.',
    'איסוף נתונים: המערכת שומרת פרטים אישיים בסיסיים כגון שם, טלפון וכתובת לצורך יצירת קשר בלבד ולמען תפעול תקין של הגמ"ח.',
    'אבטחת מידע: אנו עושים מאמצים לשמור על בטיחות המידע ולא נעביר אותו לצד שלישי ללא אישור מפורש.'] };

  /* ---------- אתחול ---------- */
  function init() {
    if (st.ready) return st.ready;
    st.ready = (async () => {
      st.boot = A5.boot || (A5.boot = await api('/api/a5/boot').catch(() => null));
      st.settings = Object.assign({}, (st.boot && st.boot.settings) || {});
      /* מפתחות שאינם ב-/api/a5/boot: נשלפים מ-/api/settings (אותה קריאה שהעמוד הראשי החי עושה) */
      const need = ['enable_unreturned_orders_popup', 'hide_error_reporting', 'shift_handover_notes'];
      const jobs = [];
      if (need.some(k => st.settings[k] === undefined)) {
        jobs.push(api('/api/settings').then(a => { (Array.isArray(a) ? a : (a && a.settings) || []).forEach(s => { if (need.includes(s.key)) st.settings[s.key] = s.value; }); }).catch(() => {}));
      }
      if (authed()) jobs.push(api('/api/me').then(d => { if (d && d.success) { st.me = d.employee; st.activeShift = d.activeShift; } }).catch(() => {}));
      await Promise.all(jobs);
      return st;
    })();
    return st.ready;
  }
  async function refreshShift() {
    if (!authed()) return null;
    const d = await api('/api/me').catch(() => null);
    if (d && d.success) { st.me = d.employee; st.activeShift = d.activeShift; }
    return shift();
  }

  A5.shell = { init, state: st, navHref, visible, buildNav, user, branchName, shift, shiftText, refreshShift,
    recent, searchPages, searchData, viewAllHref, bellEnabled, notifications, unreadCount, markRead, markAllRead, archive, archiveAll,
    notices, logout, footer, extraHref: l => (EXTRA[l] ? EXTRA[l].href : null),
    profileHref: '/profile', displayHref: '/display-settings' };
})();
