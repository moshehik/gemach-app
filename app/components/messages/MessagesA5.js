'use client';

// מרכז הודעות (/messages) בעיצוב הפלטה החדש - אותו מבנה כמו תיבת המייל (/admin/mailbox) ודף הלו"ז: A5Page + A5ListPage עם עמודה כחולה בצד ימין
// (תיקיות: נכנסות / יוצאות / בין משמרות / להנהלה / ארכיון + "הודעה חדשה" + הגדרות התראות), A5List (שורות / טבלה, חיפוש, חץ פרטים מהירים)
// וחלונות צפים של הפלטה (.dlg.mailwin) לקריאה, כתיבה והגדרות. הנתונים והפעולות זהים לדף הישן (LegacyMessagesPage.js):
// GET /api/notifications (+ /api/employees?slim=1, /api/me, /api/settings), POST /api/notifications[/read|/archive|/tags|/handle], PATCH /api/me.
// תאריכים עבריים בלבד (כלל קבוע). לוגיקה טהורה: messagesLogic.js.

import '@/design-system/components.css';
import './messages.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNoFill } from '@/lib/autofillGuard';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { pollAfterAction } from '@/lib/pollClient';
import { cacheNamespace, fetchJson } from '@/app/lib/pageCache';
import PageVariantToggle from '../variant/PageVariantToggle';
import { A5List, A5ListPage, A5Page, Dlg, Ic, hDateFull, timeHM, useA5 } from '../a5-list';
import { CAT_MGMT, CAT_SHIFT, addTag, authorOf, folderCounts, fullName, isManagerRoleId, messageRow, rowsFor, splitNotifications } from './messagesLogic';

const SLOT_ID = 'a5l-search-msg';
// אותו מטמון SWR כמו בדף הישן - כניסה חוזרת מציגה את הנתונים הקודמים מיד, וה-fetch הופך לרענון שקט
const messagesCache = cacheNamespace('messages');
const CACHE_KEY = 'all';

const FOLDER_META = {
  incoming: { label: 'נכנסות', title: 'דואר נכנס', icon: 'inbox', empty: 'תיבת הדואר הנכנס ריקה', tip: 'הודעות שנשלחו אליך' },
  outgoing: { label: 'יוצאות', title: 'דואר יוצא', icon: 'send', empty: 'לא שלחת הודעות עדיין', tip: 'הודעות ששלחת' },
  shift: { label: 'בין משמרות', title: 'הודעות בין משמרות', icon: 'refresh', empty: 'אין הודעות בין משמרות כרגע', tip: 'הודעות למשמרת הבאה' },
  management: { label: 'להנהלה', title: 'הודעות להנהלה', icon: 'alert', empty: 'אין הודעות להנהלה כרגע', tip: 'הודעות ושאלות להנהלה' },
  archived: { label: 'ארכיון', title: 'ארכיון הודעות', icon: 'archive', empty: 'אין הודעות בארכיון', tip: 'הודעות שהועברו לארכיון' },
};

async function postJson(url, body, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* לא JSON */ }
  if (!res.ok || !data || data.success === false) throw new Error((data && data.error) || `שגיאה (${res.status})`);
  return data;
}

function Pair({ icon, tip, warn, cls, children }) {
  return <span className={`lni${warn ? ' warn' : ''}${cls ? ` ${cls}` : ''}`} data-tip={tip}><Ic id={icon} />{children}</span>;
}

const whenOf = (iso) => (iso ? `${hDateFull(iso)} · ${timeHM(iso)}` : '');

function statusOf(r) {
  if (r.kind === 'mgmt') return r.handled ? { t: 'טופל', icon: 'check', cls: 'ok' } : { t: 'ממתין לטיפול', icon: 'clock', cls: 'warn' };
  if (r.kind === 'shift') {
    if (r.handled) return { t: 'טופל', icon: 'check', cls: 'ok' };
    return r.unread ? { t: 'ממתין לאישור קריאה', icon: 'bell', cls: 'warn' } : { t: 'אושרה קריאה', icon: 'check', cls: 'ok' };
  }
  if (r.kind === 'in') return r.unread ? { t: 'לא נקראה', icon: 'mail', cls: 'warn' } : { t: 'נקראה', icon: 'check', cls: 'ok' };
  return null;
}

function rowIcon(r) {
  if (r.kind === 'mgmt') return r.handled ? 'check' : 'alert';
  if (r.kind === 'shift') return 'refresh';
  if (r.kind === 'out') return 'send';
  if (r.broadcast) return 'users';
  return r.unread ? 'mail' : 'inbox';
}

/* ---------------------------------- חלון קריאה ---------------------------------- */

function MsgRead({ row, actions, onClose, onTags, canHandle }) {
  const nf = useNoFill();
  const [tag, setTag] = useState('');
  const n = row.n;
  const st = statusOf(row);
  const handledBy = n.handledBy ? fullName(n.handledBy) : '';
  const meta = (k, v) => <div className="msg-mr"><small>{k}</small><b>{v}</b></div>;
  const submitTag = () => { const next = addTag(row.tags, tag); setTag(''); if (next !== row.tags) onTags(next); };

  return (
    <Dlg className="mailwin msg-read" labelledBy="msg-read-t" onClose={onClose} focusSel=".mx">
      <div className="mh">
        <span className="mico"><Ic id={rowIcon(row)} size="lg" /></span>
        <h2 id="msg-read-t">{row.kind === 'out' ? `אל: ${row.who}` : row.who}<small className="msub">{whenOf(row.date)}</small></h2>
        <button type="button" className="ibtn mx" aria-label="סגירה" data-tip="סגור" onClick={onClose}><Ic id="x" size="sm" /></button>
      </div>
      <div className="mto msg-meta">
        {meta(row.kind === 'out' ? 'אל' : 'מאת', <bdi>{row.who}</bdi>)}
        {row.kind !== 'out' && row.broadcast ? meta('נשלחה ל', 'כל העובדים') : null}
        {meta('נשלחה', whenOf(row.date))}
        {st ? meta('סטטוס', <span className={`msg-st ${st.cls}`}><Ic id={st.icon} size="sm" />{st.t}</span>) : null}
        {handledBy && row.handled ? meta('טופלה על ידי', <bdi>{handledBy}</bdi>) : null}
      </div>
      <pre className="msg-text">{n.content}</pre>
      <div className="mfld">
        <span className="lbl"><Ic id="tag" size="sm" />תגיות אישיות</span>
        <div className="msg-tags">
          {row.tags.map((t) => (
            <span key={t} className="tag s"><bdi>{t}</bdi>
              <button type="button" className="msg-tagx" aria-label={`הסרת התגית ${t}`} data-tip="הסר תגית" onClick={() => onTags(row.tags.filter((x) => x !== t))}><Ic id="x" size="sm" /></button>
            </span>
          ))}
          <span className="msg-tagadd">
            <input className="inp" type="text" {...nf('tag')} value={tag} placeholder="הוספת תגית…" aria-label="תגית חדשה" maxLength={40}
              onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTag(); } }} />
            <button type="button" className="btn sm" disabled={!tag.trim()} onClick={submitTag}><Ic id="plus" size="sm" />הוספה</button>
          </span>
        </div>
      </div>
      <div className="msg-acts">
        {actions.filter((a) => a.key !== 'open' && (a.key !== 'handled' || canHandle)).map((a) => (
          <button key={a.key} type="button" className={`btn${a.primary ? ' primary' : ''}`} disabled={a.busy} onClick={a.run}><Ic id={a.icon} size="sm" />{a.label}</button>
        ))}
      </div>
    </Dlg>
  );
}

/* ---------------------------------- חלון כתיבה ---------------------------------- */

function MsgCompose({ draft, employees, kinds, onClose, onSent }) {
  const nf = useNoFill();
  const [f, setF] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const bodyRef = useRef(null);
  const personal = f.kind === 'personal';
  const set = (k) => (e) => { setErr(''); setF((s) => ({ ...s, [k]: e.target.value })); };
  const close = () => { if (!busy) onClose(); };
  const title = { personal: 'הודעה חדשה', shift: 'הודעה למשמרת הבאה', management: 'הודעה להנהלה' }[f.kind];

  useEffect(() => {
    const el = bodyRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight + 2, 420)}px`; }
  }, [f.content]);

  const bodyProps = {
    className: 'inp', id: 'msg-body', ref: bodyRef, rows: 6, dir: 'auto', value: f.content, onChange: set('content'), disabled: busy,
    placeholder: { personal: 'הקלד את הודעתך כאן…', shift: 'לדוגמה: 3 שמלות בייבוש, אין להשכיר מידה 40 עד שיתייבשו…', management: 'לדוגמה: לקוחה X התלוננה על Y / שאלת מדיניות…' }[f.kind],
  };

  const send = async () => {
    if (busy) return;
    if (!f.content.trim()) { setErr('יש להזין תוכן להודעה'); return; }
    setBusy(true); setErr('');
    try {
      const body = personal
        ? { receiverId: f.receiverId, title: 'הודעה חדשה', content: f.content, sendEmail: f.sendEmail }
        : { receiverId: 'all', title: f.kind === 'shift' ? 'הודעת משמרת' : 'הודעה להנהלה', content: f.content, category: f.kind === 'shift' ? CAT_SHIFT : CAT_MGMT };
      await postJson('/api/notifications', body);
      onSent(f.kind);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Dlg className="mailwin msg-compose" labelledBy="msg-compose-t" onClose={close} focusSel={personal ? '#msg-to' : '#msg-body'}>
      <div className="mh">
        <span className="mico"><Ic id="msg" size="lg" /></span>
        <h2 id="msg-compose-t">{title}</h2>
        <button type="button" className="ibtn mx" aria-label="סגירה" data-tip="סגור" onClick={close} disabled={busy}><Ic id="x" size="sm" /></button>
      </div>
      {kinds.length > 1 ? (
        <div className="methods msg-kinds" role="radiogroup" aria-label="סוג ההודעה" style={{ '--n': kinds.length }}>
          {kinds.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={f.kind === k ? 'on' : ''} disabled={busy} onClick={() => { setErr(''); setF((s) => ({ ...s, kind: k })); }}>{l}</button>
          ))}
        </div>
      ) : null}
      {personal ? (
        <div className="mfld">
          <label className="lbl" htmlFor="msg-to"><Ic id="user" size="sm" />שלח אל</label>
          <select className="inp" id="msg-to" data-guide-id="msg.compose-to" value={f.receiverId} onChange={set('receiverId')} disabled={busy}>
            <option value="all">כל העובדים במערכת (הודעה כללית)</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{fullName(emp)}</option>)}
          </select>
        </div>
      ) : (
        <div className="msg-hint"><Ic id="info" size="sm" />{f.kind === 'shift' ? 'ההודעה תוצג לכל העובדים, וכל עובד מאשר שקרא אותה.' : 'ההודעה תוצג לכל העובדים ולמנהלים; מנהל מסמן אותה כטופלה.'}</div>
      )}
      <div className="mfld">
        <label className="lbl" htmlFor="msg-body"><Ic id="note" size="sm" />תוכן ההודעה</label>
        {f.kind === 'shift' ? <textarea {...bodyProps} data-guide-id="msg.shift-text" /> : f.kind === 'management' ? <textarea {...bodyProps} data-guide-id="msg.mgmt-text" /> : <textarea {...bodyProps} data-guide-id="msg.compose-text" />}
      </div>
      {personal ? (
        <div className="trow">
          <label className="sw"><input type="checkbox" id="msg-email" data-guide-id="msg.compose-email" checked={f.sendEmail} disabled={busy} onChange={(e) => setF((s) => ({ ...s, sendEmail: e.target.checked }))} /><i /></label>
          <b className="big">שלח התראה גם למייל</b>
          <button type="button" className="tip" aria-label="עזרה" data-tip="נשלח לעובדים בעלי כתובת מייל מעודכנת" data-ico="info"><Ic id="info" size="sm" /></button>
        </div>
      ) : null}
      {err ? <div className="msg-err" role="alert"><Ic id="alert" size="sm" />{err}</div> : null}
      <div className="dbtns mact">
        <button type="button" className="btn primary lg" id="msg-send" data-guide-id="msg.send" disabled={busy || !f.content.trim()} onClick={send}>
          {busy ? <><span className="mspin" />שולח...</> : <><Ic id="send" />{personal ? 'שלח הודעה' : f.kind === 'shift' ? 'הוסף הודעה' : 'שלח להנהלה'}</>}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={close}><Ic id="x" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}

/* ---------------------------------- חלון הגדרות ---------------------------------- */

function MsgSettings({ me, saving, onToggle, onClose }) {
  return (
    <Dlg className="mailwin msg-settings" labelledBy="msg-set-t" onClose={onClose} focusSel=".mx">
      <div className="mh">
        <span className="mico"><Ic id="gear" size="lg" /></span>
        <h2 id="msg-set-t">הגדרות התראות</h2>
        <button type="button" className="ibtn mx" aria-label="סגירה" data-tip="סגור" onClick={onClose}><Ic id="x" size="sm" /></button>
      </div>
      {!me ? <div className="msg-load"><span className="mspin" />טוען נתוני עובד…</div> : (
        <>
          <div className="mto msg-meta">
            <div className="msg-mr"><small>המייל שלך</small><b>{me.email ? <bdi dir="ltr">{me.email}</bdi> : 'לא מוגדרת כתובת מייל'}</b></div>
          </div>
          {!me.email ? <div className="msg-err" role="alert"><Ic id="alert" size="sm" />לא מוגדרת עבורך כתובת מייל במערכת. יש לפנות למנהל לעדכון המייל.</div> : null}
          <div className="trow">
            <label className="sw"><input type="checkbox" id="msg-alerts" data-guide-id="msg.email-alerts" checked={!!me.receiveEmailAlerts} disabled={saving || !me.email} onChange={(e) => onToggle(e.target.checked)} /><i /></label>
            <b className="big">קבל התראות למייל על הודעות חדשות</b>
          </div>
          {saving ? <div className="msg-hint"><span className="mspin" />שומר שינויים…</div> : null}
        </>
      )}
      <div className="dbtns mact">
        <button type="button" className="btn primary lg" onClick={onClose}><Ic id="check" />סגירה</button>
      </div>
    </Dlg>
  );
}

/* ------------------------------------ הדף ------------------------------------ */

// כפתור תיקייה בעמודה הכחולה. data-guide-id (מדריך האתר) מגיע מהקורא כ-prop ונשפך על הלחצן.
function RailFolder({ k, on, cnt, onPick, ...rest }) {
  const m = FOLDER_META[k];
  const what = k === 'management' ? 'ממתינות לטיפול' : 'לא נקראו';
  return (
    <button type="button" className={`st-stab${on ? ' on' : ''}`} aria-pressed={on} data-tip={`${m.tip}${cnt ? ` · ${what}: ${cnt}` : ''}`} onClick={onPick} {...rest}>
      <span className="st-sic">
        <Ic id={m.icon} />
        {cnt > 0 ? <span className="sn-badge msg-rem" role="img" aria-label={`${cnt} ${what}`}>{cnt}</span> : null}
      </span>
      <span className="st-slb"><span className="msg-nm">{m.label}</span></span>
      <span className="st-sgo"><Ic id="chev" size="sm" /></span>
    </button>
  );
}


function Messages() {
  const router = useRouter();
  const a5 = useA5();
  const [folder, setFolder] = useState('incoming');
  const [raw, setRaw] = useState({ inc: [], out: [] });
  const [employees, setEmployees] = useState([]);
  const [me, setMe] = useState(null);
  const [flags, setFlags] = useState({ shift: false, management: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [readingId, setReadingId] = useState(null);
  const [compose, setCompose] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const applyData = useCallback((notifData, empData, meData, settingsData) => {
    if (meData && meData.success && meData.employee) setMe(meData.employee);
    if (Array.isArray(settingsData)) {
      setFlags({
        shift: settingsData.find((s) => s.key === 'shift_handover_notes')?.value === 'true',
        management: settingsData.find((s) => s.key === 'management_messages')?.value === 'true',
      });
    }
    if (notifData && notifData.success) setRaw({ inc: notifData.notifications || [], out: notifData.outgoing || [] });
    if (Array.isArray(empData)) setEmployees(empData);
    else if (empData && empData.success) setEmployees(empData.employees || []);
  }, []);

  const fetchData = useCallback(async (silent) => {
    const cached = messagesCache.get(CACHE_KEY);
    if (cached) { applyData(cached.notifData, cached.empData, cached.meData, cached.settingsData); setLoading(false); }
    else if (!silent) setLoading(true);
    try {
      const [notifData, empData, meData, settingsData] = await Promise.all([
        fetchJson('/api/notifications', { cache: 'no-store' }),
        fetchJson('/api/employees?slim=1', { cache: 'no-store' }),
        fetchJson('/api/me', { cache: 'no-store' }),
        fetchSharedJson('/api/settings', { ttl: TTL.STATIC }),
      ]);
      messagesCache.set(CACHE_KEY, { notifData, empData, meData, settingsData });
      applyData(notifData, empData, meData, settingsData);
      setError('');
    } catch {
      setError('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, [applyData]);
  useEffect(() => { fetchData(false); }, [fetchData]);

  const parts = useMemo(() => splitNotifications(raw.inc, raw.out), [raw]);
  const counts = useMemo(() => folderCounts(parts), [parts]);
  const cur = folder === 'shift' && !flags.shift ? 'incoming' : folder === 'management' && !flags.management ? 'incoming' : folder;
  const meta = FOLDER_META[cur];
  const rows = useMemo(() => rowsFor(parts[cur], cur), [parts, cur]);
  const canHandleMgmt = !!me && isManagerRoleId(me.roleId);

  // כל הרשומות (גם ביוצאות וגם בנכנסות) לפי מזהה - הודעה שנפתחת בחלון נשארת "חיה" כשהמצב שלה משתנה
  const patch = (id, fn) => setRaw((r) => ({ inc: r.inc.map((n) => (n.id === id ? fn(n) : n)), out: r.out.map((n) => (n.id === id ? fn(n) : n)) }));
  const forgetCache = () => messagesCache.delete(CACHE_KEY);

  const act = async (id, run) => {
    setBusyId(id);
    try { await run(); } catch (e) { a5.say('הפעולה נכשלה', 'error', e.message); }
    setBusyId(null);
  };
  const markRead = (id) => act(id, async () => {
    await postJson('/api/notifications/read', { notificationId: id });
    patch(id, (n) => ({ ...n, isRead: true })); forgetCache(); pollAfterAction();
  });
  const setArchive = (id, archive) => act(id, async () => {
    await postJson('/api/notifications/archive', { notificationId: id, archive });
    patch(id, (n) => ({ ...n, isArchived: archive })); forgetCache(); pollAfterAction();
    a5.say(archive ? 'ההודעה הועברה לארכיון' : 'ההודעה שוחזרה', 'ok');
  });
  const setHandled = (id, handled) => act(id, async () => {
    const d = await postJson('/api/notifications/handle', { notificationId: id, handled });
    patch(id, (n) => ({ ...n, handledAt: d.notification.handledAt, handledBy: d.notification.handledBy })); forgetCache();
  });
  const setTags = (id, tags) => act(id, async () => {
    await postJson('/api/notifications/tags', { notificationId: id, tags });
    patch(id, (n) => ({ ...n, personalTags: tags })); forgetCache();
  });
  const saveAlerts = async (receiveEmailAlerts) => {
    setSavingSettings(true);
    try {
      const d = await postJson('/api/me', { receiveEmailAlerts }, 'PATCH');
      setMe(d.employee); forgetCache();
    } catch (e) { a5.say('השמירה נכשלה', 'error', e.message); }
    setSavingSettings(false);
  };

  // פעולות על הודעה - אותה רשימה בפירוט המהיר של השורה ובחלון הקריאה
  const actionsFor = (r) => {
    const out = [{ key: 'open', label: 'קריאה', icon: 'msg', primary: true, run: () => setReadingId(r.id) }];
    const busy = busyId === r.id;
    if (r.unread) out.push({ key: 'read', label: r.kind === 'shift' ? 'אשר קריאה' : 'סמן כנקרא', icon: 'check', busy, run: () => markRead(r.id) });
    if (r.kind === 'in' && r.n.senderId && !r.broadcast) {
      out.push({ key: 'reply', label: 'השב', icon: 'back', run: () => { setReadingId(null); setCompose({ kind: 'personal', receiverId: String(r.n.senderId), content: '', sendEmail: false }); } });
    }
    if (r.kind === 'shift' || (r.kind === 'mgmt')) out.push({ key: 'handled', label: r.handled ? 'בטל טופל' : 'סמן כטופל', icon: r.handled ? 'undo' : 'check', busy, run: () => setHandled(r.id, !r.handled) });
    if (r.kind === 'in' || r.kind === 'out') out.push({ key: 'archive', label: r.archived ? 'שחזר' : 'ארכיון', icon: r.archived ? 'undo' : 'archive', busy, run: () => setArchive(r.id, !r.archived) });
    return out;
  };
  const canHandleRow = (r) => r.kind === 'shift' || canHandleMgmt;

  const openCompose = (kind) => setCompose({ kind: kind || (cur === 'shift' ? 'shift' : cur === 'management' ? 'management' : 'personal'), receiverId: 'all', content: '', sendEmail: false });
  const kinds = [['personal', 'הודעה לעובד'], ...(flags.shift ? [['shift', 'בין משמרות']] : []), ...(flags.management ? [['management', 'להנהלה']] : [])];
  const onSent = (kind) => {
    setCompose(null);
    a5.say('ההודעה נשלחה', 'ok');
    forgetCache(); fetchData(true); pollAfterAction();
    setFolder(kind === 'personal' ? 'outgoing' : kind === 'shift' ? 'shift' : 'management');
  };

  // ההודעה הפתוחה בחלון: נשארת "חיה" גם כשהפעולה מעבירה אותה לתיקייה אחרת (ארכיון / שחזור)
  const readingRow = useMemo(() => {
    if (readingId == null) return null;
    for (const k of [cur, 'archived', 'incoming', 'outgoing', 'shift', 'management']) {
      const n = parts[k].find((x) => x.id === readingId);
      if (n) return messageRow(n, k);
    }
    return null;
  }, [readingId, parts, cur]);

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq"><Ic id={rowIcon(r)} /></div>
      <div className="t"><b><bdi>{r.kind === 'out' ? <>אל: </> : null}{c.hl(r.who)}</bdi></b><span className="ln mi">
        <Pair icon="note" tip="תוכן" cls="msg-snip"><bdi>{c.hl(r.text)}</bdi></Pair>
        {r.date ? <Pair icon="clock" tip="זמן"><bdi>{whenOf(r.date)}</bdi></Pair> : null}
        {r.broadcast ? <Pair icon="users" tip="נשלחה לכל העובדים"><bdi>לכולם</bdi></Pair> : null}
        {r.pending ? <Pair icon="clock" tip="ממתינה לטיפול" warn><bdi>ממתין לטיפול</bdi></Pair> : null}
        {r.tags.length ? <Pair icon="tag" tip="תגיות"><bdi>{c.hl(r.tags.join(', '))}</bdi></Pair> : null}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    const st = statusOf(r);
    return (
      <>
        {row(r.kind === 'out' ? 'אל' : 'מאת', <bdi>{r.who}</bdi>)}
        {row('נשלחה', whenOf(r.date))}
        {st ? row('סטטוס', st.t) : null}
        {r.tags.length ? row('תגיות', <bdi>{r.tags.join(', ')}</bdi>) : null}
        <div className="hv-r msg-hv-text"><small>תוכן</small><b>{r.n.content}</b></div>
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          {actionsFor(r).filter((a) => a.key !== 'handled' || canHandleRow(r)).map((a) => (
            <button key={a.key} type="button" className={`btn sm${a.primary ? ' primary' : ''}`} disabled={a.busy} onClick={a.run}><Ic id={a.icon} size="sm" />{a.label}</button>
          ))}
        </b></div>
      </>
    );
  };

  const columns = [
    { t: cur === 'outgoing' ? 'נמען' : 'שולח', cell: (r, c) => <span className="tcn"><Ic id={rowIcon(r)} /><b><bdi>{c.hl(r.who)}</bdi></b></span> },
    { t: 'תוכן', cell: (r, c) => <bdi>{c.hl(r.text)}</bdi> },
    { t: 'זמן', cell: (r) => (r.date ? <><Ic id="clock" />{whenOf(r.date)}</> : '') },
    { t: 'סטטוס', cell: (r) => { const s = statusOf(r); return s ? <span className={`msg-st ${s.cls}`}><Ic id={s.icon} size="sm" />{s.t}</span> : ''; } },
  ];
  const sorts = [
    { k: 'date', l: 'זמן', i: 'clock', get: (r) => r.ts },
    { k: 'who', l: cur === 'outgoing' ? 'נמען' : 'שולח', i: 'user', get: (r) => r.who },
  ];

  const rf = (k) => ({ on: k === cur, cnt: counts[k] || 0, onPick: () => { setFolder(k); setReadingId(null); } });

  // העמודה הכחולה בצד ימין (כמו ציר השלבים בדף הלו"ז): "הודעה חדשה", התיקיות עם המונים והגדרות ההתראות
  const rail = (
    <aside className="rail msg-rail" aria-label="תיקיות ההודעות">
      <div className="st-sidenav msg-snav">
        <div className="msg-rh">מרכז הודעות</div>
        <button type="button" className="btn primary block msg-new" id="btnNewMsg" data-guide-id="msg.tab-compose" onClick={() => openCompose()}><Ic id="plus" />הודעה חדשה</button>
        <nav className="st-stabs" aria-label="תיקיות">
          <RailFolder k="incoming" data-guide-id="msg.tab-incoming" {...rf('incoming')} />
          <RailFolder k="outgoing" data-guide-id="msg.tab-outgoing" {...rf('outgoing')} />
          {flags.shift ? <RailFolder k="shift" data-guide-id="msg.tab-shift" {...rf('shift')} /> : null}
          {flags.management ? <RailFolder k="management" data-guide-id="msg.tab-management" {...rf('management')} /> : null}
          <RailFolder k="archived" data-guide-id="msg.tab-archived" {...rf('archived')} />
          <button type="button" className="st-stab msg-set" data-guide-id="msg.tab-settings" data-tip="התראות למייל על הודעות חדשות" onClick={() => setSettingsOpen(true)}>
            <span className="st-sic"><Ic id="gear" /></span>
            <span className="st-slb"><span className="msg-nm">הגדרות</span></span>
            <span className="st-sgo"><Ic id="chev" size="sm" /></span>
          </button>
        </nav>
      </div>
    </aside>
  );

  return (
    <>
      <A5ListPage
        small="תקשורת פנימית" title="מרכז הודעות" backId="msgBack" backLabel="חזרה לדף הבית" onBack={() => router.push('/')}
        tools={<PageVariantToggle screen="messages" placement="header" systemTip />}
        slotId={SLOT_ID} cardIcon={meta.icon} cardTitle={meta.title} rail={rail}
      >
        <A5List
          key={cur}
          items={rows}
          getId={(r) => r.id}
          hay={(r) => r.hay}
          texts={{ placeholder: 'חיפוש בהודעות (תוכן, שולח, תגית)…', countLabel: 'הודעות', emptyText: rows.length ? 'לא נמצאו הודעות התואמות את החיפוש' : meta.empty }}
          sorts={sorts}
          defaultSort={{ k: 'date', dir: -1 }}
          rowMain={rowMain}
          rowClass={(r) => (r.unread ? 'msg-unread' : r.pending ? 'msg-pending' : '')}
          detail={detail}
          columns={columns}
          onOpen={(r) => setReadingId(r.id)}
          searchSlot={SLOT_ID}
          loading={loading && !rows.length}
          error={error}
          onRetry={() => fetchData(false)}
          barExtra={<button type="button" className="ibtn" aria-label="רענון" data-tip="רענון ההודעות" onClick={() => { forgetCache(); fetchData(false); }}><Ic id="refresh" size="sm" /></button>}
        />
      </A5ListPage>
      {readingRow ? (
        <MsgRead
          row={readingRow} actions={actionsFor(readingRow)} canHandle={canHandleRow(readingRow)}
          onClose={() => setReadingId(null)} onTags={(tags) => setTags(readingRow.id, tags)}
        />
      ) : null}
      {compose ? <MsgCompose draft={compose} employees={employees} kinds={kinds} onClose={() => setCompose(null)} onSent={onSent} /> : null}
      {settingsOpen ? <MsgSettings me={me} saving={savingSettings} onToggle={saveAlerts} onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}

export default function MessagesA5() {
  return <A5Page name="gm-msg"><Messages /></A5Page>;
}
