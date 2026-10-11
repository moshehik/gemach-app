'use client';

// DcRentalsTab - לשונית "השכרות" של כרטיס הדגם: כרטיס "סיכום" (4 אריחים) + רשימת ההשכרות על ערכת הרשימות (a5-list). rentCfg / renderRentSum ב-model-card.js.
// הנתונים: /api/dresses/[id]/rentals (כמו הדף הישן) - סה"כ / שנה אחרונה / מושכר כרגע / ממתין להחזרה (עבר תאריך האירוע) לפי stats של השרת.
import { useMemo } from 'react';
import { A5List } from '../../a5-list';
import OcIcon from '../../order-card/OcIcon';
import { runListExport } from '../../a5-list';
import { runDressDoc, sayOf } from '../dcPrint';
import useDcListAi from '../useDcListAi';
import { RET_ICON, RET_LABEL, dayTitle, hShort } from '@/lib/dressCardLogic';

export function StatTile({ icon, n, label, warn, tip }) {
  return (
    <div className={`dc-st${warn ? ' warn' : ''}${warn && !n ? ' zero' : ''}`} tabIndex={0} data-tip={tip || label}>
      <OcIcon name={icon} /><b>{n}</b><small>{label}</small>
    </div>
  );
}

export default function DcRentalsTab({ dc, ui }) {
  const { rentals, cur } = dc;
  const aiS = useDcListAi({ dc, ui, which: 'rentals' });
  const list = rentals.list;
  const shown = aiS.narrow(list, (r, f) => f.orders.has(`${r.order}|${r.bc}`) || (!f.orders.size && f.bcs.has(r.bc)));
  const st = rentals.stats || {};
  const sizes = useMemo(() => [...new Set(list.map((r) => r.size).filter((s) => s !== ''))].sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b), 'he')), [list]);
  const filters = useMemo(() => [
    { key: 'size', label: 'מידה', icon: 'dress', def: [], options: sizes.map((s) => ({ k: s, l: `מידה ${s}`, i: 'tag', test: (r) => r.size === s })) },
    { key: 'ret', label: 'סטטוס החזרה', icon: 'undo', def: [], options: [
      { k: 'out', l: 'טרם הוחזר', i: 'clock', test: (r) => r.ret === 'out' },
      { k: 'ok', l: 'הוחזר תקין', i: 'check', test: (r) => r.ret === 'ok' },
      { k: 'bad', l: 'הוחזר עם בעיה', i: 'alert', test: (r) => r.ret === 'bad' }] },
  ], [sizes]);
  const sorts = useMemo(() => [
    { k: 'event', l: 'תאריך אירוע', i: 'gift', get: (r) => r.event },
    { k: 'order', l: 'מס׳ הזמנה', i: 'hash', get: (r) => Number(r.order) || 0 },
    { k: 'cust', l: 'לקוחה', i: 'user', get: (r) => r.cust },
    { k: 'size', l: 'מידה', i: 'dress', get: (r) => Number(r.size) || 0 },
    { k: 'taken', l: 'לקיחה', i: 'bag', get: (r) => r.taken || '' },
    { k: 'ret', l: 'סטטוס החזרה', i: 'undo', get: (r) => r.ret },
  ], []);
  const openOrder = (r) => window.open(`/orders/${r.order}`, '_blank', 'noopener');
  const retText = (r) => (r.overdue ? 'ממתין להחזרה' : RET_LABEL[r.ret]);

  const head = ['מס׳ הזמנה', 'לקוחה', 'מידה', 'ברקוד', 'תאריך אירוע', 'לקיחה', 'סטטוס החזרה'];
  const rowsOf = (l) => l.map((r) => [r.order, r.cust, r.size, r.bc, hShort(r.event), r.taken ? hShort(r.taken) : '', retText(r)]);

  return (
    <>
      <div className="card">
        <div className="card-h"><div className="ico teal"><OcIcon name="refresh" size="lg" /></div><h2>סיכום</h2></div>
        <div id="dcRentSum"><div className="dc-stats">
          <StatTile icon="refresh" n={st.total || 0} label="סה״כ" tip="סה״כ השכרות לדגם" />
          <StatTile icon="cal" n={st.lastYear || 0} label="שנה אחרונה" tip="השכרות בשנה האחרונה" />
          <StatTile icon="bag" n={st.outNow || 0} label="מושכר" tip="מושכר כרגע" />
          <StatTile icon="alert" n={st.overdue || 0} label="באיחור" warn tip="ממתין להחזרה — עבר תאריך האירוע" />
        </div></div>
      </div>
      <div className="card hist">
        <div className="card-h"><div className="ico teal"><OcIcon name="bag" size="lg" /></div><h2>השכרות</h2></div>
        <A5List
          items={shown}
          getId={(r) => r.id}
          loading={rentals.status === 'loading' || rentals.status === 'idle'}
          error={rentals.status === 'error' ? (rentals.error || 'שגיאה בטעינת ההשכרות') : null}
          onRetry={() => dc.ensureRentals(true)}
          texts={{ placeholder: 'חיפוש השכרה…', aiPlaceholder: 'בקשו מה-AI למצוא השכרות של הדגם (למשל: השכרות שטרם הוחזרו)…', countLabel: 'השכרות', emptyText: aiS.emptyText || 'אין השכרות' }}
          ai={aiS.ai}
          onStats={aiS.onStats}
          hay={(r) => [r.order, r.cust, r.bc, r.size, RET_LABEL[r.ret], hShort(r.event)].join(' ')}
          filters={filters}
          sorts={sorts}
          defaultSort={{ k: 'event', dir: -1 }}
          rowMain={(r, c) => (
            <>
              <div className="ic-b sq"><OcIcon name={r.ret === 'ok' ? 'bag' : r.ret === 'bad' ? 'alert' : 'clock'} /></div>
              <div className="t">
                <b>{c.hl(r.cust)}</b>
                <span className="ln mi">
                  <span className="lni" data-tip="מספר הזמנה"><OcIcon name="hash" /><bdi>{c.hl(r.order)}</bdi></span>
                  <span className="lni" data-tip="פריט"><OcIcon name="dress" />{r.size} · <bdi>{c.hl(r.bc)}</bdi></span>
                  <span className="lni"><OcIcon name="gift" />אירוע {hShort(r.event)}</span>
                  <span className="lni"><OcIcon name="bag" />{r.taken ? `לקיחה ${hShort(r.taken)}` : 'טרם נלקחה'}</span>
                  <span className={`lni${r.ret === 'ok' ? '' : ' warn'}`}><OcIcon name={RET_ICON[r.ret]} />{retText(r)}</span>
                </span>
              </div>
            </>
          )}
          detail={(r) => {
            const x = (k, v) => <div className="hv-r" key={k}><small>{k}</small><b>{v}</b></div>;
            return (
              <>
                {x('הזמנה', <bdi>#{r.order}</bdi>)}{x('לקוחה', r.cust)}{x('פריט', <>מידה {r.size} · <bdi>{r.bc}</bdi></>)}{x('אירוע', dayTitle(r.event))}{x('לקיחה', r.taken ? dayTitle(r.taken) : 'טרם נלקחה')}
                {x('החזרה', r.retDate ? dayTitle(r.retDate) : 'טרם הוחזר')}{x('סטטוס', RET_LABEL[r.ret] + (r.note ? ` · ${r.note}` : ''))}
                <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns"><button type="button" className="btn sm" data-tip="פתיחת כרטיס הזמנה" onClick={() => openOrder(r)}><OcIcon name="ext" size="sm" />כרטיס הזמנה</button></b></div>
              </>
            );
          }}
          columns={[
            { k: 'order', t: 'מס׳ הזמנה', cell: (r, c) => <b><bdi>{c.hl(r.order)}</bdi></b> },
            { k: 'cust', t: 'לקוחה', cell: (r, c) => c.hl(r.cust) },
            { k: 'size', t: 'פריט', cell: (r, c) => <>{r.size} · <bdi>{c.hl(r.bc)}</bdi></> },
            { k: 'event', t: 'תאריך אירוע', cell: (r) => hShort(r.event) },
            { k: 'taken', t: 'לקיחה', cell: (r) => (r.taken ? hShort(r.taken) : '—') },
            { k: 'ret', t: 'סטטוס החזרה', cell: (r) => <><OcIcon name={RET_ICON[r.ret]} />{RET_LABEL[r.ret]}</> },
          ]}
          onOpen={openOrder}
          exportSpec={{
            what: 'רשימת ההשכרות',
            onPrint: (vis, state) => runDressDoc({ dc, ui, kind: 'print', which: 'rentals', list: vis, state, filters }),
            onDownload: (vis, state) => runDressDoc({ dc, ui, kind: 'download', which: 'rentals', list: vis, state, filters }),
            onExport: (kind, vis) => runListExport({ kind, say: sayOf(ui), title: `השכרות · דגם ${cur.model.code}`, subtitle: cur.model.name, head, rows: rowsOf(vis), base: `השכרות-דגם-${cur.model.code}` }),
          }}
        />
        {aiS.modal}
      </div>
    </>
  );
}
