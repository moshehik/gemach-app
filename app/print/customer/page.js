'use client';

// /print/customer?customerId=<uuid>&type=card|account|contact - מסמכי הלקוח של כרטיס הלקוח החדש (הבעלים prt / dl / mailpdf):
//   card    - כרטיס לקוחה: פרטים, הערות, פרטי בנק, הזמנות ומצב חשבון
//   account - דף חשבון: חיובים לפי הזמנה, תשלומים, זיכויים ויתרה (אותה נוסחה כמו הכרטיס: חיובים − (תשלומים − זיכויים))
//   contact - דף פרטי קשר: שם, טלפונים, מייל, כתובת
// מוסכמות ההדפסה (app/globals.css @media print, memory print-surfaces-conventions): רקע לבן, בלי משתני ערכת הנושא, תאריכים עבריים.
// בלי פרמטרים: window.print() אוטומטי ורישום CUSTOMER_PRINTED (source 'print-page') בהיסטוריית הלקוח. downloadPdf=true (רינדור
// ראש-חסר של POST /api/pdf) או preview=1: בלי הדפסה ובלי רישום; data-print-ready="true" כשהנתונים נטענו.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { paymentNoteSummary } from '@/lib/history/sanitize';
import {
  accountSummary, displayName, orderEventIso, orderItemModels, orderPaid, orderRequired, paymentRows, sortOrders, splitNotes, signatureOrderText, signatureState,
} from '@/app/components/customer-card/customerCardLogic';
import { logCustomerEvent } from '@/app/components/customer-card/ccEvents';
import { CUSTOMER_DOC_LABELS } from '@/lib/history/customerEvents';

const money = (n) => `₪${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('he-IL')}`;
const heb = (d) => (d ? getHebrewDateString(d) : '');
const TYPES = ['card', 'account', 'contact'];

export default function PrintCustomerPage() {
  const sp = useSearchParams();
  const customerId = sp.get('customerId') || '';
  const type = TYPES.includes(sp.get('type')) ? sp.get('type') : 'card';
  const headless = sp.get('downloadPdf') === 'true' || sp.get('downloadPdf') === '1' || (typeof navigator !== 'undefined' && navigator.webdriver);
  const preview = sp.get('preview') === '1';
  const [c, setC] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [gmach, setGmach] = useState('גמ״ח שמלות');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        if (!customerId) throw new Error('לא צוין לקוח להדפסה');
        const [cr, rr, sr] = await Promise.all([
          fetch(`/api/customers/${encodeURIComponent(customerId)}`),
          fetch(`/api/refunds?customerId=${encodeURIComponent(customerId)}`),
          fetch('/api/settings', { cache: 'no-store' }),
        ]);
        const cd = await cr.json().catch(() => ({}));
        if (!cr.ok || cd.error) throw new Error('הלקוח לא נמצא');
        const rd = await rr.json().catch(() => []);
        const sd = await sr.json().catch(() => []);
        if (off) return;
        setC(cd);
        if (Array.isArray(rd)) setRefunds(rd);
        if (Array.isArray(sd)) setGmach(sd.find((s) => s.key === 'gmach_name')?.value || 'גמ״ח שמלות');
      } catch (e) {
        if (!off) setError(e.message || 'שגיאה בטעינת הנתונים');
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [customerId]);

  useEffect(() => {
    if (loading || error || !c || headless || preview) return undefined;
    logCustomerEvent(c.id, 'CUSTOMER_PRINTED', { doc: type, source: 'print-page' });
    const t = setTimeout(() => { try { window.print(); } catch { /* noop */ } }, 500);
    return () => clearTimeout(t);
  }, [loading, error, c, headless, preview, type]);

  const acc = useMemo(() => (c ? accountSummary(c, refunds) : null), [c, refunds]);
  const orders = useMemo(() => (c ? sortOrders(c.orders || []) : []), [c]);
  const today = heb(new Date());

  let content = null;
  if (c && acc) {
    const address = [c.street ? `${c.street}${c.houseNum ? ` ${c.houseNum}` : ''}` : '', c.city].filter(Boolean).join(', ');
    const contactRows = [['שם פרטי', c.firstName], ['שם משפחה', c.lastName], ['טלפון', c.phone1], ['טלפון נוסף', c.phone2], ['מייל', c.email], ['כתובת', address]];
    const kv = (rows) => (
      <table className="pc-kv"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v === null || v === undefined || String(v).trim() === '' ? '—' : String(v)}</td></tr>)}</tbody></table>
    );
    const ordersTable = (
      <table className="pc-tbl"><thead><tr><th>הזמנה</th><th>תאריך אירוע</th><th>פריטים</th><th>סכום</th><th>שולם</th><th>יתרה</th></tr></thead>
        <tbody>{orders.length ? orders.map((o) => (
          <tr key={o.id}><td>#{o.orderId}{o.isDeleted ? ' (בוטלה)' : ''}</td><td>{heb(orderEventIso(o)) || '—'}</td><td>{orderItemModels(o).join(', ') || '—'}</td><td>{money(orderRequired(o))}</td><td>{money(orderPaid(o))}</td><td>{money(orderRequired(o) - orderPaid(o))}</td></tr>
        )) : <tr><td colSpan={6}>אין הזמנות</td></tr>}</tbody></table>
    );
    const balanceBox = (
      <table className="pc-kv pc-bal"><tbody>
        <tr><th>סה״כ חיובים</th><td>{money(acc.required)}</td></tr>
        <tr><th>סה״כ תשלומים</th><td>{money(acc.paid)}</td></tr>
        <tr><th>סה״כ זיכויים</th><td>{money(acc.refunds)}</td></tr>
        <tr className="pc-total"><th>{acc.balance > 0 ? 'יתרה לתשלום' : acc.balance < 0 ? 'יתרת זכות' : 'יתרה'}</th><td>{money(Math.abs(acc.balance))}</td></tr>
      </tbody></table>
    );
    if (type === 'contact') {
      content = <>{kv(contactRows)}</>;
    } else if (type === 'account') {
      const pays = paymentRows(c, refunds);
      content = (
        <>
          {kv([['לקוחה', displayName(c)], ['טלפון', c.phone1], ['מספר לקוח', c.legacyId || '']])}
          <h2>חיובים לפי הזמנה</h2>
          {ordersTable}
          <h2>תשלומים וזיכויים</h2>
          <table className="pc-tbl"><thead><tr><th>תאריך</th><th>סוג</th><th>הזמנה</th><th>פרטים</th><th>סכום</th></tr></thead>
            <tbody>{pays.length ? pays.map((p) => (
              <tr key={`${p.entryType}-${p.id}`}><td>{heb(p.paymentDate)}</td><td>{p.entryType === 'refund' ? 'זיכוי' : (p.paymentMethod || 'תשלום')}</td><td>{p.orderId ? `#${p.orderId}` : '—'}</td><td>{p.entryType === 'refund' ? (p.reason || '') : paymentNoteSummary(p.notes)}</td><td>{p.entryType === 'refund' ? `−${money(p.amount)}` : money(p.amount)}</td></tr>
            )) : <tr><td colSpan={5}>אין תשלומים</td></tr>}</tbody></table>
          <h2>סיכום</h2>
          {balanceBox}
        </>
      );
    } else {
      const sig = signatureState(c);
      const { manual, auto } = splitNotes(c.notes);
      content = (
        <>
          <h2>פרטי לקוחה</h2>
          {kv([...contactRows, ['תעודת זהות', c.zeout], ['מספר לקוח', c.legacyId || ''], ['אישור דיוור', c.marketingConsent ? 'מאושר' : 'לא מאושר'], ['חתימה על תקנון', sig.signed ? `נחתם${signatureOrderText(sig)}` : 'טרם נחתם']])}
          {(manual.trim() || auto.length) ? (
            <>
              <h2>הערות</h2>
              {manual.trim() ? <p className="pc-notes">{manual}</p> : null}
              {auto.map((a, i) => <p key={i} className="pc-auto">{heb(a.date)} · דגם {a.model}{a.size ? ` מידה ${a.size}` : ''} · {a.rest} (הזמנה #{a.orderId})</p>)}
            </>
          ) : null}
          {(c.bankName || c.bankAccount) ? (<><h2>פרטי בנק לזיכויים</h2>{kv([['שם בנק', c.bankName], ['סניף', c.bankBranch], ['מספר חשבון', c.bankAccount], ['שם בעל החשבון', c.bankAccountName]])}</>) : null}
          <h2>הזמנות</h2>
          {ordersTable}
          <h2>מצב חשבון</h2>
          {balanceBox}
        </>
      );
    }
  }

  return (
    <>
      <style>{`
        body { background-color: #fafafa !important; }
        nav.navbar, .global-sidebar-container, .topbar, .ai-floating-widget, [class*="sidebar"], [id*="sidebar"] { display: none !important; }
        .pc-wrap { background: #fff; max-width: 850px; margin: 32px auto; padding: 40px 46px; border: 1px solid #efefef; color: #222; direction: rtl; font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
        .pc-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 18px; }
        .pc-head h1 { margin: 0; font-size: 24px; }
        .pc-head .pc-sub { color: #555; font-size: 13px; }
        .pc-wrap h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        .pc-kv { border-collapse: collapse; width: 100%; }
        .pc-kv th { text-align: right; width: 34%; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #eee; color: #444; }
        .pc-kv td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        .pc-bal { max-width: 420px; }
        .pc-total th, .pc-total td { font-weight: 700; border-top: 2px solid #222; }
        .pc-tbl { border-collapse: collapse; width: 100%; font-size: 13px; }
        .pc-tbl th, .pc-tbl td { border: 1px solid #ccc; padding: 5px 7px; text-align: right; vertical-align: top; }
        .pc-tbl th { background: #f2f2f2; }
        .pc-notes { white-space: pre-wrap; margin: 4px 0 8px; }
        .pc-auto { margin: 2px 0; color: #444; font-size: 13px; }
        .pc-msg { text-align: center; padding: 50px; color: #666; font-size: 18px; }
        .pc-contact .pc-kv { font-size: 20px; }
        .pc-contact .pc-kv th, .pc-contact .pc-kv td { padding: 12px 8px; }
        @media print { .pc-wrap { margin: 0; border: 0; padding: 0; max-width: none; } }
      `}</style>
      <div className={`pc-wrap pc-${type}`} data-print-ready={loading ? undefined : 'true'} data-print-error={error || undefined}>
        {loading ? <div className="pc-msg">טוען נתונים להדפסה...</div> : error ? <div className="pc-msg">{error}</div> : (
          <>
            <div className="pc-head">
              <div><h1>{CUSTOMER_DOC_LABELS[type]} · {displayName(c)}</h1><div className="pc-sub">{gmach}</div></div>
              <div className="pc-sub">הופק {today}</div>
            </div>
            {content}
          </>
        )}
      </div>
    </>
  );
}
