'use client';

// החלוניות הקופצות של חלונית הצד "עוזר AI" (AIFloatingWidget) בעיצוב החדש הכהה של פלטת האתר: אותו #dlg / .scrim של הפלטה ואותם
// ConfirmDialog / MessageDialog / DialogFrame של אשף "הזמנה חדשה" (NoDialogs.js), במקום alert() של הדפדפן, customConfirm הישן
// והמודאל הלבן של הטבלה. השורש נושא gm-ds gm-no dlg-dark (כמו NewOrderA5) ונרנדר ב-portal לשורש הדף.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '@/design-system/components.css';
import '../new-order/css/new-order-font.css';
import '../new-order/css/new-order.css';
import './ai-dialogs.css';
import { ApprovalDialog, ConfirmDialog, DialogFrame, MessageDialog } from '../new-order/NoDialogs';
import { Ic } from '../new-order/NoUi';
import { MenuSprite } from '../menu/menuParts';

// הוק: { confirm(message, opts) -> Promise<boolean>, notify(message, opts) -> Promise<void>, approve(message, level), showTable(rows, { onNavigate, render }), host }
// host = ה-JSX של החלונית הפתוחה (להציב פעם אחת בסוף הרכיב).
export function useAiDialogs() {
  const [dlg, setDlg] = useState(null);
  const resolveRef = useRef(null);
  const close = useCallback((result) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    setDlg(null);
    if (r) r(result);
  }, []);
  const open = useCallback((spec) => new Promise((resolve) => {
    if (resolveRef.current) resolveRef.current(undefined);
    resolveRef.current = resolve;
    setDlg(spec);
  }), []);
  const confirm = useCallback((message, opts = {}) => open({ type: 'confirm', message, ...opts }).then((v) => !!v), [open]);
  const notify = useCallback((message, opts = {}) => open({ type: 'message', message, ...opts }), [open]);
  const showTable = useCallback((rows, opts = {}) => open({ type: 'table', rows, ...opts }), [open]);
  // אישור הרשאה (קוד + סיסמת מאשר, נבדק מול /api/auth/verify-pin בתוך החלון): מחזיר { pin, employeeId } או undefined בביטול
  const approve = useCallback((message, level) => open({ type: 'approval', message, level }), [open]);

  useEffect(() => {
    if (!dlg) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(dlg.type === 'confirm' ? false : undefined); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dlg, close]);

  let body = null;
  const wide = !!dlg && dlg.type === 'table';
  const onBackdrop = () => close(dlg && dlg.type === 'confirm' ? false : undefined);
  if (dlg) {
    if (dlg.type === 'confirm') body = <ConfirmDialog title={dlg.title || 'אישור פעולה'} message={dlg.message} ok={dlg.ok} cancel={dlg.cancel} close={close} />;
    else if (dlg.type === 'message') body = <MessageDialog title={dlg.title || 'הודעה'} message={dlg.message} close={close} />;
    else if (dlg.type === 'approval') body = <ApprovalDialog message={dlg.message} level={dlg.level} close={close} />;
    else if (dlg.type === 'table') body = <TableDialog rows={dlg.rows} render={dlg.render} onNavigate={dlg.onNavigate} close={close} />;
  }
  const host = dlg && typeof document !== 'undefined'
    ? createPortal(
      <div className="gm-ds gm-no dlg-dark ai-dlg-root" dir="rtl">
        <MenuSprite />
        <DialogFrame layer={2} cls={wide ? 'ai-wide' : ''} onBackdrop={onBackdrop}>{body}</DialogFrame>
      </div>,
      document.body
    )
    : null;
  return { confirm, notify, showTable, approve, host };
}

// טבלת הנתונים של העוזר ("הצג טבלה") בחלון כהה: כותרת, טבלת .rtbl של הפלטה, כפתור סגירה
function TableDialog({ rows, render, onNavigate, close }) {
  const keys = Object.keys(rows[0] || {}).filter((h) => !h.startsWith('_action'));
  const hasActions = rows.some((r) => r._actionUrl);
  const cell = render || ((v) => (v === null || v === undefined ? '' : String(v)));
  return (
    <>
      <h2><Ic n="table" />נתונים ({rows.length} שורות)</h2>
      <div className="ai-dlg-table">
        <table className="rtbl">
          <thead><tr>{keys.map((h) => <th key={h}>{h}</th>)}{hasActions ? <th>פעולות</th> : null}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {keys.map((h) => <td key={h}>{cell(row[h], h, row)}</td>)}
                {hasActions ? (
                  <td>{row._actionUrl && row._actionLabel ? (
                    <a href={row._actionUrl} className="btn sm" onClick={(e) => { close(); if (onNavigate) onNavigate(e, row._actionUrl); }}>{row._actionLabel}</a>
                  ) : null}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dbtns" style={{ marginTop: 18 }}>
        <button type="button" className="btn ghost block" onClick={() => close()}><Ic n="x" c="sm" />סגירה</button>
      </div>
    </>
  );
}
