'use client';

// תיבת מייל (/admin/mailbox, הנהלה ראשית): תיבת הדואר של האתר (Hostinger, נווה יעקב) בעיצוב הפלטה החדש - אותה ערכת a5-list כמו שאר מסכי הניהול:
// A5Page + A5ListPage (כותרת עם חץ חזרה, חיפוש חצי רוחב, לשוניות = תיקיות, כרטיס עם לחצן "מייל חדש") + A5List במצב שרת (עימוד 50 בקפסולה,
// שורות / טבלה, חץ פרטים מהירים). לחיצה על שורה פותחת חלון קריאה (.dlg.mailwin); כתיבה / תשובה / העברה באותו חלון מייל של הפלטה.
// הנתונים: GET/POST /api/admin/mailbox (הטוקן נשאר בשרת, fail-closed). תאריכים עבריים כמו בשאר המסכים. לוגיקה טהורה: mailboxLogic.js.

import '@/design-system/components.css';
import './mailbox.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { A5List, A5ListPage, A5Page, A5Tabs, Ic, hDateFull, timeHM, useA5 } from '../a5-list';
import { API, api } from './mailboxApi';
import { MbCompose, MbRead } from './MbDialogs';
import { PER_PAGE, composeDraft, fmtBytes, folderIcon, folderLabel, isOutgoingFolder, isTrashFolder, mailRow, normAddr } from './mailboxLogic';

const SLOT_ID = 'a5l-search-mbx';
const REFRESH_MS = 60000;

function Pair({ icon, tip, children }) {
  return <span className="lni" data-tip={tip}><Ic id={icon} />{children}</span>;
}

function Mailbox() {
  const router = useRouter();
  const a5 = useA5();
  const [status, setStatus] = useState(null); // null = טוען | { enabled, address, folders, quota }
  const [statusError, setStatusError] = useState('');
  const [folder, setFolder] = useState('INBOX');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [list, setList] = useState(null); // { data, pagination } | null בטעינה ראשונה
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(null); // { folder, uid }
  const [compose, setCompose] = useState(null);
  const seq = useRef(0);
  const searchTimer = useRef(null);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api(`${API}?action=status`)); setStatusError(''); } catch (e) { setStatusError(e.message); }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const enabled = !!(status && status.enabled);
  const loadList = useCallback(async (silent) => {
    if (!enabled) return;
    const my = ++seq.current;
    if (!silent) setBusy(true);
    try {
      const qs = new URLSearchParams({ action: 'messages', folder, page: String(page), perPage: String(PER_PAGE), ...(query ? { q: query } : {}) });
      const data = await api(`${API}?${qs}`);
      if (my === seq.current) { setList(data); setError(''); }
    } catch (e) { if (my === seq.current) setError(e.message); }
    finally { if (my === seq.current) setBusy(false); }
  }, [enabled, folder, page, query]);
  useEffect(() => { loadList(false); }, [loadList]);

  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') { loadList(true); loadStatus(); } }, REFRESH_MS);
    return () => clearInterval(t);
  }, [enabled, loadList, loadStatus]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const folders = (status && status.folders) || [];
  const cur = folders.find((f) => f.path === folder) || { path: folder, name: folder };
  const outgoing = isOutgoingFolder(cur);
  const me = (status && status.address) || '';
  const rows = list ? list.data.map((m) => mailRow(m, outgoing)) : [];
  const total = list && list.pagination && list.pagination.total != null ? list.pagination.total : rows.length;

  const changed = () => { loadList(true); loadStatus(); };
  const pickFolder = (path) => { setFolder(path); setPage(1); setQuery(''); setList(null); setError(''); };
  const onQuery = (q) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setQuery(String(q || '').trim()); }, 350);
  };

  const openCompose = (kind, msg, ref) => setCompose({ draft: composeDraft(kind, msg, ref, me) });
  const fromRead = (kind, msg) => { const ref = reading; setReading(null); openCompose(kind, msg, ref && { uid: ref.uid, folder: ref.folder }); };

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq"><Ic id={outgoing ? 'send' : r.unseen ? 'mail' : 'inbox'} /></div>
      <div className="t"><b><bdi>{c.hl(r.who)}</bdi></b><span className="ln mi">
        <Pair icon="note" tip="נושא"><bdi>{c.hl(r.subject)}</bdi></Pair>
        {r.date ? <Pair icon="clock" tip="זמן"><bdi>{hDateFull(r.date)} · {timeHM(r.date)}</bdi></Pair> : null}
        {r.files > 0 ? <Pair icon="clip" tip="קבצים מצורפים"><bdi>{r.files}</bdi></Pair> : null}
        {r.flagged ? <Pair icon="bookmark" tip="מסומן"><bdi>מסומן</bdi></Pair> : null}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    const names = (xs) => xs.map((x) => { const n = normAddr(x); return n.name ? `${n.name} <${n.address}>` : n.address; }).join(', ');
    const from = normAddr(r.from);
    return (
      <>
        {from ? row('מאת', <bdi dir="ltr">{from.name ? `${from.name} <${from.address}>` : from.address}</bdi>) : null}
        {r.to.length ? row('אל', <bdi dir="ltr">{names(r.to)}</bdi>) : null}
        {r.cc.length ? row('עותק', <bdi dir="ltr">{names(r.cc)}</bdi>) : null}
        {r.date ? row('נשלח', `${hDateFull(r.date)} · ${timeHM(r.date)}`) : null}
        {r.files > 0 ? row(r.files === 1 ? 'קובץ מצורף' : 'קבצים מצורפים', r.files) : null}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn primary sm" onClick={() => setReading({ folder, uid: r.uid })}><Ic id="mail" size="sm" />קריאה</button>
        </b></div>
      </>
    );
  };

  const columns = [
    { t: outgoing ? 'נמען' : 'שולח', cell: (r, c) => <span className="tcn"><Ic id={outgoing ? 'send' : r.unseen ? 'mail' : 'inbox'} /><b><bdi>{c.hl(r.who)}</bdi></b></span> },
    { t: 'נושא', cell: (r, c) => <bdi>{c.hl(r.subject)}</bdi> },
    { t: 'זמן', cell: (r) => (r.date ? <><Ic id="clock" />{[hDateFull(r.date), timeHM(r.date)].filter(Boolean).join(' · ')}</> : '') },
    { t: 'קבצים', tdClass: (r) => `num${r.files ? '' : ' zero'}`, cell: (r) => (r.files ? r.files : '') },
  ];

  const tabs = (
    <A5Tabs id="mbxTabs" label="תיקיות הדואר" items={folders.map((f) => ({
      key: f.path, label: `${folderLabel(f)}${f.unreadCount > 0 ? ` (${f.unreadCount})` : ''}`, icon: folderIcon(f), on: f.path === folder, onClick: () => pickFolder(f.path),
    }))} />
  );
  const q = status && status.quota && status.quota.supported && status.quota.totalLimit > 0 ? status.quota : null;

  const shell = (children, extra = {}) => (
    <A5ListPage
      title="תיבת מייל" backId="mbxBack" backLabel="חזרה למרכז הניהול" onBack={() => router.push('/admin')}
      slotId={SLOT_ID} cardIcon="mail" cardTitle={enabled ? folderLabel(cur) : 'תיבת מייל'} {...extra}
    >
      {children}
    </A5ListPage>
  );

  if (!status) {
    return shell(statusError
      ? <div className="mbx-state"><div className="mbx-err" role="alert"><Ic id="alert" size="sm" />{statusError}</div><button type="button" className="btn sm" onClick={loadStatus}><Ic id="refresh" size="sm" />נסה שוב</button></div>
      : <div className="mbx-state"><span className="mspin" />טוען את תיבת הדואר…</div>);
  }
  if (!status.enabled) {
    return shell(<div className="mbx-state">תיבת הדואר לא מחוברת באתר הזה. החיבור מוגדר במשתני הסביבה של הפרויקט ב-Vercel (<bdi dir="ltr">HOSTINGER_MAIL_TOKEN</bdi> ו-<bdi dir="ltr">HOSTINGER_MAILBOX_ID</bdi>).</div>);
  }

  return (
    <>
      {shell(
        <>
          <A5List
            key={folder}
            items={rows}
            getId={(r) => r.id}
            texts={{ placeholder: 'חיפוש הודעה (נושא, שולח או תוכן)…', countLabel: 'הודעות', emptyText: query ? 'לא נמצאו הודעות התואמות את החיפוש' : 'התיקייה ריקה' }}
            localSearch={false}
            total={total}
            page={page}
            onPage={setPage}
            onQueryChange={onQuery}
            rowMain={rowMain}
            rowClass={(r) => (r.unseen && !outgoing ? 'mbx-unread' : '')}
            detail={detail}
            columns={columns}
            onOpen={(r) => setReading({ folder, uid: r.uid })}
            searchSlot={SLOT_ID}
            loading={list === null || (busy && !rows.length)}
            error={error}
            onRetry={() => loadList(false)}
            barExtra={<button type="button" className="ibtn" aria-label="רענון" data-tip="רענון התיבה" onClick={() => { loadList(false); loadStatus(); }}><Ic id="refresh" size="sm" /></button>}
          />
          <div className="mbx-foot">
            <span><Ic id="mail" size="sm" /><bdi dir="ltr">{me || 'תיבת הדואר'}</bdi></span>
            {q ? <span><Ic id="box" size="sm" />נפח: {fmtBytes(q.totalUsage)} מתוך {fmtBytes(q.totalLimit)}</span> : null}
          </div>
        </>,
        { cardAction: <button type="button" className="btn navy" id="btnNew" onClick={() => openCompose('new')}><Ic id="plus" />מייל חדש</button>, tabs, tabpanel: true },
      )}
      {reading ? (
        <MbRead
          folder={reading.folder} uid={reading.uid} folderObj={cur} isTrash={isTrashFolder(cur)}
          onClose={() => setReading(null)} onChanged={changed} onCompose={fromRead}
        />
      ) : null}
      {compose ? (
        <MbCompose
          draft={compose.draft} me={me} onClose={() => setCompose(null)}
          onSent={() => { setCompose(null); a5.say('המייל נשלח', 'ok'); changed(); }}
        />
      ) : null}
    </>
  );
}

export default function MailboxA5() {
  return <A5Page name="gm-mbx"><Mailbox /></A5Page>;
}
