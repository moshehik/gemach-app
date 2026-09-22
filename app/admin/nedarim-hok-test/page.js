'use client';

import { useEffect, useState } from 'react';

// דף ניסוי ייעודי ליצירת הוק (הוראת קבע) בנדרים פלוס, ללא חיבור לתהליך
// ההזמנה/תשלום האמיתי. הפעולה כאן שולחת בקשה אמיתית ל-API הציבורי של נדרים
// פלוס (DebitKeva.aspx) - היא יוצרת הוק אמיתי אצל המוסד שקוד המוסד שלו הוקלד,
// גם אם הסכום סמלי. אין כאן "מצב בדיקה" בצד נדרים פלוס עצמו.
//
// שאלה פתוחה (טרם הוחלט, ר' CLAUDE.md "הוק בנדרים פלוס"): האם ההוק ייווצר
// בפועל בזמן תשלום ההזמנה או בזמן היציאה להשכרה בפועל, ואיך זה ישתלב בתהליך
// הרגיל. עד להחלטה - זהו דף עצמאי לניסוי בלבד.

function todayPlusYears(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABEL = { success: 'הצליח', error: 'נכשל' };
const STATUS_CLASS = { success: 'badge badge-success', error: 'badge badge-danger' };

export default function NedarimHokTestPage() {
  const [form, setForm] = useState({
    clientName: '', phone: '', address: '', zeout: '', email: '',
    cardNumber: '', tokef: '', cvv: '',
    amount: '1', chargeDate: todayPlusYears(1), dayOfMonth: '', installments: '1',
    mosadId: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { success, confirmation, error, record }
  const [history, setHistory] = useState([]);
  const [loadError, setLoadError] = useState('');

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/admin/nedarim-hok', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת ההיסטוריה');
      setHistory(data.records || []);
    } catch (e) {
      setLoadError(e.message);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm('פעולה זו שולחת בקשה אמיתית לנדרים פלוס ויוצרת הוק אמיתי (לא סימולציה). להמשיך?')) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/nedarim-hok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResult(data);
      await loadHistory();
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>ניסוי - יצירת הוק בנדרים פלוס</h1>
          <div className="page-desc">יצירת הוראת קבע (הו&quot;ק) אצל נדרים פלוס, בדרך כלל בסכום סמלי ולתאריך עתידי - כדי שבמקרה של אי-החזרת פריט אפשר יהיה לערוך את פרטי ההוק בממשק הניהול של נדרים פלוס ולגבות בפועל.</div>
        </div>
      </div>

      <div className="callout callout-danger" style={{ marginBottom: 16 }}>
        <strong>שים לב:</strong> זהו דף ניסוי עצמאי, לא מחובר לתהליך ההזמנה/תשלום האמיתי. הפעולה שולחת בקשה אמיתית ל-API של נדרים פלוס מול קוד המוסד שתקליד - היא יוצרת הוק אמיתי, לא סימולציה. אין כאן מנגנון עריכה/ביטול - שינוי ההוק לאחר יצירתו נעשה ידנית בממשק הניהול של נדרים פלוס (reports.matara.pro).
      </div>

      <form onSubmit={submit} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="mosadId">קוד מוסד (Mosad)</label>
          <input id="mosadId" dir="ltr" className="input" value={form.mosadId} onChange={set('mosadId')} placeholder="ריק = לפי הגדרות המערכת (nedarim_plus_terminal)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="clientName">שם הלקוח</label>
            <input id="clientName" className="input" value={form.clientName} onChange={set('clientName')} />
          </div>
          <div className="field">
            <label htmlFor="phone">טלפון</label>
            <input id="phone" dir="ltr" className="input" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="field">
            <label htmlFor="zeout">ת.ז</label>
            <input id="zeout" dir="ltr" className="input" value={form.zeout} onChange={set('zeout')} />
          </div>
          <div className="field">
            <label htmlFor="address">כתובת</label>
            <input id="address" className="input" value={form.address} onChange={set('address')} />
          </div>
        </div>

        <hr />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="cardNumber">מספר כרטיס אשראי</label>
            <input id="cardNumber" dir="ltr" className="input" value={form.cardNumber} onChange={set('cardNumber')} required />
          </div>
          <div className="field">
            <label htmlFor="tokef">תוקף (MMYY)</label>
            <input id="tokef" dir="ltr" className="input" value={form.tokef} onChange={set('tokef')} placeholder="1229" required />
          </div>
          <div className="field">
            <label htmlFor="cvv">CVV</label>
            <input id="cvv" dir="ltr" className="input" value={form.cvv} onChange={set('cvv')} />
          </div>
        </div>

        <hr />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="amount">סכום ההוק (₪)</label>
            <input id="amount" type="number" step="0.01" dir="ltr" className="input" value={form.amount} onChange={set('amount')} />
          </div>
          <div className="field">
            <label htmlFor="chargeDate">תאריך חיוב עתידי</label>
            <input id="chargeDate" type="date" dir="ltr" className="input" value={form.chargeDate} onChange={set('chargeDate')} required />
          </div>
          <div className="field">
            <label htmlFor="installments">מס&apos; תשלומים</label>
            <input id="installments" type="number" min="1" dir="ltr" className="input" value={form.installments} onChange={set('installments')} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">הערות (Avour)</label>
          <input id="notes" className="input" value={form.notes} onChange={set('notes')} placeholder="לדוגמה: מס' הזמנה, סיבת ההוק" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'יוצר הוק...' : 'צור הוק בנדרים פלוס'}
        </button>
      </form>

      {result && (
        <div className={`callout ${result.success ? 'callout-success' : 'callout-danger'}`} style={{ marginTop: 16, maxWidth: 640 }}>
          {result.success
            ? <>ההוק נוצר בהצלחה. מס&apos; אישור: <strong dir="ltr">{result.confirmation}</strong></>
            : <>יצירת ההוק נכשלה: {result.error}</>}
        </div>
      )}

      {result?.success && (
        <div className="callout callout-warning" style={{ marginTop: 8, maxWidth: 640 }}>
          <strong>מוסד שזוהה אצל נדרים פלוס:</strong> {result.institutionName || '(לא הוחזר שם מוסד בתגובה)'}
          <br />ודא שזה שם הגמח שלך - אם זה שם אחר, ההוק נוצר בטעות בחשבון נדרים פלוס של מוסד אחר.
        </div>
      )}

      {loadError && <div className="callout callout-danger" style={{ marginTop: 16 }}>{loadError}</div>}

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>היסטוריית ניסיונות (50 אחרונים)</h3>
        <table className="data">
          <thead>
            <tr>
              <th>תאריך יצירה</th>
              <th>שם</th>
              <th>4 ספרות אחרונות</th>
              <th>סכום</th>
              <th>תאריך חיוב</th>
              <th>קוד מוסד</th>
              <th>מוסד שזוהה</th>
              <th>סטטוס</th>
              <th>אישור / שגיאה</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString('he-IL')}</td>
                <td>{r.clientName}</td>
                <td dir="ltr">{r.cardLast4}</td>
                <td>{r.amount}</td>
                <td>{new Date(r.chargeDate).toLocaleDateString('he-IL')}</td>
                <td dir="ltr">{r.mosadId}</td>
                <td>{r.institutionName}</td>
                <td><span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td>{r.confirmation || r.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <div className="hint">אין עדיין ניסיונות.</div>}
      </div>
    </div>
  );
}
