'use client';

// דף הבית החדש (A5) — נבחר ע"י HomeSwitch כש-useUiVariant('home') === 'a5'. עיצוב: תצוגות-עיצוב/דף-הבית.html,
// רכיבי פלטה בלבד (design-system/COMPONENTS.md, בית 1-53) בתוך .gm-ds.gm-home; מה שחסר בפלטה — home.css.
// לוגיקה (קריאות API, פורמט תוצאות): public/a5/adapters + public/a5/index.html, בקוד טהור ב-homeLogic.js.
//
// מה כלול: ברכה אישית, חיפוש כללי (רשימה מאוחדת / טבלה, ייצוא), חיפוש חכם (AI) בתוך כרטיס, חיפוש מתקדם,
// "אחרונים", תחתית אתר + מדיניות פרטיות, ?q= (הרצה מיידית וניקוי הכתובת — כמו LegacyHome).
// מה לא כלול כאן: סרגל עליון, "הודעה למנהל" ושעון משמרת — הם חלק מהמעטפת החדשה (ShellSwitch / UI-1) ולכן לא
// מוכפלים בדף; מתחת למעטפת הישנה (shell=legacy) אין אותם (כמו היום). "הזמנות שלא הוחזרו" נשאר במעטפת.

import '@/design-system/components.css';
import './home.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SettingQuickPanel from '../SettingQuickPanel';
import { getHistory } from '@/lib/historyManager';
import { Ic } from './HomeParts';
import HomeResults from './HomeResults';
import HomeChat from './HomeChat';
import HomeAdvanced from './HomeAdvanced';
import HomeAdvResults from './HomeAdvResults';
import HomeRecents from './HomeRecents';
import { HomeFooter, PrivacyDialog } from './HomeFooter';
import {
  AI_CONTEXT, buildGreeting, normalizeSearch, resultsCount, unifiedRows, exportRecordsForRows,
  botMessageFromResponse, botErrorMessage, chatToHistory, withoutActionKeys, rowsToCsv, threadToCsv,
  printRowsHtml, printThreadHtml, recentRows, footerGroups,
} from './homeLogic';
import {
  ADV_FOCI, emptyAdv, advSummaryParts, advAiPrompt, buildAdvRequest, normalizeAdvResponse, navPathSet, visibleFoci,
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

export default function HomeA5() {
  const router = useRouter();
  const [boot, setBoot] = useState(null);
  const [bootDone, setBootDone] = useState(false);
  const [version, setVersion] = useState(null);

  const [view, setView] = useState('start'); // start | results | none | error | ai | adv
  const [q, setQ] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [resKey, setResKey] = useState(0);
  const [advRes, setAdvRes] = useState(null); // { focus, data, summary }
  const [chat, setChat] = useState([]);
  const [asTable, setAsTable] = useState(false);
  const [adv, setAdv] = useState(() => emptyAdv());
  const [advPrev, setAdvPrev] = useState('start');
  const [advEnter, setAdvEnter] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recents, setRecents] = useState([]);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [errStatus, setErrStatus] = useState(0);
  const [openSettingKey, setOpenSettingKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [heroEnter, setHeroEnter] = useState(true);
  const seq = useRef(0);
  const toastTimer = useRef(null);
  const inputRef = useRef(null);
  const lastQuery = useRef({ text: '', ai: false });

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

  /* ---------- חיפוש ---------- */
  const runSearch = useCallback(async (text, { ai = false } = {}) => {
    const query = String(text || '').trim();
    if (!query) return;
    lastQuery.current = { text: query, ai };
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
    try {
      const d = await getJson('/api/global-search?q=' + encodeURIComponent(query));
      if (my !== seq.current) return;
      const norm = normalizeSearch(d);
      setRes(norm);
      setChat([]);
      setResKey((k) => k + 1);
      setLoading(false);
      setView(resultsCount(norm) ? 'results' : 'none');
      persist(query, norm);
    } catch (e) {
      if (my !== seq.current) return;
      setLoading(false);
      setErrStatus(e && e.status ? e.status : 0);
      setView('error');
    }
  }, [askAi, persist]);

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
    forget();
  }, [forget]);

  /* ---------- פתיחה: ?q= (כמו LegacyHome), ?recent=, או שחזור החיפוש האחרון ---------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (params.has('recent')) setRecentOpen(true);
    if (qParam && qParam.trim()) {
      setQ(qParam);
      runSearch(qParam);
      // מנקים מהכתובת כדי שרענון/חזרה לא יריצו שוב מאליהם
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    if (params.has('recent')) {
      // הקישור "אחרונים" מהמעטפת: פותחים את הכרטיס ולא משחזרים חיפוש קודם
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.res && Array.isArray(saved.res.customers) && Array.isArray(saved.res.orders) && Array.isArray(saved.res.rentals)) {
        setQ(saved.q || '');
        setRes(saved.res);
        setResKey((k) => k + 1);
        setView(resultsCount(saved.res) ? 'results' : 'none');
      }
    } catch { /* פגום */ }
  }, []);
  useEffect(() => { const t = setTimeout(() => setHeroEnter(false), 2000); return () => clearTimeout(t); }, []);

  /* ---------- אחרונים ---------- */
  const reloadRecents = useCallback(() => { setRecents(recentRows(getHistory())); }, []);
  useEffect(() => {
    reloadRecents();
    window.addEventListener('agy_history_updated', reloadRecents);
    return () => window.removeEventListener('agy_history_updated', reloadRecents);
  }, [reloadRecents]);
  const clearRecents = () => {
    try { localStorage.removeItem('agy_history'); } catch { /* ignore */ }
    reloadRecents();
  };

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
  const advPick = (focus) => { setAdvEnter(true); setAdv(emptyAdv(focus)); };
  const advBack = () => { setAdvEnter(true); setAdv(emptyAdv()); };
  const advClose = leaveAdv;
  const advClear = () => setAdv((a) => emptyAdv(a.focus));

  const applyAdv = useCallback(async (withAi) => {
    const f = ADV_FOCI[adv.focus];
    if (!f) return;
    const parts = advSummaryParts(adv, adv.focus);
    if (!parts.length) { showToast('לא נבחרו מסננים', 'מלאו לפחות שדה אחד'); return; }
    const useAi = !!withAi && f.ai && aiAllowed;
    const summary = { label: f.label, text: parts.join(', ') };
    const my = ++seq.current;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (useAi) {
      setLoading(true);
      setAdvRes(null);
      const prompt = advAiPrompt(adv.focus, parts);
      const botMsg = await askAi(prompt, [], my);
      if (my !== seq.current || !botMsg) return;
      setChat([{ me: true, t: prompt }, botMsg]);
      setLoading(false);
      setView('ai');
      showToast('החיפוש נשלח לחיפוש החכם: ' + f.label, parts.join(', '));
      return;
    }
    setLoading(true);
    try {
      const url = buildAdvRequest(adv.focus, adv, window.localStorage);
      const d = await getJson(url);
      if (my !== seq.current) return;
      const data = normalizeAdvResponse(d);
      setAdvRes({ focus: adv.focus, data, summary });
      setLoading(false);
      setAsTable(false);
      setView('results');
      showToast('הסינון הוחל: ' + f.label, parts.join(', '));
      if (data.gaps.length) setTimeout(() => showToast('חלק מהסינונים לא נתמכים', data.gaps.join('; ')), 400);
    } catch (e) {
      if (my !== seq.current) return;
      setLoading(false);
      if (e.status === 403 || e.status === 400) {
        setView('adv');
        showToast(e.status === 403 ? 'אין הרשאה לחיפוש הזה' : 'חסר שדה חובה', e.status === 403 ? '' : e.message);
        return;
      }
      setAdvRes(null);
      setErrStatus(e && e.status ? e.status : 0);
      setView('error');
    }
  }, [adv, aiAllowed, askAi, showToast]);

  /* ---------- ייצוא / הדפסה / הורדה ---------- */
  const exportRows = useCallback(async (kind, rows, title, name) => {
    if (!rows || !rows.length) return;
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
    } else if (printHtml(printRowsHtml(title, rows))) {
      showToast('נשלח להדפסה');
    } else {
      showToast('חלון ההדפסה נחסם', 'אפשרו חלונות קופצים');
    }
  }, [showToast]);

  const onExportGeneral = (kind) => exportRows(kind, exportRecordsForRows(unifiedRows(res)), 'תוצאות חיפוש', 'Search_Export');
  const onExportAdv = (kind) => {
    if (!advRes) return;
    const { data, summary } = advRes;
    const rows = data.rows.map((r) => Object.fromEntries(data.cols.map((c, i) => [c, Array.isArray(r[i]) ? r[i][0] : r[i]])));
    exportRows(kind, rows, 'תוצאות חיפוש מתקדם ' + summary.label, 'Advanced_Search');
  };
  const onExportChat = (kind, m) => exportRows(kind, m.rows, 'תוצאות חיפוש חכם', 'AI_Export');
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

  const modeButtons = (
    <div className="cmode">
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
      <button type="button" className="cmode-b cmode-i" aria-pressed={recentOpen} aria-label="אחרונים" data-tip="אחרונים" onClick={() => { setRecentOpen((v) => !v); if (view !== 'start') resetAll(); }}>
        <Ic id="sn-history" />
      </button>
    </div>
  );

  const groups = useMemo(() => footerGroups({
    navGroups: boot && boot.navGroups,
    isHead: boot && boot.isHead,
    authenticated: boot && boot.authenticated,
  }), [boot]);
  const gmachName = settings.gmach_name || 'גמ״ח שמלות';

  return (
    <div className="gm-ds gm-home home-bg">
      <section className={`hero${heroEnter && !compact ? ' hero-enter' : ''}${compact ? ' hero-compact' : ''}`} aria-label="חיפוש">
        <div className={`hero-in${joined ? ' jshell' : ''}${noBar ? ' advonly' : ''}${view === 'ai' ? ' aishell' : ''}`}>
          {compact && <h1 className="sr-only">חיפוש</h1>}
          {!compact && (
            <h1 className="hero-t">
              <bdi>
                {bootDone && (greeting.hi ? <><span className="t-hi">{greeting.hi}</span><span className="t-q">{greeting.q}</span></> : <span className="t-q">{greeting.q}</span>)}
              </bdi>
            </h1>
          )}
          {!noBar && (
            <form
              className="srch"
              role="search"
              onSubmit={(e) => { e.preventDefault(); if (!loading) runSearch(q, { ai }); }}
            >
              <div className="scan">
                <input
                  ref={inputRef}
                  id="sq"
                  aria-label={ai ? 'שאלה לחיפוש החכם' : 'חיפוש לקוח, הזמנה או פריט'}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  disabled={loading}
                  autoComplete="nope"
                  data-lpignore="true"
                  data-1p-ignore
                  data-form-type="other"
                />
                {q && !loading && (
                  <button type="button" className="ibtn" aria-label="ניקוי החיפוש" data-tip="ניקוי הכול" onClick={() => { resetAll(); if (inputRef.current) inputRef.current.focus(); }}><Ic id="x" size="sm" /></button>
                )}
                {joined && modeButtons}
                <button type="submit" className="btn primary" aria-label={loading ? (ai ? 'חושבים' : 'מחפשים') : label} data-tip={label} disabled={loading}>
                  {loading ? <span className="mspin" aria-hidden="true" /> : <Ic id={ai ? 'send' : 'search'} />}
                </button>
              </div>
              {!joined && <div className="hero-row">{modeButtons}</div>}
            </form>
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
            <HomeResults key={resKey} res={res} none={view === 'none'} table={asTable} onTable={setAsTable} onExport={onExportGeneral} />
          ) : null}
        </div>
      </section>

      <div className="app" id="app">
        <section className="panel on home-p" aria-label="תוכן עמוד הבית">
          {view === 'start' && recentOpen && (
            <HomeRecents rows={recents} onClear={clearRecents} onClose={() => setRecentOpen(false)} />
          )}
          {view === 'error' && (
            <div className="card">
              <div className="empty" role="status">
                <Ic id="alert" size="lg" />
                <div className="big" style={{ fontSize: 19, marginTop: 8, color: 'var(--ink)' }}>החיפוש לא הצליח</div>
                <div className="muted">{errStatus === 401 ? 'פג תוקף הכניסה. יש להתחבר מחדש.' : 'אין חיבור לשרת כרגע.'}</div>
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      if (advRes) { applyAdv(false); return; }
                      runSearch(lastQuery.current.text || q, { ai: lastQuery.current.ai });
                    }}
                  ><Ic id="refresh" />לנסות שוב</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <HomeFooter groups={groups} name={gmachName} version={version && version.version} date={version && version.date} onPrivacy={() => setPrivacyOpen(true)} />

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
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
