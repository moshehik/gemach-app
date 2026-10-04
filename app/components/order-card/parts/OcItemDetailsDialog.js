'use client';

// OcItemDetailsDialog — ⓘ "פרטים נוספים והיסטוריה" לפריט (R28; העיצוב: WIN.itemdet). פורט של חלון הפרטים של הישן (MIM :1289-1438):
// חיובי הפריט מתוך חיובי ההזמנה (תיאור שמכיל "(פריט #<id>)", כולל זיכויים) + סה״כ, תאריכי הוספה / השכרה / החזרה, והיסטוריית
// הפריט מ-GET /api/audit/order-item/{id} (אותו קיפול כפילויות). שינויים לעומת הישן: תאריכים עבריים בלבד (בלי תאריך לועזי),
// "תאריך הוספה" לפי כלל A11 (createdAt; פריט מיובא → תאריך ההזמנה), שם העובד ליד כל שורת היסטוריה, וערכי מזהה (UUID) מוסתרים.
import { useEffect, useState } from 'react';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '@/components/HistoryViewer';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { fmtMoney } from '../orderCardLogic';
import { addedAtOf, dayTimeOf, dedupeAuditLogs, isLegacyItem, itemName, itemObligations, logChangeRows as logChangeRowsOf } from '../hooks/useItemActions';

const dayTime = dayTimeOf;

// שורות השינוי של רשומת יומן אחת (הלוגיקה ב-useItemActions.logChangeRows — טהורה ונבדקת ב-node)
const logChangeRows = (log) => logChangeRowsOf(log, FIELD_TRANSLATIONS);

export default function OcItemDetailsDialog({ item, order, obligations, loadLogs, employeeName, close }) {
  const [logs, setLogs] = useState(null); // null = בטעינה
  const [open, setOpen] = useState({});
  useEffect(() => {
    let off = false;
    loadLogs(item.id).then(l => { if (!off) setLogs(Array.isArray(l) ? l : []); }).catch(() => { if (!off) setLogs([]); });
    return () => { off = true; };
  }, [item.id]);
  const rel = itemObligations(obligations, item.id);
  const total = rel.reduce((s, o) => s + o.amount, 0);
  const added = dayTime(addedAtOf(item, order), !isLegacyItem(item));
  const shown = logs ? dedupeAuditLogs(logs) : [];
  return (
    <>
      <DlgHead id="oc-dlg-t" title={`פרטי פריט: דגם ${itemName(item)}`} sub={item.sizeText ? `מידה ${item.sizeText}` : ''} />
      <b className="oc-dsec">חיובים לפריט</b>
      <div className="chg oc-det-obl">
        {rel.length ? (
          <>
            {rel.map((o, i) => (
              <div className="c" key={o.id || i}>
                <div className="ico gray oc-cico"><OcIcon name={o.isCredit ? 'undo' : 'dress'} size="sm" /></div>
                <div className="t">{o.label}{o.isCredit ? <span className="chip green oc-crchip">זיכוי</span> : null}{o.desc ? <small className="faint oc-obldesc">{o.desc}</small> : null}</div>
                <div className="amt z"><bdi dir="ltr">{o.isCredit ? '−' : ''}{fmtMoney(o.amount)}</bdi></div>
              </div>
            ))}
            <div className="c oc-det-total"><div className="t"><b>סה״כ לפריט</b></div><div className="amt z"><bdi dir="ltr">{total < 0 ? '−' : ''}{fmtMoney(total)}</bdi></div></div>
          </>
        ) : <div className="c"><div className="t faint">אין חיובים מפורטים לפריט זה</div></div>}
      </div>
      <div className="chg oc-det-dates">
        <div className="c"><div className="t">תאריך הוספה</div><div className="amt z">{added || '—'}</div></div>
        <div className="c"><div className="t">השכרה (לקיחה)</div><div className="amt z">{dayTime(item.takenDate) || 'טרם הושכר'}</div></div>
        <div className="c"><div className="t">החזרה</div><div className="amt z">{dayTime(item.returnDate) || 'טרם הוחזר'}</div></div>
      </div>
      <b className="oc-dsec">היסטוריית שינויים</b>
      <div className="chg oc-det-hist" aria-busy={logs === null}>
        {logs === null ? (
          <div className="c" role="status"><span className="spinner" aria-hidden="true" /><div className="t faint">טוען היסטוריה...</div></div>
        ) : shown.length ? shown.map((log, idx) => {
          const rows = logChangeRows(log);
          const isOpen = !!open[idx];
          const who = employeeName(log.employeeId);
          return (
            <div className="c oc-hrow" key={log.id || idx}>
              <button type="button" className="oc-hbtn" aria-expanded={isOpen} onClick={() => setOpen(p => ({ ...p, [idx]: !p[idx] }))}>
                <span className="t"><b>{ACTION_TRANSLATIONS[log.action] || log.action}</b></span>
                <span className="amt z">{[dayTime(log.createdAt), who].filter(Boolean).join(' · ')}</span>
                <OcIcon name="chev" size="sm" className="oc-hchev" />
              </button>
              {isOpen ? (
                <div className="oc-hdet">
                  {rows === null ? <div className="faint">{String(log.changesJson)}</div>
                    : rows.length ? rows.map(r => <div key={r.key}>{r.text}</div>)
                      : <div className="faint">אין שינויים רלוונטיים להצגה</div>}
                </div>
              ) : null}
            </div>
          );
        }) : <div className="c"><div className="t faint">אין היסטוריית שינויים להצגה</div></div>}
      </div>
      <DlgButtons>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>סגירה</DlgBtn>
      </DlgButtons>
    </>
  );
}
