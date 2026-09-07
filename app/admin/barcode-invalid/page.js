'use client';

import { useState, useEffect } from 'react';

export default function BarcodeInvalidPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/barcode-invalid', { cache: 'no-store' });
      const data = await res.json();
      if (data.disabled) setEnabled(false);
      setItems(data.items || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleDone = async (id) => {
    try {
      const res = await fetch('/api/barcode-invalid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) load();
    } catch {}
  };

  if (!enabled) {
    return (
      <div className="card card-pad">
        <h1>ברקודים לא תקינים</h1>
        <p className="hint">התכונה כבויה. הפעל בהגדרות → ברקודים → &quot;רשימת ברקודים לא תקינים&quot;.</p>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>ברקודים לא תקינים (26)</h1>
          <div className="page-desc">טופל = הועבר להנהלה וסומן. ברקוד שחזר לא תקין נשאר כאן עד סימון.</div>
        </div>
      </div>
      <div className="card card-pad">
        {loading ? (
          <div>טוען...</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><p>אין ברקודים לא תקינים</p></div>
        ) : (
          <table className="data">
            <thead><tr><th>הזמנה</th><th>לקוח</th><th>שמלה/ברקוד</th><th>סטטוס</th><th>פעולה</th></tr></thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} style={{ opacity: i.barcodeInvalidHandled ? 0.6 : 1 }}>
                  <td className="cell-primary">#{i.order?.orderId ?? '?'}</td>
                  <td>{i.order?.customer ? `${i.order.customer.firstName || ''} ${i.order.customer.lastName || ''}`.trim() : '?' } <span className="cell-muted" dir="ltr">{i.order?.customer?.phone1 || ''}</span></td>
                  <td>{i.barcode || i.description || i.sizeText || '?'} {i.barcodeInvalidHandled && <span className="badge badge-success">טופל</span>}</td>
                  <td>{i.barcodeInvalidHandled ? 'טופל' : 'ממתין'}</td>
                  <td>
                    {!i.barcodeInvalidHandled && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDone(i.id)}>סמן טופל</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
