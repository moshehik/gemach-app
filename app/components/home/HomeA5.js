'use client';

// דף הבית החדש (A5) — נבחר ע"י HomeSwitch כש-useUiVariant('home') === 'a5'. עיצוב: תצוגות-עיצוב/דף-הבית.html,
// רכיבי פלטה בלבד (design-system/COMPONENTS.md, בית 1-53) בתוך .gm-ds.gm-home; מה שחסר בפלטה — home.css.
// לוגיקה (קריאות API, פורמט תוצאות): public/a5/adapters + public/a5/index.html, בקוד טהור ב-homeLogic.js.
//
// מה כלול: ברכה אישית, חיפוש כללי (רשימה מאוחדת / טבלה, ייצוא), חיפוש חכם (AI) בתוך כרטיס, חיפוש מתקדם,
// תחתית אתר + מדיניות פרטיות, ?q= (הרצה מיידית וניקוי הכתובת — כמו LegacyHome).
// מה לא כלול כאן: סרגל עליון, "הודעה למנהל" ושעון משמרת — הם חלק מהמעטפת החדשה (ShellSwitch / UI-1) ולכן לא
// מוכפלים בדף; מתחת למעטפת הישנה (shell=legacy) אין אותם (כמו היום). "הזמנות שלא הוחזרו" נשאר במעטפת.

import '@/design-system/components.css';
import './home.css';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SettingQuickPanel from '../SettingQuickPanel';
import { Ic, HomeSprite } from './HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import PageVariantToggle from '../variant/PageVariantToggle';
import HomeResults from './HomeResults';
import HomeChat from './HomeChat';
import HomeAdvanced from './HomeAdvanced';
import HomeAdvResults from './HomeAdvResults';
import HomeMine from './HomeMine';
import useBackupSwitchCommand from './useBackupSwitchCommand';
import { HomeFooter, PrivacyDialog } from './HomeFooter';
import { buildSearchSheet, sectionsFromGeneral, sectionFromRecords } from './searchPdf';
import { QuickPrefixList, useDraftCount, useLocalRecentRows, useMyActivity, useQuickPrefix } from '../search/QuickPrefix';
import { useSavedSearches, rememberSearch } from '../search/savedSearches';
import { DeleteDialog, GuideButton, GuideDialog, SaveIconButton } from '../search/ShortcutsUi';
import { actionTarget, guideRows, keywordInsert, saveCandidate } from '@/lib/quickShortcuts';
import SearchKeySync from '../search/SearchKeySync';
import { buildMineModel, mineExportRecords, mineSheetSections } from '@/lib/myRecentActivityView';
import { HOME_NAV_EVENT, homeNavTarget } from '@/lib/menu/homeNav';
import {
  AI_CONTEXT, buildGreeting, normalizeSearch, resultsCount, unifiedRows, exportRecordsForRows,
  botMessageFromResponse, botErrorMessage, chatToHistory, withoutActionKeys, rowsToCsv, threadToCsv,
  printThreadHtml, footerGroups,
  HOME_SCOPES, parseHomeParams, homeDirectiveKey, homeScopeTitle, applyScope, scopedAdvFields, safeInternalRoute,
} from './homeLogic';
import {
  ADV_FOCI, emptyAdv, advSummaryParts, advAiPrompt, buildAdvRequest, normalizeAdvResponse, navPathSet, visibleFoci, advMissing,
} from './homeAdvConfig';

const STORE_KEY = 'a5HomeSearch'; // sessionStorage: החיפוש האחרון (כדי שחזרה מהזמנה תחזיר את התוצאות)

class HttpError extends Error {
  constructor(status, message) { super(message || 'HTTP ' + status); this.status = status; }
}
async function getJson(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    let msg = '';
    try { const d = await res.json(); msg = (d && (d.error || d.message)) || ''; } catch { /* לא JSON */ }
    throw new HttpError(res.status, msg);
  }
  return res.json();
}

// שורת התוצאה הראשונה (קישור או שורת מלאי בלי קישור) - למעבר מקלדת מהשורת חיפוש; false כשאין
function focusFirstResult() {
  const el = document.querySelector('.res-one .lrow');
  if (!el) return false;
  el.focus();
  return true;
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// חלון הדפסה: HTML RTL פשוט שלא תלוי במשתני ערכת הנושא של האתר. false = חוסם חלונות קופצים
function printHtml(html) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
  return true;
}

// החלפת הכתובת בלי ניווט (Next מסנכרן את usePathname / useSearchParams); qs בלי '?'
function replaceUrl(qs) {
  try { window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '')); } catch { /* ignore */ }
}

export default function HomeA5() {
  const router = useRouter();
  const tryBackupCommand = useBackupSwitchCommand(); // "עבור למסד הגיבוי" בשורת החיפוש (למורשים בלבד)
  const [boot, setBoot] = useState(null);
  const [bootDone, setBootDone] = useState(false);
  const [version, setVersion] = useState(null);

  const [view, setView] = useState('start'); // start | results | none | error | ai | adv | mine ("השינויים שלי")
  const [q, setQ] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [resQuery, setResQuery] = useState(''); // הטקסט שהפיק את התוצאות המוצגות (לא מה שמוקלד עכשיו): מס' הזמנה מדויק קודם, הדגשה, ייצוא
  const [resKey, setResKey] = useState(0);
  const [advRes, setAdvRes] = useState(null); // { focus, data, summary }
  const [chat, setChat] = useState([]);
  const [asTable, setAsTable] = useState(false);
  const [adv, setAdv] = useState(() => emptyAdv());
  const [advPrev, setAdvPrev] = useState('start');
  const [advEnter, setAdvEnter] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [errStatus, setErrStatus] = useState(0);
  const [openSettingKey, setOpenSettingKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false); // מדריך הקיצורים (כפתור "קיצורים" ליד "לחיפוש חכם")
  const [heroEnter, setHeroEnter] = useState(true);
  // סינון לקטגוריה (קישורי תפריט "בית": /?scope=customers...). תמיד אחד ממפתחות HOME_SCOPES (רשימה סגורה), לעולם לא טקסט מהכתובת.
  const [scope, setScope] = useState(null);
  const [wantAdv, setWantAdv] = useState(false); // /?adv=1: נפתח ישר לחיפוש המתקדם ברגע שההרשאות נטענו
  const scopeRef = useRef(null);
  const urlMode = useRef(null); // { kind: 'adv'|'recent'|'mine', open } — הפרמטר נשאר בכתובת כל עוד המצב פעיל (להדגשת פריט התפריט)
  const mine = useMyActivity(); // "השינויים שלי" ('&' / ?recent=mine): נתוני GET /api/me/recent-activity, נטענים רק כשצריך; ההנהלה בוחרת עובדת אחרת (mine.setWho)
  const setMineWho = mine.setWho;
  const appliedKey = useRef('');
  const seq = useRef(0);
  const toastTimer = useRef(null);
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  usePageTooltip(rootRef, ttRef, false);
  // לחיצה על אייקון השמירה (נוגעים במסך מגע: ריחוף מדומה מציג את הטולטיפ) - הטולטיפ נסגר, וההודעה "החיפוש נשמר" לוקחת את מקומו
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const hide = (e) => { if (e.target.closest && e.target.closest('.pfx-save') && ttRef.current) ttRef.current.classList.remove('on'); };
    root.addEventListener('click', hide, true);
    return () => root.removeEventListener('click', hide, true);
  }, []);
  const [pendingRun, setPendingRun] = useState(null); // /?run=: ההרצה מתבצעת באפקט שמוגדר אחרי runQuick (באפקט הפתיחה runQuick עוד לא קיים)
  const lastQuery = useRef({ text: '', ai: false });
  const advFailed = useRef(false); // כרטיס השגיאה נולד מחיפוש מתקדם — "לנסות שוב" מריץ אותו שוב (ולא את החיפוש הכללי האחרון)

  /* ---------- אתחול: מי מחובר, הגדרות, גרסה ---------- */
  useEffect(() => {
    let alive = true;
    Promise.all([
      getJson('/api/a5/boot').catch(() => null),
      getJson('/api/a5/version').catch(() => null),
    ]).then(([b, v]) => {
      if (!alive) return;
      setBoot(b);
      setVersion(v);
      setBootDone(true);
    });
    return () => { alive = false; };
  }, []);

  const settings = useMemo(() => (boot && boot.settings) || {}, [boot]);
  const gmachName = settings.gmach_name || 'גמ״ח שמלות';
  const employee = boot && boot.employee;
  const isManager = !!(boot && boot.isManager);
  const aiAllowed = settings.hide_ai_features !== 'true' && !!(boot && boot.aiAllowed);
  const navPaths = useMemo(() => navPathSet(boot && boot.navGroups), [boot]);
  const advAvailable = useMemo(() => {
    const f = visibleFoci({ settings, isManager, isHead: !!(boot && boot.isHead), navPaths });
    return f.main.length + f.extra.length > 0;
  }, [settings, isManager, boot, navPaths]);
  const greeting = buildGreeting(settings.home_welcome_title, employee && employee.firstName);

  const showToast = useCallback((title, text = '') => {
    setToast({ title, text, n: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ---------- שמירת החיפוש האחרון ---------- */
  const persist = useCallback((text, results) => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ q: text, res: results })); } catch { /* מלא/חסום */ }
  }, []);
  const forget = useCallback(() => {
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  }, []);

  /* ---------- חיפוש חכם ---------- */
  const askAi = useCallback(async (prompt, history, my) => {
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context: AI_CONTEXT, history }),
      });
      if (!r.ok) return botErrorMessage(r.status);
      const data = await r.json();
      if (my !== seq.current) return null;
      return botMessageFromResponse(data);
    } catch {
      return botErrorMessage(0);
    }
  }, []);

  /* ---------- חיפוש מוגבל ל"החזרות" / "תיקונים" ----------
     אין להן קטגוריה בחיפוש הכללי (/api/global-search מחזיר רק לקוחות, הזמנות ופריטי השכרה), ולכן מריצים את תחום החיפוש
     המתקדם שלהן (אותו שרת, אותה הרשאה) לפי הטקסט: שם לקוח / טלפון / קוד הזמנה (scopedAdvFields). לא חיפוש לפי ברקוד או דגם. */
  const runScopedAdv = useCallback(async (query, sc, my) => {
    const focus = HOME_SCOPES[sc].focus;
    const fields = scopedAdvFields(query, focus);
    if (!fields) { setLoading(false); return; }
    const form = { ...emptyAdv(focus), ...fields };
    try {
      const d = await getJson(buildAdvRequest(focus, form, window.localStorage));
      if (my !== seq.current) return;
      const data = normalizeAdvResponse(d);
      setAdv(form); // "עדכן חיפוש" פותח את טופס התחום ממולא
      setAdvPrev('start');
      setAdvRes({ focus, data, summary: { label: ADV_FOCI[focus].label, text: advSummaryParts(form, focus).join(', ') } });
      setChat([]);
      setAsTable(false);
      setLoading(false);
      setView('results');
    } catch (e) {
      if (my !== seq.current) return;
      setLoading(false);
      if (e.status === 403) { setView('start'); showToast('אין הרשאה לחיפוש הזה'); return; }
      setErrStatus(e && e.status ? e.status : 0);
      setView('error');
    }
  }, [showToast]);

  /* ---------- חיפוש ---------- */
  const runSearch = useCallback(async (text, { ai = false } = {}) => {
    const query = String(text || '').trim();
    if (!query) return;
    if (!ai && await tryBackupCommand(query)) return; // פקודת מעבר למסד הגיבוי - לא חיפוש
    lastQuery.current = { text: query, ai };
    advFailed.current = false;
    if (!ai) rememberSearch(query); // "החיפוש האחרון" לשמירה ב-$ + היסטוריית החיפושים של העובדת (שקט; לא תלוי בהצלחת החיפוש)
    const my = ++seq.current;
    setLoading(true);
    setAdvRes(null);
    if (ai) {
      const botMsg = await askAi(query, [], my);
      if (my !== seq.current || !botMsg) return;
      const c = [{ me: true, t: query }, botMsg];
      setChat(c);
      setLoading(false);
      setView('ai');
      return;
    }
    const sc = scopeRef.current;
    if (sc && HOME_SCOPES[sc].via === 'adv') { runScopedAdv(query, sc, my); return; }
    try {
      // extras=1: שורות "מלאי" (ברקוד / מידה / דגם) וצ'יפים של הלו"ז ליום שהוקלד - רק לבית החדש (הצרכנים האחרים של הנתיב לא מבקשים)
      const d = await getJson('/api/global-search?q=' + encodeURIComponent(query) + '&extras=1');
      if (my !== seq.current) return;
      const norm = normalizeSearch(d);
      setResQuery(query);
      setRes(norm); // התשובה המלאה; הסינון לקטגוריה מוחל בתצוגה (applyScope), כדי שהסרת הסינון תחשוף את שאר התוצאות בלי חיפוש חדש
      setChat([]);
      setResKey((k) => k + 1);
      setLoading(false);
      setView(resultsCount(applyScope(norm, sc)) ? 'results' : 'none');
      persist(query, norm);
    } catch (e) {
      if (my !== seq.current) return;
      setLoading(false);
      setErrStatus(e && e.status ? e.status : 0);
      setView('error');
    }
  }, [askAi, persist, runScopedAdv, tryBackupCommand]);

  const followUp = useCallback(async (text) => {
    const my = ++seq.current;
    const hist = chatToHistory(chat);
    setChat((c) => [...c, { me: true, t: text }]);
    setLoading(true);
    const botMsg = await askAi(text, hist, my);
    if (my !== seq.current || !botMsg) return;
    setLoading(false);
    setChat((c) => [...c, botMsg]);
  }, [chat, askAi]);

  const resetAll = useCallback(() => {
    seq.current++;
    setQ('');
    setView('start');
    setChat([]);
    setLoading(false);
    setAdvRes(null);
    setRes(null);
    setResQuery('');
    setMineWho(null); // הבחירה של הנהלה ב"השינויים שלי" לא נשארת אחרי היציאה מהתצוגה: ברירת המחדל היא הרשימות של עצמה
    forget();
  }, [forget, setMineWho]);

  /* ---------- קישורי תפריט "בית": ?scope= / ?adv=1 / ?recent=changes (רשימה סגורה — ר' parseHomeParams) ----------
     המצב מתחיל נקי (בלי לשחזר חיפוש קודם תחת כותרת הקטגוריה). הפרמטר נשאר בכתובת כל עוד המצב פעיל, כדי שהתפריט
     יסמן את הפריט שנלחץ (findActive); יציאה מהמצב מחזירה את הכתובת ל-"/". ?q= (אם יש) מורץ ונמחק מהכתובת. */
  const applyDirective = useCallback((dir, params) => {
    seq.current++;
    setLoading(false);
    setAdvRes(null);
    setChat([]);
    setRes(null);
    setAdvPrev('start');
    setView('start');
    setQ('');
    scopeRef.current = dir.scope;
    setScope(dir.scope);
    appliedKey.current = homeDirectiveKey(dir);
    urlMode.current = null;
    if (dir.adv) {
      urlMode.current = { kind: 'adv', open: false };
      setWantAdv(true);
      return;
    }
    if (dir.run) {
      // /?run=debts|unsaved: פעולת '#' מחיפוש התפריט - תצוגת תוצאות של הזמנות (חובות / טיוטות בעמדה). הפרמטר נמחק מיד מהכתובת
      setPendingRun(dir.run);
      if (params) { params.delete('run'); replaceUrl(params.toString()); } else replaceUrl('');
      return;
    }
    if (dir.recent === 'changes') {
      urlMode.current = { kind: 'recent', open: false };
      setQ('@'); // אותה תוצאה בדיוק כמו הקלדת '@' בשורת החיפוש
    } else if (dir.recent === 'mine') {
      urlMode.current = { kind: 'mine', open: false };
      setMineWho(dir.emp); // /?recent=mine&emp=<id> (הנהלה שבחרה עובדת בחלונית & ולחצה "הכל"); בלי emp = שלי. השרת מסרב למי שאין לה הרשאה והרשימה חוזרת לשלה
      setView('mine'); // "השינויים שלי": כרטיס התוצאות המלא (HomeMine); הקלדת '&' בשורה פותחת את החלונית הקצרה של אותם נתונים
    } else if (dir.q) {
      setQ(dir.q);
      runSearch(dir.q);
      if (params) { params.delete('q'); replaceUrl(params.toString()); }
    }
    if (inputRef.current) inputRef.current.focus();
  }, [runSearch, setMineWho]);

  // ניווט לתוך הדף כשהוא כבר פתוח (לחיצה על פריט תפריט "בית" מדף הבית עצמו): הכתובת משתנה והדף לא נטען מחדש
  const [spKey, setSpKey] = useState(null); // מחרוזת ה-query של הכתובת (מדווחת מ-SearchKeySync); null עד הדיווח הראשון
  const spFirst = useRef(true);
  useEffect(() => {
    if (spKey === null) return;
    if (spFirst.current) { spFirst.current = false; return; } // הדיווח הראשון = הכתובת שבה הדף נפתח (מטופלת באפקט הפתיחה)
    const dir = parseHomeParams(spKey);
    if (dir.any) {
      // אותה הוראה שכבר הוחלה (למשל אחרי שהדף מחק את ?q= מהכתובת) — לא מאפסים
      if (appliedKey.current !== homeDirectiveKey(dir)) applyDirective(dir, null);
      return;
    }
    appliedKey.current = '';
    // כתובת בלי הוראה (לחיצה על "חיפוש כללי"): אם המצב נולד מהוראה וטרם נסגר — חוזרים לדף הרגיל
    if (scopeRef.current || (urlMode.current && urlMode.current.open)) {
      scopeRef.current = null;
      urlMode.current = null;
      setScope(null);
      resetAll();
    }
  }, [spKey]);

  // לחיצה חוזרת על פריט "בית" בתפריט (הכתובת לא משתנה ולכן אפקט spKey לא רץ): מאפסים את הדף להוראה של הפריט שנלחץ.
  // כשהכתובת כן משתנה, appliedKey כבר מעודכן וה-spKey לא יחיל פעם שנייה.
  useEffect(() => {
    const onMenuNav = (e) => {
      const t = homeNavTarget(e && e.detail && e.detail.href);
      if (!t.isHome) return;
      const dir = parseHomeParams(t.query);
      if (dir.any) { applyDirective(dir, null); return; }
      scopeRef.current = null;
      urlMode.current = null;
      appliedKey.current = '';
      setScope(null);
      resetAll();
    };
    window.addEventListener(HOME_NAV_EVENT, onMenuNav);
    return () => window.removeEventListener(HOME_NAV_EVENT, onMenuNav);
  }, [applyDirective, resetAll]);

  // הפרמטר נשאר בכתובת רק כל עוד המצב שהוא פתח פעיל (adv = שלב החיפוש המתקדם פתוח; recent = שורת החיפוש מתחילה ב-'@'; mine = כרטיס "השינויים שלי" פתוח)
  useEffect(() => {
    const m = urlMode.current;
    if (!m) return;
    if (m.kind === 'adv' ? view === 'adv' : m.kind === 'mine' ? view === 'mine' : q.startsWith('@')) { m.open = true; return; }
    if (m.open) { urlMode.current = null; appliedKey.current = ''; replaceUrl(''); }
  }, [view, q]);

  // /?adv=1 — ברגע שההרשאות נטענו: ישר לשלב החיפוש המתקדם (אם אין תחום מותר — נשארים בדף הרגיל)
  useEffect(() => {
    if (!wantAdv || !bootDone) return;
    setWantAdv(false);
    if (advAvailable) { setAdvPrev('start'); setAdv(emptyAdv()); setAdvEnter(false); setView('adv'); }
    else { urlMode.current = null; replaceUrl(''); }
  }, [wantAdv, bootDone, advAvailable]);

  /* ---------- פתיחה: ?q= (כמו LegacyHome), או שחזור החיפוש האחרון ---------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dir = parseHomeParams(params);
    if (dir.any) { applyDirective(dir, params); return; }
    const qParam = params.get('q');
    if (qParam && qParam.trim()) {
      setQ(qParam);
      runSearch(qParam);
      // מנקים מהכתובת כדי שרענון/חזרה לא יריצו שוב מאליהם
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.res && Array.isArray(saved.res.customers) && Array.isArray(saved.res.orders) && Array.isArray(saved.res.rentals)) {
        setQ(saved.q || '');
        setResQuery(saved.q || '');
        setRes({ inventory: [], inventoryTruncated: false, dateChips: null, ...saved.res }); // תשובה ישנה (נשמרה לפני שדות המלאי / הצ'יפים) עדיין תקפה
        setResKey((k) => k + 1);
        setView(resultsCount(saved.res) ? 'results' : 'none');
      }
    } catch { /* פגום */ }
  }, []);
  useEffect(() => { const t = setTimeout(() => setHeroEnter(false), 2000); return () => clearTimeout(t); }, []);

  /* ---------- חיפוש מתקדם ---------- */
  const leaveAdv = () => { seq.current++; setLoading(false); setView(['start', 'results', 'none'].includes(advPrev) ? advPrev : 'start'); };
  const advToggle = () => {
    if (view === 'adv') { leaveAdv(); return; }
    seq.current++; // תשובה של חיפוש שהיה בטעינה לא תחליף את הטופס
    setLoading(false);
    setAdvPrev(view === 'ai' || view === 'error' ? 'start' : view);
    setAdv(emptyAdv());
    setAdvEnter(false);
    setView('adv');
  };
  // מעבר תחום / חזרה לבחירת תחום מבטלים חיפוש שעוד בטעינה (תשובה מאוחרת לא תקפיץ תוצאות של טופס שכבר נעזב)
  const advPick = (focus) => { seq.current++; setLoading(false); setAdvEnter(true); setAdv(emptyAdv(focus)); };
  const advBack = () => { seq.current++; setLoading(false); setAdvEnter(true); setAdv(emptyAdv()); };
  const advClose = leaveAdv;
  const advClear = () => setAdv((a) => emptyAdv(a.focus));

  const applyAdv = useCallback(async (withAi, override) => {
    const cur = override || adv; // override: פעולות '#' (חובות / טיוטות) מריצות טופס מוכן בלי לעבור דרך מצב הטופס
    const f = ADV_FOCI[cur.focus];
    if (!f) return;
    const parts = advSummaryParts(cur, cur.focus);
    if (!parts.length) { showToast('לא נבחרו מסננים', 'מלאו לפחות שדה אחד'); return; }
    // שדה חובה (תפוסה: דגם) — אותה הודעה שהשרת מחזיר ב-400, בלי לשלוח בקשה
    const missing = advMissing(cur.focus, cur);
    if (missing) { showToast('חסר שדה חובה', missing); return; }
    const useAi = !!withAi && f.ai && aiAllowed;
    const summary = { label: f.label, text: parts.join(', ') };
    const my = ++seq.current;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (useAi) {
      setLoading(true);
      setAdvRes(null);
      const prompt = advAiPrompt(cur.focus, parts);
      const botMsg = await askAi(prompt, [], my);
      if (my !== seq.current || !botMsg) return;
      setChat([{ me: true, t: prompt }, botMsg]);
      setLoading(false);
      setView('ai');
      showToast('החיפוש נשלח לחיפוש החכם: ' + f.label, parts.join(', '));
      return;
    }
    setLoading(true);
    advFailed.current = false;
    try {
      const url = buildAdvRequest(cur.focus, cur, window.localStorage);
      const d = await getJson(url);
      if (my !== seq.current) return;
      const data = normalizeAdvResponse(d);
      setAdvRes({ focus: cur.focus, data, summary });
      setLoading(false);
      setAsTable(false);
      setView('results');
      showToast('הסינון הוחל: ' + f.label, parts.join(', '));
      if (data.gaps.length) setTimeout(() => showToast('חלק מהסינונים לא נתמכים', data.gaps.join('; ')), 400);
      if (data.failed.length) setTimeout(() => showToast('חלק מההתראות לא נטענו', data.failed.join(', ') + '. אפשר לנסות שוב בעוד רגע'), 400);
    } catch (e) {
      if (my !== seq.current) return;
      setLoading(false);
      if (e.status === 403 || e.status === 400) {
        setView('adv');
        showToast(e.status === 403 ? 'אין הרשאה לחיפוש הזה' : (/יותר מדי/.test(e.message || '') ? 'החיפוש רחב מדי' : 'חסר שדה חובה'), e.status === 403 ? '' : e.message);
        return;
      }
      setAdvRes(null);
      advFailed.current = true;
      setErrStatus(e && e.status ? e.status : 0);
      setView('error');
    }
  }, [adv, aiAllowed, askAi, showToast]);

  // פעולות '#': "ממתינים לתשלום" (kind 'debts') ו"טיוטות" (kind 'unsaved') = חיפוש מתקדם בתחום הזמנות עם הסימון המתאים, בתצוגת התוצאות הקיימת
  const runQuick = useCallback((kind) => {
    const a = { ...emptyAdv('orders'), flags: [kind] };
    setAdv(a);
    setAdvPrev('start');
    setQ('');
    setAiMode(false);
    applyAdv(false, a);
  }, [applyAdv]);
  useEffect(() => { if (!pendingRun) return; setPendingRun(null); runQuick(pendingRun); }, [pendingRun, runQuick]);

  /* ---------- ייצוא / הדפסה / הורדה ---------- */
  // sheet = { title, sections?, query, queryLabel, scopeChip } — תיאור דף ההדפסה / ה-PDF המעוצב (searchPdf.js). בלי sections:
  // מקטע אחד מהשורות עצמן (חיפוש מתקדם / חכם). אותו דף בדיוק גם להדפסה וגם להורדת PDF; אותן שורות כמו ב-Excel (לא נשלף שום מידע נוסף).
  const exportRows = useCallback(async (kind, rows, title, name, sheet = {}) => {
    if (!rows || !rows.length) return;
    const buildSheet = (forServer) => buildSearchSheet({
      sections: sheet.sections || [sectionFromRecords(rows)].filter(Boolean),
      title: sheet.title || title,
      gmach: gmachName,
      query: sheet.query,
      queryLabel: sheet.queryLabel,
      scopeChip: sheet.scopeChip,
      forServer,
    });
    if (kind === 'excel') {
      try {
        // xlsx (~900KB) נטען רק בלחיצה — לא חלק מה-bundle של הדף (כמו LegacyHome)
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(withoutActionKeys(rows));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'נתונים');
        XLSX.writeFile(wb, name + '.xlsx');
        showToast('הקובץ ירד');
      } catch { showToast('הייצוא נכשל'); }
    } else if (kind === 'download') {
      saveBlob(new Blob(['﻿', rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
      showToast('ההורדה החלה');
    } else if (kind === 'pdf') {
      // PDF אמיתי (טקסט נבחר, עמודים, כותרת ומספרי עמוד) דרך אותו שרת PDF של הזמנות (/api/pdf, מצב html). נטען רק בלחיצה.
      // אין הרשאה / השרת לא זמין → נפתח אותו דף בדיוק בחלון הדפסה ("שמירה כ-PDF" שם), בלי לאבד את התוצאות.
      showToast('מכינים קובץ PDF…');
      try {
        const out = buildSheet(true);
        const { downloadPdf } = await import('@/app/lib/pdfClient');
        await downloadPdf({ html: out.html, landscape: out.landscape, filename: 'search-results' }, out.fileName + '.pdf');
        showToast('ה-PDF ירד');
      } catch {
        if (printHtml(buildSheet(false).html)) showToast('הורדת ה-PDF לא זמינה כרגע', 'נפתח דף הדפסה. אפשר לבחור בו "שמירה כ-PDF"');
        else showToast('חלון ההדפסה נחסם', 'אפשרו חלונות קופצים');
      }
    } else if (printHtml(buildSheet(false).html)) {
      showToast('נשלח להדפסה');
    } else {
      showToast('חלון ההדפסה נחסם', 'אפשרו חלונות קופצים');
    }
  }, [showToast, gmachName]);

  const onExportGeneral = (kind) => exportRows(kind, exportRecordsForRows(unifiedRows(shownRes, resQuery)), 'תוצאות חיפוש', 'Search_Export', {
    sections: sectionsFromGeneral(shownRes, resQuery),
    query: lastQuery.current.text || q,
    scopeChip: scopeDef ? 'רק ' + scopeDef.only : '',
  });
  // "השינויים שלי": אותן שורות כמו על המסך (שני חלקים), אותו דף הדפסה / PDF כמו תוצאות החיפוש; הנהלה שבחרה עובדת אחרת - שמה בכותרת
  const onExportMine = (kind) => {
    const m = buildMineModel({ state: mine.state, data: mine.data }, { limit: null, whoName: mine.whoName });
    exportRows(kind, mineExportRecords(m.sections), 'השינויים שלי', 'My_Changes', {
      title: 'השינויים שלי',
      sections: mineSheetSections(m.sections),
      query: mine.whoName,
      queryLabel: 'עובדת',
    });
  };
  const onExportAdv = (kind) => {
    if (!advRes) return;
    const { data, summary } = advRes;
    const rows = data.rows.map((r) => Object.fromEntries(data.cols.map((c, i) => [c, Array.isArray(r[i]) ? r[i][0] : r[i]])));
    exportRows(kind, rows, 'תוצאות חיפוש מתקדם ' + summary.label, 'Advanced_Search', {
      title: 'תוצאות חיפוש מתקדם',
      query: summary.text,
      queryLabel: 'סינון',
      scopeChip: 'תחום: ' + summary.label,
    });
  };
  const onExportChat = (kind, m) => {
    const at = chat.indexOf(m);
    const asked = at > 0 && chat[at - 1] && chat[at - 1].me ? chat[at - 1].t : '';
    exportRows(kind, m.rows, 'תוצאות חיפוש חכם', 'AI_Export', { title: 'תוצאות חיפוש חכם', query: asked, queryLabel: 'שאלה' });
  };
  const onThread = (kind) => {
    if (kind === 'download') {
      saveBlob(new Blob(['﻿', threadToCsv(chat)], { type: 'text/csv;charset=utf-8' }), 'AI_Chat.csv');
      showToast('ההורדה החלה');
    } else if (printHtml(printThreadHtml('שיחת חיפוש חכם', chat))) showToast('נשלח להדפסה');
    else showToast('חלון ההדפסה נחסם', 'אפשרו חלונות קופצים');
  };
  const copyValue = async (v) => {
    try { await navigator.clipboard.writeText(v); } catch { /* אין הרשאת לוח */ }
    showToast('הועתק', v);
  };

  /* ---------- תצוגה ---------- */
  const joined = view === 'results' || view === 'none' || view === 'adv' || view === 'ai';
  const advResults = view === 'results' && advRes;
  const noBar = view === 'adv' || view === 'ai' || advResults;
  const compact = view !== 'start';
  const canAi = aiAllowed;
  const ai = aiMode && canAi;
  const label = ai ? 'חיפוש חכם' : 'חיפוש';

  // סינון לקטגוריה חל על החיפוש הרגיל בלבד (לא על החיפוש החכם — שם השאלה חופשית)
  const scopeDef = scope && !ai ? HOME_SCOPES[scope] : null;
  const scopeTitle = scopeDef ? homeScopeTitle(scope) : null;
  const shownRes = applyScope(res, scopeDef ? scope : null);
  const removeScope = () => {
    scopeRef.current = null;
    appliedKey.current = '';
    setScope(null);
    replaceUrl('');
    const text = lastQuery.current.text;
    if (advRes) {
      // תוצאות "החזרות"/"תיקונים" (חיפוש מתקדם) לא שייכות יותר לחיפוש הכללי: מנקים ומריצים את אותו טקסט בחיפוש הכללי
      setAdvRes(null);
      if (view === 'results' && text && !lastQuery.current.ai) { setQ(text); runSearch(text); } else if (view === 'results') setView('start');
    } else if (view === 'error' && text && !lastQuery.current.ai) {
      runSearch(text);
    } else if (res && view !== 'adv') {
      // תוצאות שכבר הגיעו (חיפוש כללי מסונן) — מציגים את כולן בלי חיפוש חדש
      setView(resultsCount(res) ? 'results' : 'none');
    }
    if (inputRef.current) inputRef.current.focus();
  };
  // '@' בתחילת השורה = רשימת האחרונים שלי (ההיסטוריה המקומית); "שינויים אחרונים" בתפריט פותח את אותה תוצאה בדיוק
  // '&' בתחילת השורה = "השינויים שלי" (ההזמנות שיצרתי והשינויים שעשיתי; GET /api/me/recent-activity, נטען רק כשצריך)
  // '#' = פעולות מהירות (הזמנה חדשה / טיוטות / ממתינים לתשלום, לפי ההרשאות: navPaths); '$' = חיפושים שמורים אישיים (+ אייקון שמירה ליד ה-X)
  const recentList = useLocalRecentRows();
  const saved = useSavedSearches({ toast: showToast, focusInput: () => { if (inputRef.current) inputRef.current.focus(); } });
  const draftCount = useDraftCount(!ai && q.startsWith('#'));
  const actions = useMemo(() => ({ allowed: navPaths, draftCount }), [navPaths, draftCount]);
  const qp = useQuickPrefix({
    q, rows: recentList, mine, actions, saved, enabled: !ai,
    onPick: (row) => {
      if (row.type === 'keyword') { // '%': מילת המפתח (או הדוגמה, מסומנת) נכנסת לשדה; לא מריצים חיפוש
        const k = keywordInsert(row);
        setQ(k.text);
        setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); try { el.setSelectionRange(k.start, k.end); } catch { /* ignore */ } } }, 0);
        return;
      }
      if (row.type === 'action') {
        const tg = actionTarget(row.action);
        if (!tg) return;
        setQ('');
        if (tg.kind === 'nav') router.push(tg.url); else runQuick(tg.run);
        return;
      }
      if (row.type === 'saved') { setQ(row.query); runSearch(row.query); return; } // חיפוש שמור: מריצים אותו מיד
      const u = safeInternalRoute(row.url);
      if (row.type === 'all') setQ('');
      if (u) router.push(u);
    },
  });
  const saveText = ai ? '' : saveCandidate(q);
  const hasSaveText = !!saveText;
  const loadSaved = saved.load;
  useEffect(() => { if (hasSaveText) loadSaved(); }, [hasSaveText, loadSaved]); // הרשימה נטענת רק כשיש מה לשמור (כדי לסמן חיפוש שכבר שמור), לא בעליית הדף
  const showGuide = !compact && !q && !loading && !ai; // "קיצורים": רק לפני חיפוש, בשדה ריק
  const tryChar = (ch) => {
    setGuideOpen(false);
    setQ(ch);
    setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); try { el.setSelectionRange(ch.length, ch.length); } catch { /* ignore */ } } }, 0);
  };

  // בלי חיפוש חכם, בלי חיפוש מתקדם ובלי סינון לקטגוריה אין מה להציג: לא מרנדרים מיכל ריק
  const modeButtons = !canAi && !advAvailable && !scopeDef && !showGuide ? null : (
    <div className="cmode">
      {showGuide && <GuideButton onClick={() => setGuideOpen(true)} />}
      {scopeDef && (
        <button
          type="button"
          className="cmode-b"
          aria-pressed="true"
          aria-label={`סינון פעיל: חיפוש רק ${scopeDef.only}. לחיצה מסירה את הסינון`}
          data-tip="הסרת הסינון"
          onClick={removeScope}
        >
          <Ic id={scopeDef.icon} />רק {scopeDef.only}<Ic id="x" size="sm" />
        </button>
      )}
      {canAi && (
        <button type="button" className="cmode-b" onClick={() => { setAiMode((v) => !v); if (inputRef.current) inputRef.current.focus(); }}>
          {ai ? <><Ic id="search" />לחיפוש רגיל</> : <><Ic id="sparkle" />לחיפוש חכם</>}
        </button>
      )}
      {advAvailable && (
        <button type="button" className="cmode-b" aria-pressed={view === 'adv'} aria-expanded={view === 'adv'} onClick={advToggle}>
          <Ic id="sliders" />לחיפוש מתקדם
        </button>
      )}
    </div>
  );

  const groups = useMemo(() => footerGroups({
    navGroups: boot && boot.navGroups,
    isHead: boot && boot.isHead,
    authenticated: boot && boot.authenticated,
  }), [boot]);

  return (
    <div className="gm-ds gm-home home-bg" ref={rootRef}>
      <HomeSprite />
      {/* טולטיפ הדף (.pl-tt): ריחוף / מיקוד מקלדת על [data-tip] - כולל אייקון "שמירת חיפוש". המעטפת (MenuA5Shell) מטפלת בטולטיפים רק בסרגל העליון, לא בתוכן הדף */}
      <div className="pl-tt" role="tooltip" ref={ttRef} />
      <Suspense fallback={null}><SearchKeySync onKey={setSpKey} /></Suspense>
      <section className={`hero${heroEnter && !compact ? ' hero-enter' : ''}${compact ? ' hero-compact' : ''}`} aria-label="חיפוש">
        {/* "חזרה לתצוגה הישנה" (4.10.2026): רק להנהלה ראשית / מתכנת. לדף הבית אין סרגל כותרת - פינה עליונה של אזור החיפוש */}
        <PageVariantToggle screen="home" placement="hero" />
        <div className={`hero-in${joined ? ' jshell' : ''}${noBar ? ' advonly' : ''}${view === 'ai' ? ' aishell' : ''}`}>
          {compact && <h1 className="sr-only">חיפוש</h1>}
          {!compact && (
            <h1 className="hero-t">
              <bdi>
                {scopeTitle && <span className="t-q"><span className="t-sc">{scopeTitle.label}</span>{' - ' + scopeTitle.rest}</span>}
                {!scopeTitle && bootDone && (greeting.hi ? <><span className="t-hi">{greeting.hi}</span><span className="t-q">{greeting.q}</span></> : <span className="t-q">{greeting.q}</span>)}
              </bdi>
            </h1>
          )}
          {!noBar && (
            <form
              className="srch"
              role="search"
              onSubmit={(e) => { e.preventDefault(); if (!loading && !qp.open) runSearch(q, { ai }); }}
            >
              <div className="scan">
                <input
                  ref={inputRef}
                  id="sq"
                  aria-label={ai ? 'שאלה לחיפוש החכם' : scopeDef ? `חיפוש רק ${scopeDef.only}` : 'חיפוש לקוח, הזמנה או פריט'}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  disabled={loading}
                  name="gm-home-search"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  data-lpignore="true"
                  data-1p-ignore
                  data-form-type="other"
                  {...qp.inputProps}
                  onKeyDown={(e) => {
                    // חץ למטה משורת החיפוש (כשרשימת הקידומת סגורה) = מעבר לשורת התוצאה הראשונה; בתוך הרשימה החצים מזיזים בין השורות (HomeResults)
                    if (e.key === 'ArrowDown' && view === 'results' && !qp.open && !e.altKey && focusFirstResult()) { e.preventDefault(); return; }
                    qp.onKeyDown(e);
                  }}
                  onFocus={qp.onFocus}
                  onBlur={qp.onBlur}
                />
                {q && !loading && (
                  <button type="button" className="ibtn" aria-label="ניקוי החיפוש" data-tip="ניקוי הכול" onClick={() => { resetAll(); if (inputRef.current) inputRef.current.focus(); }}><Ic id="x" size="sm" /></button>
                )}
                {!loading && <SaveIconButton text={q} saved={saved} ibtn />}
                {joined && modeButtons}
                <button type="submit" className="btn primary" aria-label={loading ? (ai ? 'חושבים' : 'מחפשים') : label} data-tip={label} disabled={loading}>
                  {loading ? <span className="mspin" aria-hidden="true" /> : <Ic id={ai ? 'send' : 'search'} />}
                </button>
                <QuickPrefixList qp={qp} />
              </div>
              {!joined && modeButtons && <div className="hero-row">{modeButtons}</div>}
            </form>
          )}
          {/* שורת "למצגת הסבר" (9.10.2026): קישור לדף הנחיתה /landing (נפתח בלשונית חדשה, כמו הקישור שבתחתית הדף); רק בדף הבית הריק, לא בתוצאות / בחיפוש מתקדם */}
          {!noBar && view === 'start' && showGuide && (
            <a className="tour-line" href="/landing" target="_blank" rel="noopener">
              <span className="tour-ic"><Ic id="sparkle" size="sm" /></span>
              <span className="tour-t">למצגת הסבר על האתר <b>לחצי כאן</b></span>
            </a>
          )}
          {view === 'adv' && (
            <HomeAdvanced
              adv={adv}
              setAdv={setAdv}
              settings={settings}
              isManager={isManager}
              isHead={!!(boot && boot.isHead)}
              navPaths={navPaths}
              aiAllowed={aiAllowed}
              entering={advEnter}
              onPick={advPick}
              onBack={advBack}
              onClose={advClose}
              onApply={applyAdv}
              onClear={advClear}
              loading={loading}
            />
          )}
          {view === 'ai' && (
            <HomeChat
              chat={chat}
              loading={loading}
              table={asTable}
              onTable={setAsTable}
              onClose={resetAll}
              onFollowUp={followUp}
              onExport={onExportChat}
              onThread={onThread}
              onCopyValue={copyValue}
              onOpenSetting={setOpenSettingKey}
              onOpenRoute={(r) => router.push(r)}
            />
          )}
          {view === 'mine' && <HomeMine mine={mine} onClose={resetAll} table={asTable} onTable={setAsTable} onExport={onExportMine} />}
          {advResults && (
            <HomeAdvResults
              data={advRes.data}
              focus={advRes.focus}
              summary={advRes.summary}
              table={asTable}
              onTable={setAsTable}
              onEdit={() => { setAdvEnter(true); setView('adv'); }}
              onReopenClear={() => { setAdv(emptyAdv(advRes.focus)); setAdvEnter(true); setView('adv'); }}
              onClose={resetAll}
              onExport={onExportAdv}
            />
          )}
          {(view === 'results' && !advRes) || view === 'none' ? (
            <HomeResults
              key={resKey}
              res={shownRes}
              query={resQuery}
              none={view === 'none'}
              table={asTable}
              onTable={setAsTable}
              onExport={onExportGeneral}
              note={scopeDef && resultsCount(res) > 0 && resultsCount(shownRes) === 0 ? 'יש תוצאות בקטגוריות אחרות. כדי לראות אותן יש להסיר את הסינון.' : ''}
            />
          ) : null}
        </div>
      </section>

      <div className="app" id="app">
        <section className="panel on home-p" aria-label="תוכן עמוד הבית">
          {view === 'error' && (
            // הודעת שגיאת חיפוש (8.10.2026): מדליון זהב על כחול, כותרת, הסבר, קוד תקלה וכפתורי פעולה. 401 = פג תוקף הכניסה → "להתחברות מחדש"
            // (רענון הדף מציג את מסך הכניסה); כל שגיאה אחרת = "לנסות שוב".
            <div className="card err-card" role="alert">
              <div className="err-medal"><Ic id={errStatus === 401 ? 'lock' : 'alert'} size="lg" /></div>
              <div className="err-title">החיפוש לא הצליח</div>
              <div className="err-sub">{errStatus === 401 ? 'פג תוקף הכניסה. יש להתחבר מחדש.' : 'אין חיבור לשרת כרגע.'}</div>
              <div className="err-code">{errStatus ? `קוד ${errStatus}` : 'אין חיבור'}</div>
              <div className="err-acts">
                {errStatus === 401 ? (
                  <button type="button" className="btn primary" onClick={() => window.location.reload()}><Ic id="user" />להתחברות מחדש</button>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      if (advRes || advFailed.current) { applyAdv(false); return; }
                      runSearch(lastQuery.current.text || q, { ai: lastQuery.current.ai });
                    }}
                  ><Ic id="refresh" />לנסות שוב</button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <HomeFooter groups={groups} name={gmachName} version={version && version.version} date={version && version.date} onPrivacy={() => setPrivacyOpen(true)} />

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} settings={settings} />}
      {guideOpen && <GuideDialog rows={guideRows({ mineUsable: mine.state !== 'denied' })} onTry={tryChar} onClose={() => setGuideOpen(false)} skin="home" />}
      {saved.confirm && <DeleteDialog key={saved.confirm.id} confirm={saved.confirm} onConfirm={saved.confirmDelete} onCancel={saved.cancelDelete} skin="home" />}
      {openSettingKey && <SettingQuickPanel settingKey={openSettingKey} onClose={() => setOpenSettingKey(null)} />}
      {toast && (
        <div id="toast" className="info on pulse" data-kind="info" role="status" aria-live="polite" key={toast.n}>
          <button type="button" className="tclose" aria-label="סגירה" data-tip="סגור" onClick={() => setToast(null)}><Ic id="x" size="sm" /></button>
          <div className="tb"><Ic id="info" size="lg" /></div>
          <div><b>{toast.title}</b><small>{toast.text}</small></div>
        </div>
      )}
    </div>
  );
}
