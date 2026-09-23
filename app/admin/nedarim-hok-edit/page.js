'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import NedarimNav from '@/app/admin/_nedarim/NedarimNav';

// עריכת הוראת קבע (הו"ק) קיימת בנדרים פלוס - Action=UpdateKevaNew ב-Manage3 API.
// זו בדיוק הפעולה שהייתה חסרה כשהתחלנו את הפיצ'ר הזה (חשבנו שאין API לעריכה -
// היא כן קיימת, רק בתיעוד המורחב שדורש מפתח API של המוסד). עדכון חלקי: רק שדות
// שנשלחים בפועל מתעדכנים - לכן טופס זה תמיד שולח את כל השדות שנטענו (גם אם
// המשתמש לא נגע בהם), כדי לא למחוק בטעות ערך קיים.
//
// בנוסף: "גביית תשלום בודד" (Action=TashlumBodedNew) - זו הדרך לגבות בפועל על
// הוק קיים, בלי לשנות את ההוראה עצמה. זו הסיבה המקורית לכל הפיצ'ר: ליצור הוק
// סמלי בזמן ההזמנה, ובמקרה של אי-החזרה - לערוך את הסכום כאן ו/או לגבות ישירות.

// GetKevaId מחזיר KevaNextDate בפורמט dd/MM/yy (שנה בשתי ספרות), אבל UpdateKevaNew
// דורש NextDate בפורמט dd/MM/yyyy (שנה מלאה) - בלי ההמרה, שליחה חוזרת של הערך
// שנטען כמו שהוא (בלי לגעת בשדה) הייתה שולחת שנה שגויה (למשל "27" כפשוטו).
function expandTwoDigitYear(d) {
  if (!d) return '';
  const m = d.match(/^(\d{2}\/\d{2})\/(\d{2})$/);
  return m ? `${m[1]}/20${m[2]}` : d;
}

function EditForm() {
  const searchParams = useSearchParams();
  const initialKevaId = searchParams.get('kevaId') || '';

  const [kevaId, setKevaId] = useState(initialKevaId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveResult, setSaveResult] = useState(null);
  const [chargeResult, setChargeResult] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(null);
  const [chargeForm, setChargeForm] = useState({ amount: '', installments: '1', comments: '' });

  const load = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setDetails(null);
    setSaveResult(null);
    try {
      const res = await fetch('/api/admin/nedarim-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'details', kevaId: id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'שגיאה בטעינה');
      if (!result.data || !result.data.KevaId) throw new Error('הוראת קבע לא נמצאה');
      setDetails(result.data);
      setForm({
        ClientName: result.data.KevaName || '',
        Zeout: result.data.KevaZeout || '',
        Adresse: result.data.KevaAdresse || '',
        City: result.data.KevaCity || '',
        Phone: result.data.KevaPhone || '',
        Mail: result.data.KevaMail || '',
        Amount: result.data.KevaAmount || '',
        Tashlumim: result.data.KevaTashlumim || '',
        Groupe: result.data.KevaGroupe || '',
        Avour: result.data.KevaAvour || '',
        NextDate: expandTwoDigitYear(result.data.KevaNextDate),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (initialKevaId) load(initialKevaId); }, [initialKevaId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaveResult(null);
    try {
      const res = await fetch('/api/admin/nedarim-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', kevaId, fields: form }),
      });
      const result = await res.json();
      const ok = res.ok && result.success && result.data?.Result === 'OK';
      setSaveResult({ ok, message: ok ? 'ההוראה עודכנה בהצלחה' : (result.data?.Message || result.error || 'שגיאה בעדכון') });
      if (ok) load(kevaId);
    } catch (e2) {
      setSaveResult({ ok: false, message: e2.message });
    }
  };

  const chargeSingle = async (e) => {
    e.preventDefault();
    if (!window.confirm(`לגבות ${chargeForm.amount} ₪ בפועל מהכרטיס השמור בהוראה זו עכשיו?`)) return;
    setChargeResult(null);
    try {
      const res = await fetch('/api/admin/nedarim-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chargeSingle',
          kevaId,
          amount: chargeForm.amount,
          installments: chargeForm.installments,
          comments: chargeForm.comments,
          ajaxId: String(Date.now()),
        }),
      });
      const result = await res.json();
      const ok = res.ok && result.success && result.data?.Status === 'OK';
      setChargeResult({
        ok,
        message: ok
          ? `החיוב בוצע בהצלחה. מס' אישור: ${result.data.Confirmation || result.data.TransactionId}`
          : (result.data?.Message || result.error || 'שגיאה בחיוב'),
      });
    } catch (e2) {
      setChargeResult({ ok: false, message: e2.message });
    }
  };

  const runLifecycleAction = async (action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setActionResult(null);
    try {
      const res = await fetch('/api/admin/nedarim-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, kevaId }),
      });
      const result = await res.json();
      const ok = res.ok && result.success && (result.data ? (result.data.Result === 'OK' || result.data.NextDate) : /^OK/i.test((result.raw || '').trim()));
      setActionResult({ ok, message: ok ? 'בוצע בהצלחה' : (result.data?.Message || result.raw || result.error || 'שגיאה') });
      if (ok) load(kevaId);
    } catch (e2) {
      setActionResult({ ok: false, message: e2.message });
    }
  };

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>שינוי הו&quot;ק</h1>
          <div className="page-desc">עריכת פרטי הוראת קבע קיימת בנדרים פלוס, וגביית תשלום בודד מהכרטיס השמור</div>
        </div>
      </div>

      <NedarimNav current="/admin/nedarim-hok-edit" />

      <div className="card card-pad" style={{ display: 'flex', gap: 8, maxWidth: 640, marginBottom: 16 }}>
        <input className="input" dir="ltr" value={kevaId} onChange={(e) => setKevaId(e.target.value)} placeholder="מספר הוק (KevaId)" style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" disabled={loading || !kevaId} onClick={() => load(kevaId)}>
          {loading ? 'טוען...' : 'טען'}
        </button>
      </div>

      {error && <div className="callout callout-danger" style={{ maxWidth: 640, marginBottom: 16 }}>{error}</div>}

      {form && (
        <>
          <form onSubmit={save} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>פרטי ההוראה</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>שם</label><input className="input" value={form.ClientName} onChange={set('ClientName')} /></div>
              <div className="field"><label>ת.ז</label><input className="input" dir="ltr" value={form.Zeout} onChange={set('Zeout')} /></div>
              <div className="field"><label>כתובת</label><input className="input" value={form.Adresse} onChange={set('Adresse')} /></div>
              <div className="field"><label>עיר</label><input className="input" value={form.City} onChange={set('City')} /></div>
              <div className="field"><label>טלפון</label><input className="input" dir="ltr" value={form.Phone} onChange={set('Phone')} /></div>
              <div className="field"><label>מייל</label><input className="input" dir="ltr" value={form.Mail} onChange={set('Mail')} /></div>
              <div className="field"><label>סכום חודשי (₪)</label><input className="input" dir="ltr" type="number" step="0.01" value={form.Amount} onChange={set('Amount')} /></div>
              <div className="field"><label>יתרת חיובים</label><input className="input" dir="ltr" type="number" value={form.Tashlumim} onChange={set('Tashlumim')} /></div>
              <div className="field"><label>תאריך חיוב הבא (dd/MM/yyyy)</label><input className="input" dir="ltr" value={form.NextDate} onChange={set('NextDate')} placeholder="dd/MM/yyyy" /></div>
              <div className="field"><label>קטגוריה</label><input className="input" value={form.Groupe} onChange={set('Groupe')} /></div>
            </div>
            <div className="field"><label>הערה</label><input className="input" value={form.Avour} onChange={set('Avour')} /></div>
            <div className="hint">שינוי כרטיס אשראי (מספר מלא/טוקן) לא נתמך בדף זה - ר&apos;אה &quot;קישור לעדכון כרטיס ע&quot;י התורם&quot; בתיעוד לשליחת קישור לתורם שיזין בעצמו.</div>
            <button type="submit" className="btn btn-primary">שמור שינויים</button>
            {saveResult && (
              <div className={`callout ${saveResult.ok ? 'callout-success' : 'callout-danger'}`}>{saveResult.message}</div>
            )}
          </form>

          <div className="card card-pad" style={{ maxWidth: 640, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>סטטוס ופעולות מחזור חיים</h3>
            <div>סטטוס נוכחי: <strong>{{ '1': 'פעילה', '2': 'מוקפאת', '3': 'נמחקה' }[String(details?.KevaStatus)] || details?.KevaStatus}</strong></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => runLifecycleAction('disable', 'להקפיא את ההוראה? (ניתן להפעיל מחדש בכל עת)')}>הקפא</button>
              <button type="button" className="btn" onClick={() => runLifecycleAction('enable')}>הפעל מחדש</button>
              <button type="button" className="btn btn-danger" onClick={() => runLifecycleAction('delete', 'למחוק את ההוראה לצמיתות? לא ניתן לשחזר דרך דף זה.')}>מחק לצמיתות</button>
            </div>
            {actionResult && (
              <div className={`callout ${actionResult.ok ? 'callout-success' : 'callout-danger'}`} style={{ marginTop: 12 }}>{actionResult.message}</div>
            )}
          </div>

          <form onSubmit={chargeSingle} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
            <h3 style={{ marginTop: 0 }}>גביית תשלום בודד עכשיו</h3>
            <div className="hint">חיוב מיידי מהכרטיס השמור בהוראה, בלי לשנות את ההוראה עצמה (הסכום החודשי ויתרת התשלומים נשארים כפי שהם). זו הדרך לגבות בפועל על הוק שנוצר בעבר.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>סכום לחיוב (₪)</label><input className="input" dir="ltr" type="number" step="0.01" value={chargeForm.amount} onChange={(e) => setChargeForm((f) => ({ ...f, amount: e.target.value }))} required /></div>
              <div className="field"><label>מס&apos; תשלומים</label><input className="input" dir="ltr" type="number" min="1" value={chargeForm.installments} onChange={(e) => setChargeForm((f) => ({ ...f, installments: e.target.value }))} /></div>
            </div>
            <div className="field"><label>הערה</label><input className="input" value={chargeForm.comments} onChange={(e) => setChargeForm((f) => ({ ...f, comments: e.target.value }))} /></div>
            <button type="submit" className="btn btn-primary">בצע גביה עכשיו</button>
            {chargeResult && (
              <div className={`callout ${chargeResult.ok ? 'callout-success' : 'callout-danger'}`}>{chargeResult.message}</div>
            )}
          </form>
        </>
      )}
    </div>
  );
}

export default function NedarimHokEditPage() {
  return (
    <Suspense fallback={<div style={{ direction: 'rtl' }}>טוען...</div>}>
      <EditForm />
    </Suspense>
  );
}
