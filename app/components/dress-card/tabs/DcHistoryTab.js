'use client';

// DcHistoryTab - לשונית "היסטוריה" של כרטיס הדגם: "יומן הדגם" (ציר אירועים), "נתוני מערכת", "מלאי" ורשימת "פעולות ושינויים" על ערכת הרשימות.
// renderInfo / lifeCard / histCfg ב-model-card.js. הנתונים: AuditLog אמיתי (/api/audit לדגם ולפריטים - כמו הלשונית "מידע" הישנה), מנורמל לשורות
// בעיצוב המאושר ב-lib/dressCardLogic.buildDressHistoryRows (לפני/אחרי מחושבים מהרישומים הקודמים - ר' תיעוד הפונקציה).
import { useMemo } from 'react';
import { A5List } from '../../a5-list';
import OcIcon from '../../order-card/OcIcon';
import { modelDisplayName } from '@/lib/modelDisplay';
import { runListExport } from '../../a5-list';
import { sayOf } from '../dcPrint';
import useDcListAi from '../useDcListAi';
import { StatTile } from './DcRentalsTab';
import { Vf } from '../DcParts';
import { HISTORY_KINDS, dayTitle, hFull, hShort, kindGroup } from '@/lib/dressCardLogic';

function LifeCard({ dc }) {
  return (
    <div className="card stg">
      <div className="card-h"><div className="ico teal"><OcIcon name="list" size="lg" /></div><h2>יומן הדגם</h2></div>
      <div className="prc-l">
        {dc.life.map((n) => (
          <div key={n.k} className={`prc ${n.done ? 'done' : 'fut'}${n.cur ? ' cur' : ''}`} aria-current={n.cur ? 'step' : undefined}>
            <div className="prc-rail"><span className="prc-i"><OcIcon name={n.done ? 'check' : n.i} /></span></div>
            <div className="prc-body">
              <div className="prc-t"><b>{n.l}</b><small>{dayTitle(n.date)}</small></div>
              <div className="prc-m"><span className="prc-w">{n.info}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DcHistoryTab({ dc, ui }) {
  const { saved, cur, counts: c, logs, historyRows: rows, lastUpdate, raw } = dc;
  const aiS = useDcListAi({ dc, ui, which: 'history' });
  const createRow = useMemo(() => rows.filter((r) => r.kind === 'create').pop(), [rows]);
  const sizes = useMemo(() => [...new Set(cur.items.filter((i) => !i.del).map((i) => i.size).filter((s) => s !== ''))].sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b), 'he')), [cur.items]);
  const filters = useMemo(() => [
    { key: 'scope', label: 'היקף', icon: 'list', def: [], options: [{ k: 'model', l: 'פרטי הדגם', i: 'dress', test: (l) => l.scope === 'model' }, { k: 'item', l: 'פריטים', i: 'box', test: (l) => l.scope === 'item' }] },
    { key: 'kind', label: 'סוג פעולה', icon: 'sliders', def: [], options: HISTORY_KINDS.map(([k, t, i]) => ({ k, l: t, i, test: (l) => kindGroup(l.kind) === k })) },
  ], []);
  const sorts = useMemo(() => [
    { k: 'ts', l: 'תאריך', i: 'clock', get: (l) => l.ts + String(l.id).padStart(12, '0') },
    { k: 'text', l: 'פעולה', i: 'pencil', get: (l) => l.text },
    { k: 'who', l: 'עובד מבצע', i: 'user', get: (l) => l.who },
    { k: 'prev', l: 'קודם', i: 'undo', get: (l) => l.prev || '' },
    { k: 'new', l: 'חדש', i: 'check', get: (l) => l.next || l.det.map((d) => d[1]).join(' ') },
  ], []);
  const head = ['פעולה', 'פריט', 'תאריך', 'שעה', 'קודם', 'חדש', 'עובד'];
  const rowsOf = (l) => l.map((x) => [x.text, x.bc, hShort(x.ts.slice(0, 10)), x.ts.slice(11), x.prev, x.next || x.det.map((d) => d[1]).join(' · '), x.who]);
  const m = saved.model;
  const nameShown = dc.flags.useModelNames;

  return (
    <>
      <div className="dc-info-top" id="dcInfoTop">
        <LifeCard dc={dc} />
        <div className="card cust">
          <div className="card-h"><div className="ico gold"><OcIcon name="info" size="lg" /></div><h2>נתוני מערכת</h2></div>
          <div className="kv">
            {nameShown ? <Vf icon="tag" label="שם דגם" value={modelDisplayName({ name: m.name, barcodePrefix: m.code }, { fallback: '' })} /> : null}
            <Vf icon="box" label="קידומת ברקוד" value={m.code} bdi />
            <Vf icon="cal" label="נכנס למאגר" value={m.entry ? hFull(m.entry) + (createRow ? ` · ${createRow.ts.slice(11)}` : '') : ''} />
            <Vf icon="clock" label="עודכן לאחרונה" value={lastUpdate && lastUpdate.day ? `${hFull(lastUpdate.day)} · ${lastUpdate.time}` : ''} />
            <Vf icon="file" label="מזהה במערכת הישנה (Access)" value={raw && raw.legacyId != null ? String(raw.legacyId) : ''} bdi opt />
          </div>
        </div>
        <div className="card">
          <div className="card-h"><div className="ico gold"><OcIcon name="box" size="lg" /></div><h2>מלאי</h2></div>
          <div className="dc-stats">
            <StatTile icon="box" n={c.n} label="פעילים" tip="פריטים פעילים" />
            <StatTile icon="check" n={c.avail} label="זמינים" />
            <StatTile icon="alert" n={c.att} label="טיפול" warn tip="פריטים שדורשים טיפול" />
          </div>
          <div className="kv" style={{ marginTop: 20 }}><Vf icon="dress" label="מידות" value={sizes.length ? sizes.join(', ') : 'אין'} /></div>
        </div>
      </div>
      <div className="card hist">
        <div className="card-h"><div className="ico gold"><OcIcon name="clock" size="lg" /></div><h2>פעולות ושינויים</h2></div>
        <A5List
          items={aiS.narrow(rows, (l, f) => !!l.bc && f.bcs.has(l.bc))}
          getId={(l) => l.id}
          loading={logs.status === 'loading' || logs.status === 'idle'}
          error={logs.status === 'error' ? (logs.error || 'שגיאה בטעינת היומן') : null}
          onRetry={() => dc.ensureLogs(true)}
          texts={{ placeholder: 'חיפוש ביומן…', aiPlaceholder: 'בקשו מה-AI למצוא פריטים בדגם - היומן יסונן לרישומים שלהם…', countLabel: 'רישומים', emptyText: aiS.emptyText || 'לא נמצאו רישומים' }}
          ai={aiS.ai}
          onStats={aiS.onStats}
          hay={(l) => [l.text, l.who, l.bc, l.ts.slice(11), hShort(l.ts.slice(0, 10)), ...l.det.flat()].join(' ')}
          filters={filters}
          sorts={sorts}
          defaultSort={{ k: 'ts', dir: -1 }}
          rowMain={(l, ctx) => (
            <>
              <div className="ic-b"><OcIcon name={l.icon || 'clock'} /><span className="rlbl">{l.scope === 'item' ? 'פריט' : 'דגם'}</span></div>
              <div className="t">
                <b>{ctx.hl(l.text)}{l.bc ? <span className="sub"><bdi>{ctx.hl(l.bc)}</bdi></span> : null}</b>
                <span className="ln mi">
                  <span className="lni"><OcIcon name="cal" />{hShort(l.ts.slice(0, 10))}</span>
                  <span className="lni"><OcIcon name="clock" /><bdi>{l.ts.slice(11)}</bdi></span>
                  <span className="lni"><OcIcon name="user" />{ctx.hl(l.who)}</span>
                </span>
              </div>
            </>
          )}
          detail={(l, ctx) => {
            const r = (k, v) => <div className="hv-r" key={k}><small>{k}</small><b>{v}</b></div>;
            const bf = l.det.find((x) => x[0] === 'לפני'); const af = l.det.find((x) => x[0] === 'אחרי');
            return (
              <>
                {r('מבצע', <><span className="av">{l.who[0]}</span>{ctx.hl(l.who)}</>)}
                {r('שעה', <>{dayTitle(l.ts.slice(0, 10))} · <bdi>{l.ts.slice(11)}</bdi></>)}
                {r('היקף', l.scope === 'item' ? <>פריט <bdi>{l.bc}</bdi></> : 'פרטי הדגם')}
                {bf && af ? r('שינוי', <><bdi>{ctx.hl(bf[1])}</bdi> ← <bdi>{ctx.hl(af[1])}</bdi></>) : null}
                {l.det.filter(([a]) => !(bf && af && (a === 'לפני' || a === 'אחרי'))).map(([a, b]) => r(a, ctx.hl(b)))}
              </>
            );
          }}
          columns={[
            { k: 'text', t: 'פעולה', cell: (l, ctx) => <><b>{ctx.hl(l.text)}</b>{l.bc ? <> · <bdi>{l.bc}</bdi></> : null}</> },
            { k: 'ts', t: 'תאריך', cell: (l) => <>{hShort(l.ts.slice(0, 10))} · <bdi>{l.ts.slice(11)}</bdi></> },
            { k: 'prev', t: 'קודם', cell: (l, ctx) => (l.prev ? ctx.hl(l.prev) : '—') },
            { k: 'new', t: 'חדש', cell: (l, ctx) => (l.next ? ctx.hl(l.next) : l.det[0] ? ctx.hl(l.det.map((d) => d[1]).join(' · ')) : '—') },
            { k: 'who', t: 'עובד מבצע', cell: (l, ctx) => ctx.hl(l.who) },
          ]}
          onOpen={null}
          exportSpec={{
            what: 'יומן השינויים',
            onExport: (kind, vis) => runListExport({ kind, say: sayOf(ui), title: `יומן שינויים · דגם ${cur.model.code}`, subtitle: modelDisplayName({ name: cur.model.name, barcodePrefix: cur.model.code }, { fallback: '' }), head, rows: rowsOf(vis), base: `יומן-דגם-${cur.model.code}` }),
          }}
        />
        {aiS.modal}
      </div>
    </>
  );
}
