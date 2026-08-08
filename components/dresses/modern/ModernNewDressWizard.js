'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import UploadZone from '../../../app/components/UploadZone';
import { getHebrewDateString } from '../../../lib/hebrewDate';

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return `${new Date(d).toLocaleDateString('he-IL')} (${getHebrewDateString(d)})`;
  } catch (e) {
    return new Date(d).toLocaleDateString('he-IL');
  }
};

const pad2 = (v) => String(v).padStart(2, '0');

const STEP_LABELS = (showImages) => ([
  { id: 1, label: 'זיהוי הדגם' },
  { id: 2, label: showImages ? 'תמונה והערות' : 'הערות והתראות' },
  { id: 3, label: 'מלאי ראשוני' },
  { id: 4, label: 'סיכום' }
]);

/**
 * אשף "הוספת דגם חדש" — אשף רב-שלבי (stepper) בשפת העיצוב "אריג".
 * צעד 3 מאפשר להזין את המלאי ההתחלתי לפי מידות; הדגם והפריטים נוצרים יחד
 * בסיום, במקום ליצור דגם ואז להוסיף פריטים אחד-אחד.
 */
export default function ModernNewDressWizard({
  useModelNames,
  showImages,
  categories,
  locations,
  onCancel,
  onCreated
}) {
  const [step, setStep] = useState(1);
  const [dress, setDress] = useState({
    name: '',
    barcodePrefix: '',
    priceCategory: '',
    notes: '',
    inInspection: false,
    imageUrl: '',
    entryDateToRepo: new Date().toISOString()
  });
  const [pendingItems, setPendingItems] = useState([]);
  const [newItem, setNewItem] = useState({ sizeText: '', serialNumber: '', location: '' });
  const [addError, setAddError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const fileRef = useRef(null);
  const nextKey = useRef(2);

  const STEPS = STEP_LABELS(showImages);

  // הקוד הפנוי הבא נטען מראש, כמו בכפתור "קוד אוטומטי" בכרטיס
  useEffect(() => {
    fetch('/api/dresses/next-code')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.nextCode) setDress(prev => ({ ...prev, barcodePrefix: String(data.nextCode) })); })
      .catch(err => console.error('Failed to fetch next code', err))
      .finally(() => setCodeLoading(false));
  }, []);

  useEffect(() => {
    if (locations?.length) {
      setNewItem(prev => (prev.location ? prev : { ...prev, location: locations[0] }));
    }
  }, [locations]);

  const patch = (p) => setDress(prev => ({ ...prev, ...p }));
  const flash = (msg, ms = 4000) => { setMessage(msg); setTimeout(() => setMessage(''), ms); };

  const codeStr = String(dress.barcodePrefix || '').trim();
  const codeOk = /^\d{3}$/.test(codeStr);
  const nameOk = !useModelNames || String(dress.name || '').trim() !== '';
  const catOk = String(dress.priceCategory || '').trim() !== '';
  const step1Ok = codeOk && nameOk && catOk;

  const canGoTo = (target) => {
    if (target <= 1) return true;
    return step1Ok;
  };

  const totalItems = pendingItems.length;

  const buildBarcode = (size, serial) => `${codeStr}${pad2(String(size).trim())}${pad2(serial)}`;

  // כל שורה שנוספה היא פריט אחד; הברקוד נגזר מקוד הדגם + מידה + מס' סידורי
  const plannedItems = pendingItems.map(p => ({
    sizeText: String(p.sizeText).trim(),
    serialNumber: Number(p.serialNumber),
    dressBarcode: buildBarcode(p.sizeText, p.serialNumber),
    location: p.location || (locations && locations[0]) || null
  }));

  // המס' הסידורי הבא לאותה מידה — ברירת מחדל בסדר עולה
  const nextSerialFor = (size) => {
    const same = pendingItems.filter(p => String(p.sizeText).trim() === String(size).trim());
    return same.length ? Math.max(...same.map(p => Number(p.serialNumber) || 0)) + 1 : 1;
  };

  const changeNewItem = (field, value) => {
    setAddError('');
    setNewItem(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'sizeText') {
        next.serialNumber = String(value).trim() === '' ? '' : String(nextSerialFor(value));
      }
      return next;
    });
  };

  const addPendingItem = () => {
    const size = String(newItem.sizeText).trim();
    if (!size) { setAddError('חובה להזין מידה'); return; }
    const sizeNum = Number(size);
    if (isNaN(sizeNum) || sizeNum < 0 || sizeNum > 99 || !Number.isInteger(sizeNum)) {
      setAddError('מידה חייבת להיות מספר שלם בין 0 ל-99');
      return;
    }
    const serial = Number(String(newItem.serialNumber).trim() || nextSerialFor(size));
    if (isNaN(serial) || serial < 1 || serial > 99 || !Number.isInteger(serial)) {
      setAddError("מס' סידורי חייב להיות מספר שלם בין 1 ל-99");
      return;
    }
    if (pendingItems.some(p => Number(p.sizeText) === sizeNum && Number(p.serialNumber) === serial)) {
      setAddError(`כבר נוסף פריט במידה ${sizeNum} עם מס' סידורי ${serial}`);
      return;
    }
    const entry = {
      key: nextKey.current++,
      sizeText: String(sizeNum),
      serialNumber: serial,
      location: newItem.location || (locations && locations[0]) || ''
    };
    const updated = [...pendingItems, entry];
    setPendingItems(updated);
    // המידה נשארת והמס' הסידורי מתקדם — כדי להוסיף כמה פריטים ברצף לאותה מידה
    const nextSer = Math.max(...updated
      .filter(p => String(p.sizeText).trim() === String(sizeNum))
      .map(p => Number(p.serialNumber) || 0)) + 1;
    setNewItem({ sizeText: String(sizeNum), serialNumber: String(nextSer), location: entry.location });
  };

  const removePendingItem = (key) => {
    setPendingItems(prev => prev.filter(p => p.key !== key));
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) patch({ imageUrl: data.imageUrl });
      else flash('שגיאה בהעלאת התמונה');
    } catch (err) {
      console.error(err);
      flash('שגיאה בתקשורת בהעלאת התמונה');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoCode = async () => {
    try {
      const res = await fetch('/api/dresses/next-code');
      const data = await res.json();
      if (res.ok) patch({ barcodePrefix: String(data.nextCode) });
      else flash(data.error || 'לא נמצא קוד פנוי');
    } catch (err) {
      console.error(err);
      flash('שגיאה בתקשורת');
    }
  };

  const handleCreate = async () => {
    if (saving) return;
    if (!step1Ok) { setStep(1); flash('חסרים פרטי זיהוי חובה'); return; }

    setSaving(true);
    setMessage('יוצר את הדגם...');
    try {
      const payload = { ...dress };
      if (!useModelNames && !payload.name) payload.name = `דגם ${payload.barcodePrefix || 'ללא קוד'}`;

      const res = await fetch('/api/dresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const created = await res.json();
      if (!res.ok) {
        setMessage('');
        flash(`שגיאה: ${created.error || 'יצירת הדגם נכשלה'}`, 6000);
        setStep(1);
        return;
      }

      // הפריטים נוצרים אחד-אחד; כישלון בפריט בודד לא מבטל את הדגם שכבר נוצר
      const failed = [];
      for (let i = 0; i < plannedItems.length; i++) {
        const it = plannedItems[i];
        setMessage(`יוצר פריטים... ${i + 1}/${plannedItems.length}`);
        try {
          const itemRes = await fetch(`/api/dresses/${created.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...it,
              barcodePrefix: created.barcodePrefix,
              dressName: created.name,
              entryDateToRepo: dress.entryDateToRepo || new Date().toISOString()
            })
          });
          if (!itemRes.ok) {
            const err = await itemRes.json().catch(() => null);
            failed.push(`${it.dressBarcode}: ${(err && err.error) || 'שגיאה'}`);
          }
        } catch (err) {
          failed.push(`${it.dressBarcode}: שגיאת תקשורת`);
        }
      }

      onCreated(created, failed);
    } catch (err) {
      console.error(err);
      setMessage('');
      flash('שגיאה בתקשורת עם השרת', 6000);
    } finally {
      setSaving(false);
    }
  };

  const imageSrc = dress.imageUrl || null;
  const isErrorMsg = message.includes('שגיאה');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>הוספת דגם חדש</h1>
          <div className="page-desc">גמ&quot;ח שמלות &raquo; <Link href="/dashboard/dresses">מאגר שמלות</Link> &raquo; הוספת דגם חדש</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
            <svg className="icon"><use href="#i-x" /></svg>ביטול וחזרה לקטלוג
          </button>
        </div>
      </div>

      <nav className="stepper" aria-label="שלבי הוספת הדגם" style={{ flexWrap: 'wrap' }}>
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.id}>
            <div
              className={`step${step > s.id ? ' done' : step === s.id ? ' current' : ''}`}
              role="button"
              tabIndex={canGoTo(s.id) ? 0 : -1}
              aria-disabled={!canGoTo(s.id)}
              style={{ cursor: canGoTo(s.id) && !saving ? 'pointer' : 'not-allowed', opacity: canGoTo(s.id) ? 1 : 0.6 }}
              onClick={() => { if (canGoTo(s.id) && !saving) setStep(s.id); }}
            >
              <span className="step-num">{step > s.id ? <svg className="icon"><use href="#i-check" /></svg> : s.id}</span>
              {s.label}
            </div>
            {idx < STEPS.length - 1 && <div className="step-line" />}
          </React.Fragment>
        ))}
      </nav>

      <div className="card card-pad">
        {message && (
          <div className={`callout ${isErrorMsg ? 'callout-danger' : 'callout-info'}`} style={{ marginBottom: '16px' }}>
            <svg className="icon"><use href={isErrorMsg ? '#i-alert-circle' : '#i-info'} /></svg>
            {message}
          </div>
        )}

        {/* ===== צעד 1 — זיהוי ===== */}
        {step === 1 && (
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <h2>זיהוי הדגם</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>הקוד מרכיב את ברקודי הפריטים ואינו ניתן לשינוי לאחר היצירה.</p>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="dress-new-code">קוד דגם (קידומת ברקוד) *</label>
                <input
                  id="dress-new-code"
                  className="input"
                  type="number"
                  value={dress.barcodePrefix}
                  placeholder={codeLoading ? 'טוען קוד פנוי...' : ''}
                  onChange={e => patch({ barcodePrefix: e.target.value })}
                />
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '6px', width: 'fit-content' }} onClick={handleAutoCode}>
                  <svg className="icon"><use href="#i-refresh" /></svg>קוד פנוי
                </button>
              </div>

              {useModelNames && (
                <div className="field">
                  <label htmlFor="dress-new-name">שם דגם *</label>
                  <input id="dress-new-name" className="input" type="text" value={dress.name} onChange={e => patch({ name: e.target.value })} placeholder="לדוגמה: רומנטיקה" autoFocus />
                </div>
              )}

              <div className="field">
                <label htmlFor="dress-new-category">קטגוריית מחיר *</label>
                <select id="dress-new-category" className="select" value={dress.priceCategory} onChange={e => patch({ priceCategory: e.target.value })}>
                  <option value="">-- בחר קטגוריית מחיר --</option>
                  {(categories || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor="dress-new-entrydate">תאריך כניסה למאגר</label>
                <HebrewDatePicker value={dress.entryDateToRepo} onChange={(date) => patch({ entryDateToRepo: date })} />
              </div>
            </div>

            {!step1Ok && (
              <p className="hint" style={{ display: 'block', marginTop: '14px' }}>
                <svg className="icon" style={{ verticalAlign: '-2px' }}><use href="#i-alert-tri" /></svg>{' '}
                יש להשלים {[
                  !codeOk && (codeStr ? 'קוד דגם בן 3 ספרות בדיוק' : 'קוד דגם'),
                  !nameOk && 'שם דגם',
                  !catOk && 'קטגוריית מחיר'
                ].filter(Boolean).join(', ')} כדי להמשיך.
              </p>
            )}
          </div>
        )}

        {/* ===== צעד 2 — תמונה והערות ===== */}
        {step === 2 && (
          <div className={showImages ? 'two-col' : undefined}>
            {showImages && (
              <div>
                <div className="field">
                  <label>תמונת הדגם</label>
                  {imageSrc ? (
                    <>
                      <div style={{
                        borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)',
                        background: 'var(--surface-alt)', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <img src={imageSrc} alt="תצוגה מקדימה" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '10px', width: 'fit-content' }} onClick={() => fileRef.current?.click()}>
                        <svg className="icon"><use href="#i-upload" /></svg>החלף תמונה
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
                      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '10px', width: 'fit-content' }} onClick={() => patch({ imageUrl: '' })}>
                        <svg className="icon"><use href="#i-trash" /></svg>הסר תמונה
                      </button>
                    </>
                  ) : (
                    <UploadZone
                      id="dress-new-image"
                      accept="image/*"
                      onFileSelect={handleImageUpload}
                      disabled={uploading}
                      label={uploading ? 'מעלה תמונה...' : 'אין תמונה — לחץ להעלאה'}
                      hint="PNG או JPG"
                    />
                  )}
                  <span className="hint">אפשר גם לדלג — המערכת תחפש אוטומטית קובץ בשם {dress.barcodePrefix || '####'}.jpg.</span>
                </div>
              </div>
            )}

            <div>
              <h3>הערות והתראות</h3>
              <p className="hint" style={{ margin: '-4px 0 12px' }}>מידע שיוצג לעובד בעת בחירת הדגם</p>

              <div className="field">
                <label htmlFor="dress-new-notes">הערות לדגם</label>
                <textarea
                  id="dress-new-notes"
                  className="textarea"
                  rows={4}
                  value={dress.notes}
                  onChange={e => patch({ notes: e.target.value })}
                  placeholder="לדוגמה: רכיסה אחורית — לשים לב בהחזרה"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginTop: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>הצג בבדיקה (התראה)</div>
                  <div className="hint" style={{ color: 'var(--text-3)' }}>הדגם יופיע בהתראות המלאי ותוצג אזהרה בבחירת פריט</div>
                </div>
                <div
                  className={`switch${dress.inInspection ? ' on' : ''}`}
                  role="switch"
                  aria-checked={!!dress.inInspection}
                  tabIndex={0}
                  onClick={() => patch({ inInspection: !dress.inInspection })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); patch({ inInspection: !dress.inInspection }); } }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== צעד 3 — מלאי ראשוני ===== */}
        {step === 3 && (
          <div>
            <h2>מלאי ראשוני</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>כל שורה היא פריט אחד — הברקוד נבנה אוטומטית מקוד הדגם, המידה והמס&apos; הסידורי</p>

            <div className="card card-pad" style={{ marginBottom: '16px' }}>
              <div className="form-grid cols-3">
                <div className="field">
                  <label htmlFor="dress-new-item-size">מידה *</label>
                  <input
                    id="dress-new-item-size"
                    className="input"
                    type="number" min="0" max="99" placeholder="38"
                    value={newItem.sizeText}
                    onChange={e => changeNewItem('sizeText', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPendingItem(); }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dress-new-item-serial">מס&apos; סידורי</label>
                  <input
                    id="dress-new-item-serial"
                    className="input"
                    type="number" min="1" max="99"
                    value={newItem.serialNumber}
                    onChange={e => changeNewItem('serialNumber', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPendingItem(); }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dress-new-item-loc">מיקום</label>
                  <select id="dress-new-item-loc" className="select" value={newItem.location} onChange={e => changeNewItem('location', e.target.value)}>
                    <option value="">-- בחר מיקום --</option>
                    {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className="chip" title="הברקוד נבנה אוטומטית מקוד הדגם + מידה + מס' סידורי">
                  ברקוד פריט: {String(newItem.sizeText).trim() ? buildBarcode(newItem.sizeText, Number(newItem.serialNumber) || nextSerialFor(newItem.sizeText)) : `${codeStr || '###'}____`}
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={addPendingItem}>
                  <svg className="icon"><use href="#i-plus" /></svg>הוסף פריט
                </button>
                {addError && <span className="error-text"><svg className="icon"><use href="#i-alert-circle" /></svg>{addError}</span>}
              </div>
            </div>

            {pendingItems.length === 0 ? (
              <div className="empty-state">
                <svg className="icon"><use href="#i-box" /></svg>
                <p>עדיין לא נוספו פריטים לדגם.</p>
              </div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr><th>מידה</th><th>מס&apos; סידורי</th><th>ברקוד</th><th>מיקום</th><th style={{ textAlign: 'center' }} /></tr>
                  </thead>
                  <tbody>
                    {plannedItems.map((it, idx) => (
                      <tr key={pendingItems[idx].key}>
                        <td className="cell-primary">{it.sizeText}</td>
                        <td>{pad2(it.serialNumber)}</td>
                        <td>{it.dressBarcode}</td>
                        <td>{it.location || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--danger)' }} title="הסר פריט" onClick={() => removePendingItem(pendingItems[idx].key)}>
                            <svg className="icon"><use href="#i-trash" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== צעד 4 — סיכום ===== */}
        {step === 4 && (
          <div>
            <h2>סיכום לפני יצירה</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>בדוק את הפרטים — אפשר לחזור לכל צעד מסרגל הצעדים</p>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div className="kpi-card">
                <div className="kpi-label">קוד דגם</div>
                <div className="kpi-value">{dress.barcodePrefix || '—'}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">מידות</div>
                <div className="kpi-value" style={{ color: 'var(--success)' }}>{new Set(pendingItems.map(p => String(p.sizeText).trim())).size}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">פריטים שייווצרו</div>
                <div className="kpi-value" style={{ color: 'var(--info)' }}>{totalItems}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '18px 0' }}>
              {useModelNames && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-tag" /></svg>
                  <span className="cell-muted" style={{ minWidth: '150px' }}>שם דגם</span>
                  <strong>{dress.name || 'לא הוזן'}</strong>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-tag" /></svg>
                <span className="cell-muted" style={{ minWidth: '150px' }}>קטגוריית מחיר</span>
                <strong>{dress.priceCategory || 'לא נבחרה'}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-calendar" /></svg>
                <span className="cell-muted" style={{ minWidth: '150px' }}>תאריך כניסה</span>
                <strong>{fmtDate(dress.entryDateToRepo) || 'לא נבחר'}</strong>
              </div>
              {showImages && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-image" /></svg>
                  <span className="cell-muted" style={{ minWidth: '150px' }}>תמונה</span>
                  <strong>{dress.imageUrl ? 'הועלתה' : `תיטען אוטומטית לפי הקוד (${dress.barcodePrefix || '####'}.jpg)`}</strong>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-alert-tri" /></svg>
                <span className="cell-muted" style={{ minWidth: '150px' }}>הצג בבדיקה</span>
                <strong>{dress.inInspection ? 'מופעל' : 'כבוי'}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0' }}>
                <svg className="icon" style={{ color: 'var(--text-3)', marginTop: '3px' }}><use href="#i-file" /></svg>
                <span className="cell-muted" style={{ minWidth: '150px' }}>הערות</span>
                <strong style={{ whiteSpace: 'pre-wrap' }}>{dress.notes || 'אין'}</strong>
              </div>
            </div>

            {totalItems > 0 ? (
              <>
                <h3>הפריטים שייווצרו</h3>
                <div className="table-wrap" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  <table className="data">
                    <thead><tr><th>מידה</th><th>מס&apos; סידורי</th><th>ברקוד</th><th>מיקום</th></tr></thead>
                    <tbody>
                      {plannedItems.map((it, idx) => (
                        <tr key={idx}>
                          <td className="cell-primary">{it.sizeText}</td>
                          <td>{pad2(it.serialNumber)}</td>
                          <td>{it.dressBarcode}</td>
                          <td>{it.location || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="callout callout-warning" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <svg className="icon"><use href="#i-alert-tri" /></svg>
                  <div>
                    <div style={{ fontWeight: 700 }}>הדגם ייווצר ללא פריטים</div>
                    <div style={{ fontSize: '11.5px', marginTop: '2px' }}>דגם ללא פריטים פעילים לא יופיע כזמין בהזמנה חדשה. אפשר להוסיף פריטים מיד לאחר היצירה.</div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(3)}>הוסף מלאי</button>
              </div>
            )}
          </div>
        )}

        {/* ===== ניווט ===== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => (step === 1 ? onCancel() : setStep(step - 1))} disabled={saving}>
            <svg className="icon"><use href="#i-chevron-end" /></svg>{step === 1 ? 'ביטול' : 'הקודם'}
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={!canGoTo(step + 1) || saving}
              title={!canGoTo(step + 1) ? 'יש להשלים את פרטי הזיהוי' : ''}
            >
              הבא<svg className="icon"><use href="#i-chevron-start" /></svg>
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? <><span className="spinner" />יוצר...</> : <><svg className="icon"><use href="#i-check" /></svg>צור דגם{totalItems > 0 ? ` ו-${totalItems} פריטים` : ''}</>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
