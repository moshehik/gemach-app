'use client';
// app/v3/pilot/customer/tabs.js — תוכן הלשוניות והרייל של כרטיס הלקוח v3 (פיילוט).
// אותם נתונים ואותן קריאות כמו components/customers/modern/* ב-main; רק התצוגה חדשה.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { Card, Btn, IconBtn, Field, Switch, Icon, Chip, Badge, Row, Rows, Table, Empty, Banner } from '@/app/v3/ui/components';
import Tip from '@/app/v3/ui/Tip';
import { HistoryFeed } from '@/app/v3/history';
import { useStrings } from '@/app/v3/strings';
import {
  LTR_FIELDS, FIELD_ICON, norm, address, sortOrders, orderRow, fmtDate, fmtMoney, payChip, orderChip, parseNoteLine,
} from './model';

const Money = ({ n, neg }) => <bdi dir="ltr" className={neg ? 'v3p-neg' : undefined}>{neg ? '−' : ''}{fmtMoney(n)}</bdi>;

/* ---------------- פרטים ---------------- */
export function DetailsTab({ customer, original, errors, editing, onToggleEdit, onChange, onEmailBlur, onCopyEmail, onMail, onSave, saving, dirty, consentVisible, isHeadManagement, onUnblock }) {
  const { t } = useStrings();
  const [locations, setLocations] = useState({ cities: [], streets: [] });
  useEffect(() => { // כמו היום: נטען בטעינת הלשונית גם בלי מצב עריכה
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then((d) => setLocations({ cities: d?.cities || [], streets: d?.streets || [] }))
      .catch(() => {});
  }, []);
  const changed = (...keys) => keys.some((k) => norm(k, customer[k]) !== norm(k, original?.[k]));
  const was = (k) => (norm(k, original?.[k]) === '' ? t('customer.value.empty') : String(original?.[k]));

  const view = (k, label, value, opts = {}) => {
    const keys = opts.keys || [k];
    const isChanged = changed(...keys);
    const empty = String(value ?? '').trim() === '';
    return (
      <Row key={k} icon={FIELD_ICON[k]} label={<>{label}{isChanged && <> <Chip variant="attn">{t('customer.value.unsaved')}</Chip></>}</>}
        tip={opts.tip} missing={empty} missingText={t('common.state.missing')} className={isChanged ? 'v3p-changed' : undefined}>
        {LTR_FIELDS.has(k) ? <bdi dir="ltr">{value}</bdi> : value}
        {isChanged && <span className="v3p-was">{t('customer.value.was', { v: opts.was ?? was(k) })}</span>}
        {opts.sub && <div className="v3p-sub">{opts.sub}</div>}
      </Row>
    );
  };

  const field = (k, opts = {}) => (
    <div className={changed(k) ? 'v3p-field-changed' : undefined} key={k}>
      <Field label={opts.label || t(`customer.field.${k}`)} name={k} value={customer[k] ?? ''} onChange={onChange}
        required={opts.required} error={errors[k]} tip={opts.tip} placeholder={opts.ph} type={opts.type || 'text'}
        as={opts.as || 'input'} rows={opts.rows} list={opts.list} autoComplete={opts.list ? 'new-password' : 'off'}
        dir={LTR_FIELDS.has(k) ? 'ltr' : undefined} onBlur={opts.onBlur} />
      {opts.after}
    </div>
  );

  const addr = address(customer);
  const hasAny = customer.phone1 || customer.phone2 || customer.email || addr;
  const noAt = !customer.email || !String(customer.email).includes('@');

  return (
    <>
      {customer.isBlocked && (
        <div className="v3p-block" role="status">
          <span className="v3p-block__ic"><Icon name="lock" size="lg" /></span>
          <div className="v3p-block__t"><b>{t('customer.block.title')}</b>{customer.blockedReason && <span>{customer.blockedReason}</span>}</div>
          {isHeadManagement
            ? <Btn icon="unlock" onClick={onUnblock}>{t('customer.block.unblock')}</Btn>
            : <Tip content={t('customer.block.onlyHeadTip')}><Chip icon="lock">{t('customer.block.onlyHead')}</Chip></Tip>}
        </div>
      )}
      <Card icon="id" title={editing ? t('customer.details.editTitle') : t('customer.details.title')} tip={t('customer.details.tip')} variant="cust"
        actions={(
          // Q2 (REVIEW-2, ברירת מחדל = כמו היום): במצב עריכה הכפתור שומר, וסוגר רק אם השמירה הצליחה.
          <Btn variant={editing ? 'primary' : 'secondary'} icon={editing ? 'check' : 'edit'} aria-pressed={editing} loading={editing && saving} onClick={onToggleEdit}>
            {editing ? t('customer.details.saveAndClose') : t('customer.details.edit')}
          </Btn>
        )}>
        {!editing ? (
          hasAny ? (
            <Rows>
              {view('phone1', t('customer.field.phone1'), customer.phone1)}
              {view('phone2', t('customer.field.phone2'), customer.phone2)}
              {view('email', t('customer.field.email'), customer.email, {
                sub: customer.email ? <Btn size="sm" variant="quiet" icon="copy" onClick={onCopyEmail}>{t('customer.details.copy')}</Btn> : null,
              })}
              {view('city', t('customer.field.address'), addr, { keys: ['city', 'street', 'houseNum'], was: address(original) || t('customer.value.empty') })}
              {view('zeout', t('customer.field.zeout'), customer.zeout, { tip: t('customer.field.zeoutTip') })}
              {consentVisible && view('marketingConsent', t('customer.field.marketingConsent'), customer.marketingConsent ? t('customer.consent.yes') : t('customer.consent.no'),
                { was: original?.marketingConsent ? t('customer.consent.yes') : t('customer.consent.no') })}
            </Rows>
          ) : <Empty icon="phone" title={t('customer.details.noContactTitle')} text={t('customer.details.noContactText')} />
        ) : (
          <form className="v3p-form" autoComplete="off" noValidate onSubmit={(e) => { e.preventDefault(); onSave(); }}>
            <div className="v3p-grid">{field('firstName', { required: true })}{field('lastName', { required: true })}</div>
            <div className="v3p-grid">{field('phone1', { required: true, type: 'tel' })}{field('phone2', { type: 'tel' })}</div>
            {field('email', {
              type: 'email', onBlur: onEmailBlur,
              after: (
                <div className="v3p-sub">
                  {customer.email && <Btn size="sm" variant="quiet" icon="copy" onClick={onCopyEmail}>{t('customer.details.copy')}</Btn>}
                  {customer.email && <Btn size="sm" variant="quiet" icon="send" onClick={onMail}>{t('customer.details.sendMail')}</Btn>}
                  {noAt && <Btn size="sm" variant="quiet" icon="plus" title={t('customer.details.gmailTip')}
                    onClick={() => onChange({ target: { name: 'email', value: `${customer.email || ''}@gmail.com` } })}>{t('customer.details.gmail')}</Btn>}
                </div>
              ),
            })}
            <div className="v3p-grid">
              {field('city', { list: 'v3p-city-list' })}{field('street', { list: 'v3p-street-list' })}{field('houseNum', { type: 'number' })}
            </div>
            <datalist id="v3p-city-list">{locations.cities.map((c) => <option key={c} value={c} />)}</datalist>
            <datalist id="v3p-street-list">{locations.streets.map((s) => <option key={s} value={s} />)}</datalist>
            {field('zeout', { ph: t('customer.field.zeoutPh'), tip: t('customer.field.zeoutTip') })}
            {consentVisible && (
              <div className={changed('marketingConsent') ? 'v3p-field-changed' : undefined}>
                <Switch checked={!!customer.marketingConsent} label={t('customer.consent.on')}
                  onChange={(v) => onChange({ target: { name: 'marketingConsent', type: 'checkbox', checked: v } })} />
              </div>
            )}
            {field('notes', { as: 'textarea', rows: 4, label: t('customer.field.notesLong') })}
            {/* כפתור שמירה בתחתית הטופס (CC-39) — אותו מסלול כמו הרייל */}
            <Btn type="submit" variant="primary" icon="check" block loading={saving} disabled={!dirty}>{t('customer.details.save')}</Btn>
          </form>
        )}
      </Card>
      {!editing && customer.notes && (
        <Card icon="file" title={t('customer.notes.title')} tip={t('customer.notes.tip')}>
          {customer.notes.split('\n').map((line, i) => {
            const n = parseNoteLine(line);
            if (!n.auto) return <div key={i} className="v3p-note">{n.text}</div>;
            return (
              <div key={i} className="v3p-note">
                <div className="v3p-sub">
                  <Chip icon="calendar">{getHebrewDateString(n.date)}</Chip>
                  <Chip variant="info" icon="sparkles">{t('customer.notes.auto')}</Chip>
                  <Chip>{t('customer.notes.modelSize', { model: n.model, size: n.size })}</Chip>
                </div>
                <span>{n.text}</span>
                <a href={`/orders/${n.orderId}`}>{t('customer.notes.openOrder', { id: n.orderId })}<Icon name="next" size="sm" /></a>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

/* ---------------- הזמנות ---------------- */
export function OrdersTab({ orders }) {
  const { t } = useStrings();
  const router = useRouter();
  const rows = sortOrders(orders).map(orderRow).map((r) => ({ ...r, id: r.order.id }));
  if (!rows.length) return <Card><Empty icon="bag" title={t('customer.orders.emptyTitle')} text={t('customer.orders.emptyText')} /></Card>;
  const columns = [
    { key: 'order', header: t('customer.orders.col.order'), render: (r) => (
      <Link href={`/orders/${r.order.orderId}`} className="v3p-orderlink" onClick={(e) => e.stopPropagation()}>
        {t('customer.orders.link', { id: r.order.orderId })}<Icon name="next" size="sm" />
      </Link>
    ) },
    { key: 'date', header: t('customer.orders.col.date'), render: (r) => {
      const o = r.order;
      if (o.isWeekdayEvent) {
        return (<><span className="v3p-sub2">{t('customer.orders.pickup', { d: o.fromDate ? fmtDate(o.fromDate) : '-' })}</span>
          <span className="v3p-sub2">{t('customer.orders.return', { d: (o.toDate || o.returnDate) ? fmtDate(o.toDate || o.returnDate) : '-' })}</span></>);
      }
      return <bdi>{o.eventDateHebrew || (o.eventDate ? fmtDate(o.eventDate) : (o.orderDate ? fmtDate(o.orderDate) : '-'))}</bdi>;
    } },
    { key: 'status', header: t('customer.orders.col.status'), render: (r) => <Chip variant={orderChip(r.status)}>{r.status}</Chip> },
  ];
  return (
    <Card icon="bag" title={t('customer.orders.title')} tip={t('customer.orders.tip')}>
      <Table columns={columns} rows={rows} caption={t('customer.orders.title')}
        onRowClick={(r) => router.push(`/orders/${r.order.orderId}`)}
        renderExpanded={(r) => (
          <Rows className="v3p-exp">
            <Row icon="coin" label={t('customer.orders.required')}><Money n={r.required} /></Row>
            <Row icon="wallet" label={t('customer.orders.paid')}><Money n={r.paid} /></Row>
            <Row icon="receipt" label={t('customer.orders.payStatus')}><Chip variant={payChip(r.payStatus)}>{r.payStatus}</Chip></Row>
          </Rows>
        )} />
      <div className="v3p-foot">{t('customer.orders.count', { n: rows.length })}</div>
    </Card>
  );
}

/* ---------------- תשלומים ---------------- */
export function PaymentsTab({ payments, sums }) {
  const { t } = useStrings();
  const bal = sums.balance;
  const balTile = bal > 0
    ? <div className="v3p-tile v3p-tile--debt"><span className="v3p-tile__l"><Icon name="alert-tri" size="sm" />{t('customer.pay.debt')}</span><span className="v3p-tile__v"><Money n={bal} /></span></div>
    : bal < 0
      ? <div className="v3p-tile v3p-tile--credit"><span className="v3p-tile__l"><Icon name="wallet" size="sm" />{t('customer.pay.credit')}</span><span className="v3p-tile__v"><Money n={bal} /></span></div>
      : <div className="v3p-tile v3p-tile--even"><span className="v3p-tile__l"><Icon name="check" size="sm" />{t('customer.pay.even')}</span><span className="v3p-tile__v"><Money n={0} /></span></div>;
  const rows = payments.map((p) => ({ ...p, rk: `${p.entryType}-${p.id}` }));
  const columns = [
    { key: 'date', header: t('customer.pay.col.date'), render: (p) => <bdi>{fmtDate(p.paymentDate)}</bdi> },
    { key: 'type', header: t('customer.pay.col.type'), render: (p) => (p.entryType === 'refund'
      ? <Chip variant="attn" icon="refresh">{t('customer.pay.type.refund')}</Chip>
      : <Chip variant="done" icon="card">{t('customer.pay.type.payment')}</Chip>) },
    { key: 'amount', header: t('customer.pay.col.amount'), num: true, render: (p) => <Money n={p.amount} neg={p.entryType === 'refund'} /> },
  ];
  return (
    <>
      <Card icon="coin" title={t('customer.pay.accountTitle')} variant="cust">
        <div className="v3p-tiles">
          <div className="v3p-tile"><span className="v3p-tile__l"><Icon name="coin" size="sm" />{t('customer.pay.required')}</span><span className="v3p-tile__v"><Money n={sums.required} /></span></div>
          <div className="v3p-tile"><span className="v3p-tile__l"><Icon name="wallet" size="sm" />{t('customer.pay.paid')}</span><span className="v3p-tile__v"><Money n={sums.paid} /></span></div>
          {sums.refunded > 0 && <div className="v3p-tile"><span className="v3p-tile__l"><Icon name="refresh" size="sm" />{t('customer.pay.refunded')}</span><span className="v3p-tile__v"><Money n={sums.refunded} /></span></div>}
          {balTile}
        </div>
        <div className="v3p-formula"><Icon name="info" size="sm" />{t('customer.pay.formula')}</div>
      </Card>
      <Card icon="receipt" title={t('customer.pay.listTitle')} tip={t('customer.pay.listTip')}>
        {rows.length ? (
          <>
            <Table columns={columns} rows={rows} rowKey="rk" caption={t('customer.pay.listTitle')}
              renderExpanded={(p) => {
                const r = p.entryType === 'refund';
                return (
                  <Rows className="v3p-exp">
                    <Row icon="bag" label={t('customer.pay.order')} missing={!p.orderId} missingText="-">
                      {p.orderId && <Link href={`/orders/${p.orderId}`}>{t('customer.orders.link', { id: p.orderId })}</Link>}
                    </Row>
                    <Row icon={r ? 'info' : 'card'} label={r ? t('customer.pay.reason') : t('customer.pay.method')}>{r ? (p.reason || t('customer.pay.type.refund')) : p.paymentMethod}</Row>
                    {r
                      ? <Row icon="clock" label={t('customer.pay.exec')}>{p.isExecuted ? t('customer.pay.executed', { d: fmtDate(p.executionDate) }) : t('customer.pay.pending')}</Row>
                      : <Row icon="file" label={t('customer.pay.note')} missing={!p.notes} missingText={t('customer.pay.noNote')}>{p.notes}</Row>}
                  </Rows>
                );
              }} />
            <div className="v3p-foot">{t('customer.pay.count', { n: rows.length })}</div>
          </>
        ) : <Empty icon="card" title={t('customer.pay.emptyTitle')} text={t('customer.pay.emptyText')} />}
      </Card>
    </>
  );
}

/* ---------------- זיכוי ובנק ---------------- */
export function RefundsTab({ customer, original, onChange, onSave, saving, dirty, refunds }) {
  const { t } = useStrings();
  const changed = (k) => norm(k, customer[k]) !== norm(k, original?.[k]);
  const f = (k, ph) => (
    <div className={changed(k) ? 'v3p-field-changed' : undefined}>
      <Field label={t(`customer.field.${k}`)} name={k} value={customer[k] || ''} placeholder={ph} dir={LTR_FIELDS.has(k) ? 'ltr' : undefined} onChange={onChange} />
    </div>
  );
  const columns = [
    { key: 'createdAt', header: t('customer.refunds.col.requested'), render: (r) => <bdi>{fmtDate(r.createdAt)}</bdi> },
    { key: 'orderId', header: t('customer.refunds.col.order'), render: (r) => (r.orderId ? <Link href={`/orders/${r.orderId}`}><bdi>{r.orderId}</bdi></Link> : '-') },
    { key: 'amount', header: t('customer.refunds.col.amount'), num: true, render: (r) => <Money n={r.amount} /> },
    { key: 'state', header: t('customer.refunds.col.state'), render: (r) => (r.isExecuted
      ? <Chip variant="done" icon="check">{t('customer.refunds.done')}</Chip>
      : <Chip variant="attn" icon="clock">{t('customer.refunds.waiting')}</Chip>) },
  ];
  return (
    <>
      <Card icon="wallet" title={t('customer.refunds.bankTitle')} tip={t('customer.refunds.bankTip')} variant="cust">
        <form className="v3p-form" autoComplete="off" noValidate onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          <div className="v3p-grid">{f('bankName', t('customer.field.bankNamePh'))}{f('bankBranch', t('customer.field.bankBranchPh'))}</div>
          <div className="v3p-grid">{f('bankAccount')}{f('bankAccountName')}</div>
          <div><Btn type="submit" variant="primary" icon="check" loading={saving} disabled={!dirty}>{t('customer.details.save')}</Btn></div>
        </form>
      </Card>
      <Card icon="refresh" title={t('customer.refunds.listTitle')}>
        {refunds.length ? (
          <>
            <Table columns={columns} rows={refunds} caption={t('customer.refunds.listTitle')}
              renderExpanded={(r) => (
                <Rows className="v3p-exp">
                  <Row icon="info" label={t('customer.pay.reason')} missing={!r.reason} missingText="-">{r.reason}</Row>
                  <Row icon="clock" label={t('customer.pay.exec')}>{r.isExecuted ? t('customer.pay.executed', { d: fmtDate(r.executionDate) }) : t('customer.pay.pending')}</Row>
                </Rows>
              )} />
            <div className="v3p-foot">{t('customer.refunds.count', { n: refunds.length })}</div>
          </>
        ) : <Empty icon="refresh" title={t('customer.refunds.emptyTitle')} text={t('customer.refunds.emptyText')} />}
      </Card>
    </>
  );
}

/* ---------------- היסטוריה ---------------- */
// אותה קריאה בדיוק: GET /api/audit?entityType=Customer&entityId=<uuid>[&search=]; נטען גם כשהלשונית לא פעילה
// (כל הלשוניות נשארות mounted — CC-26); ביטול תשובה ישנה דרך cancelled.
export function HistoryTab({ customerId, reloadKey }) {
  const { t } = useStrings();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const query = new URLSearchParams();
        query.append('entityType', 'Customer');
        if (customerId) query.append('entityId', customerId);
        if (filterSearch) query.append('search', filterSearch);
        const res = await fetch(`/api/audit?${query.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setLogs(data.logs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId, filterSearch, reloadKey]);

  return (
    <Card icon="history" title={t('customer.history.title')} tip={t('customer.history.tip')}
      actions={<Badge variant="neutral"><bdi>{logs.length}</bdi></Badge>}>
      {error ? <Banner kind="alert" title={t('customer.history.error')} text={error} />
        : loading && !logs.length ? <div className="v3-hempty" role="status" aria-busy="true"><span className="v3-spin" aria-hidden="true" /><b>{t('customer.history.loading')}</b></div>
          : <HistoryFeed rows={logs} ctx={{}} total={logs.length} serverQuery={filterSearch}
              onServerSearch={(s) => setFilterSearch(s)} onClearServerSearch={() => setFilterSearch('')} />}
    </Card>
  );
}

/* ---------------- רייל: במבט אחד + רשימת שינויים ---------------- */
export function Glance({ ordersCount, sums, upcoming, blocked }) {
  const { t } = useStrings();
  const bal = sums.balance;
  return (
    <>
      <div className="v3p-gl"><span className="v3p-gl__l"><Icon name="bag" size="sm" />{t('customer.rail.orders')}</span><span className="v3p-gl__v"><bdi>{ordersCount}</bdi></span></div>
      <div className={`v3p-gl${bal > 0 ? ' v3p-gl--debt' : ''}`}>
        <span className="v3p-gl__l"><Icon name={bal > 0 ? 'alert-tri' : bal < 0 ? 'wallet' : 'check'} size="sm" />{bal > 0 ? t('customer.rail.debt') : bal < 0 ? t('customer.rail.credit') : t('customer.rail.balance')}</span>
        <span className="v3p-gl__v"><Money n={bal} /></span>
      </div>
      <div className="v3p-gl v3p-gl--wide"><span className="v3p-gl__l"><Icon name="calendar" size="sm" />{t('customer.rail.upcoming')}</span>
        <span className="v3p-gl__v">{upcoming ? <bdi>{upcoming.eventDateHebrew || fmtDate(upcoming.eventDate)}</bdi> : t('customer.rail.noUpcoming')}</span></div>
      {blocked && <div className="v3p-gl v3p-gl--wide v3p-gl--block"><span className="v3p-gl__l"><Icon name="lock" size="sm" />{t('customer.rail.state')}</span><span className="v3p-gl__v">{t('customer.page.blocked')}</span></div>}
    </>
  );
}

const shown = (t, k, v) => (k === 'marketingConsent' ? (v ? t('customer.consent.yes') : t('customer.consent.no')) : (String(v ?? '').trim() === '' ? t('customer.value.empty') : String(v)));

export function ChangeList({ changes, undone, onUndo, onRedo }) {
  const { t } = useStrings();
  const label = (k) => t(`customer.field.${k}`);
  if (!changes.length && !undone.length) return <div className="v3p-rail-empty"><Icon name="check" />{t('customer.rail.empty')}</div>;
  return (
    <div className="v3p-chg-list" aria-live="polite">
      {changes.map((c) => (
        <div key={c.k} className="v3p-chg">
          <span className="v3p-chg__ic"><Icon name={FIELD_ICON[c.k]} size="sm" /></span>
          <span className="v3p-chg__t">
            <b>{norm(c.k, c.from) === '' ? t('customer.rail.added', { field: label(c.k) }) : t('customer.rail.changed', { field: label(c.k) })}</b>
            <span className="v3p-range"><bdi className="v3p-range__from">{shown(t, c.k, c.from)}</bdi><Icon name="next" size="sm" /><bdi>{shown(t, c.k, c.to)}</bdi></span>
          </span>
          <IconBtn icon="undo" variant="on-dark" label={t('customer.rail.undo', { field: label(c.k) })} title={t('customer.rail.undoTip')} onClick={() => onUndo(c.k)} />
        </div>
      ))}
      {undone.map((k) => (
        <div key={`u-${k}`} className="v3p-chg v3p-chg--undone">
          <span className="v3p-chg__ic"><Icon name={FIELD_ICON[k]} size="sm" /></span>
          <span className="v3p-chg__t"><b>{label(k)}</b><span>{t('customer.rail.undoneLine')}</span></span>
          <IconBtn icon="redo" variant="on-dark" label={t('customer.rail.redo', { field: label(k) })} title={t('customer.rail.redoTip')} onClick={() => onRedo(k)} />
        </div>
      ))}
    </div>
  );
}

export function RailContent({ glance, changes, undone, onUndo, onRedo, onSave, onDiscard, saving, showGlance = true }) {
  const { t } = useStrings();
  return (
    <>
      {showGlance && (
        <div>
          <h2><Icon name="sparkles" />{t('customer.rail.glance')}</h2>
          <div className="v3p-glance">{glance}</div>
        </div>
      )}
      <div>
        <h2><Icon name="edit" />{t('customer.rail.changes')}<Badge variant={changes.length ? 'gold' : 'neutral'}><bdi>{changes.length}</bdi></Badge><Tip>{t('customer.rail.changesTip')}</Tip></h2>
        <ChangeList changes={changes} undone={undone} onUndo={onUndo} onRedo={onRedo} />
      </div>
      <div className="v3p-cta">
        <Btn variant="primary" size="lg" block icon="check" loading={saving} disabled={!changes.length} onClick={onSave} data-autofocus={showGlance ? undefined : ''}>{saving ? t('customer.rail.saving') : t('customer.rail.save')}</Btn>
        <Btn variant="on-dark" block icon="refresh" disabled={!changes.length || saving} onClick={onDiscard}>{t('customer.rail.discard')}</Btn>
      </div>
    </>
  );
}
