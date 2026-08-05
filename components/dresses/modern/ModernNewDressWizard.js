'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X, ArrowRight, ArrowLeft, Check, Shirt, Tag, Calendar, FileText, AlertTriangle,
  Image as ImageIcon, Trash2, RefreshCw, Package, Save, Sparkles
} from 'lucide-react';
import HebrewDatePicker from '../../HebrewDatePicker';
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

/**
 * אשף "הוספת דגם חדש" — מבנה הצעדים של /orders/new (סרגל צעדים, כרטיס לכל צעד,
 * ניווט קדימה/אחורה) בשפת העיצוב של כרטיס הדגם (‎.moc).
 *
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

  const STEPS = [
    { id: 1, label: 'זיהוי הדגם' },
    { id: 2, label: showImages ? 'תמונה והערות' : 'הערות והתראות' },
    { id: 3, label: 'מלאי ראשוני' },
    { id: 4, label: 'סיכום' }
  ];

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
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
      e.target.value = '';
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

  return (
    <div className="moc moc-page-overlay">
      <div className="moc-page-wrap moc-wizard">
        <div className="moc-top-strip">
          <div className="moc-breadcrumb">
            גמ"ח שמלות &raquo; <Link href="/dashboard/dresses">מאגר שמלות</Link> &raquo; <strong>הוספת דגם חדש</strong>
          </div>
          <button className="moc-btn moc-btn-outline moc-btn-sm" onClick={onCancel} disabled={saving}>
            <X size={14} /> ביטול וחזרה לקטלוג
          </button>
        </div>

        {/* ===== סרגל הצעדים ===== */}
        <div className="moc-stepper" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
          {STEPS.map(s => (
            <button
              key={s.id}
              className={`moc-step-item ${step === s.id ? 'active' : ''} ${step >= s.id ? 'reached' : ''}`}
              disabled={!canGoTo(s.id) || saving}
              onClick={() => { if (canGoTo(s.id)) setStep(s.id); }}
            >
              <span className="moc-step-node">{step > s.id ? <Check size={16} /> : s.id}</span>
              <span className="moc-step-label">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="moc-card-panel moc-detail-card moc-step-card" style={{ background: 'var(--moc-card-bg)' }}>
          {message && (
            <div className={`moc-save-msg ${message.includes('שגיאה') ? 'err' : 'ok'}`} style={{ display: 'block', marginBottom: '14px', maxWidth: 'none' }}>
              {message}
            </div>
          )}

          {/* ===== צעד 1 — זיהוי ===== */}
          {step === 1 && (
            <div className="moc-step-inner">
              <div className="moc-panel-head">
                <div className="moc-title-row">
                  <div className="moc-avatar-chip lg"><Shirt size={19} /></div>
                  <div>
                    <span className="moc-lbl">זיהוי הדגם</span>
                    <div className="moc-sub-lbl">הקוד מרכיב את ברקודי הפריטים ואינו ניתן לשינוי לאחר היצירה</div>
                  </div>
                </div>
              </div>

              <div className="moc-grid-2" style={{ gap: '14px' }}>
                <div>
                  <span className="moc-field-label">קוד דגם (קידומת ברקוד) *</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={dress.barcodePrefix}
                      placeholder={codeLoading ? 'טוען קוד פנוי...' : ''}
                      onChange={e => patch({ barcodePrefix: e.target.value })}
                    />
                    <button className="moc-btn moc-btn-outline moc-btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleAutoCode}>
                      <RefreshCw size={13} /> קוד פנוי
                    </button>
                  </div>
                </div>

                {useModelNames && (
                  <div>
                    <span className="moc-field-label">שם דגם *</span>
                    <input type="text" value={dress.name} onChange={e => patch({ name: e.target.value })} placeholder="לדוגמה: רומנטיקה" autoFocus />
                  </div>
                )}

                <div>
                  <span className="moc-field-label">קטגוריית מחיר *</span>
                  <select value={dress.priceCategory} onChange={e => patch({ priceCategory: e.target.value })}>
                    <option value="">-- בחר קטגוריית מחיר --</option>
                    {(categories || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div>
                  <span className="moc-field-label">תאריך כניסה למאגר</span>
                  <HebrewDatePicker value={dress.entryDateToRepo} onChange={(date) => patch({ entryDateToRepo: date })} />
                </div>
              </div>

              {!step1Ok && (
                <p className="moc-hint" style={{ display: 'block', marginTop: '14px' }}>
                  <AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> יש להשלים {[
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
            <div className={showImages ? 'moc-grid-detail' : 'moc-step-inner'}>
              {showImages && (
                <div>
                  <span className="moc-field-label">תמונת הדגם</span>
                  <button
                    className="moc-image-frame"
                    style={{ cursor: 'pointer', padding: 0, width: '100%' }}
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {imageSrc ? (
                      <img src={imageSrc} alt="תצוגה מקדימה" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : uploading ? (
                      <><span className="moc-spinner lg" /><span style={{ fontSize: '0.86rem', fontWeight: 600 }}>מעלה תמונה...</span></>
                    ) : (
                      <><ImageIcon size={34} /><span style={{ fontSize: '0.86rem', fontWeight: 600 }}>לחץ לבחירת תמונה</span></>
                    )}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

                  {dress.imageUrl && (
                    <button className="moc-btn moc-btn-outline moc-btn-sm" style={{ marginTop: '10px' }} onClick={() => patch({ imageUrl: '' })}>
                      <Trash2 size={13} /> הסר תמונה
                    </button>
                  )}
                  <p style={{ margin: '10px 0 0', fontSize: '0.76rem', color: 'var(--moc-text-muted)', lineHeight: 1.6 }}>
                    אפשר גם לדלג — המערכת תחפש אוטומטית קובץ בשם {dress.barcodePrefix || '####'}.jpg.
                  </p>
                </div>
              )}

              <div>
                <div className="moc-panel-head">
                  <div className="moc-title-row">
                    <div className="moc-avatar-chip"><FileText size={17} /></div>
                    <div>
                      <span className="moc-lbl">הערות והתראות</span>
                      <div className="moc-sub-lbl">מידע שיוצג לעובד בעת בחירת הדגם</div>
                    </div>
                  </div>
                </div>

                <span className="moc-field-label">הערות לדגם</span>
                <textarea
                  rows={4}
                  value={dress.notes}
                  onChange={e => patch({ notes: e.target.value })}
                  placeholder="לדוגמה: רכיסה אחורית — לשים לב בהחזרה"
                />

                <div className="moc-compact-row" style={{ marginTop: '10px' }}>
                  <div className="moc-avatar-chip"><AlertTriangle size={17} /></div>
                  <div className="moc-cr-main">
                    <div className="moc-cr-title">הצג בבדיקה (התראה)</div>
                    <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
                      הדגם יופיע בהתראות המלאי ותוצג אזהרה בבחירת פריט
                    </div>
                  </div>
                  <div className="moc-cr-actions">
                    <button
                      className={`moc-pill-toggle ${dress.inInspection ? 'on orange' : ''}`}
                      onClick={() => patch({ inInspection: !dress.inInspection })}
                    >
                      {dress.inInspection ? <><Check size={13} /> מופעל</> : 'כבוי'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== צעד 3 — מלאי ראשוני ===== */}
          {step === 3 && (
            <div className="moc-step-inner">
              <div className="moc-panel-head">
                <div className="moc-title-row">
                  <div className="moc-avatar-chip lg"><Package size={19} /></div>
                  <div>
                    <span className="moc-lbl">מלאי ראשוני</span>
                    <div className="moc-sub-lbl">כל שורה היא פריט אחד — הברקוד נבנה אוטומטית מקוד הדגם, המידה והמס' הסידורי</div>
                  </div>
                </div>
              </div>

              {/* סרגל הוספה — אותה שיטה כמו בטאב "פריטים ומלאי" בכרטיס */}
              <div className="moc-add-bar">
                <div className="moc-fld w-sm">
                  <span className="moc-field-label">מידה *</span>
                  <input
                    type="number" min="0" max="99" placeholder="38"
                    value={newItem.sizeText}
                    onChange={e => changeNewItem('sizeText', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPendingItem(); }}
                  />
                </div>
                <div className="moc-fld w-sm">
                  <span className="moc-field-label">מס' סידורי</span>
                  <input
                    type="number" min="1" max="99"
                    value={newItem.serialNumber}
                    onChange={e => changeNewItem('serialNumber', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPendingItem(); }}
                  />
                </div>
                <div className="moc-fld w-md">
                  <span className="moc-field-label">ברקוד פריט</span>
                  <input
                    type="text"
                    className="moc-mono"
                    placeholder={`${codeStr || '###'}____`}
                    value={String(newItem.sizeText).trim() ? buildBarcode(newItem.sizeText, Number(newItem.serialNumber) || nextSerialFor(newItem.sizeText)) : ''}
                    readOnly
                    title="הברקוד נבנה אוטומטית מקוד הדגם + מידה + מס' סידורי"
                    style={{ background: '#f6f5f1', color: '#8b8b8b', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="moc-fld w-md">
                  <span className="moc-field-label">מיקום</span>
                  <select value={newItem.location} onChange={e => changeNewItem('location', e.target.value)}>
                    <option value="">-- בחר מיקום --</option>
                    {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                  </select>
                </div>
                <button className="moc-btn moc-btn-gold" onClick={addPendingItem}>
                  <Save size={15} /> הוסף פריט
                </button>
                <div className="moc-add-hint">
                  {addError
                    ? <span style={{ color: 'var(--moc-danger-text)', fontWeight: 700 }}>{addError}</span>
                    : <>המס' הסידורי מוצע אוטומטית בסדר עולה לכל מידה — אפשר לשנות אותו לפני ההוספה.</>}
                </div>
              </div>

              {pendingItems.length === 0 ? (
                <div className="moc-empty-state">
                  <Package size={30} />
                  <div style={{ marginTop: '8px' }}>עדיין לא נוספו פריטים לדגם.</div>
                </div>
              ) : (
                <div className="moc-table-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="moc-data-table">
                    <thead>
                      <tr><th>מידה</th><th>מס' סידורי</th><th>ברקוד</th><th>מיקום</th><th style={{ textAlign: 'center' }}>הסרה</th></tr>
                    </thead>
                    <tbody>
                      {plannedItems.map((it, idx) => (
                        <tr key={pendingItems[idx].key}>
                          <td><span className="moc-size-pill">{it.sizeText}</span></td>
                          <td className="moc-mono">{pad2(it.serialNumber)}</td>
                          <td className="moc-mono">{it.dressBarcode}</td>
                          <td>{it.location || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="moc-icon-btn-plain row-delete" title="הסר פריט"
                              onClick={() => removePendingItem(pendingItems[idx].key)}>
                              <Trash2 size={16} />
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
            <div className="moc-step-inner">
              <div className="moc-panel-head">
                <div className="moc-title-row">
                  <div className="moc-avatar-chip lg"><Sparkles size={19} /></div>
                  <div>
                    <span className="moc-lbl">סיכום לפני יצירה</span>
                    <div className="moc-sub-lbl">בדוק את הפרטים — אפשר לחזור לכל צעד מסרגל הצעדים</div>
                  </div>
                </div>
              </div>

              <div className="moc-stat-tiles">
                <div className="moc-stat-tile total">
                  <div className="moc-st-label">קוד דגם</div>
                  <div className="moc-st-value">{dress.barcodePrefix || '—'}</div>
                </div>
                <div className="moc-stat-tile ok">
                  <div className="moc-st-label">מידות</div>
                  <div className="moc-st-value">{new Set(pendingItems.map(p => String(p.sizeText).trim())).size}</div>
                </div>
                <div className="moc-stat-tile info">
                  <div className="moc-st-label">פריטים שייווצרו</div>
                  <div className="moc-st-value">{totalItems}</div>
                </div>
              </div>

              <div className="moc-summary-list">
                {useModelNames && (
                  <div className="moc-summary-row">
                    <Shirt size={15} style={{ color: 'var(--moc-text-muted)' }} />
                    <span className="moc-sr-label">שם דגם</span>
                    <span className={`moc-sr-value ${dress.name ? '' : 'empty'}`}>{dress.name || 'לא הוזן'}</span>
                  </div>
                )}
                <div className="moc-summary-row">
                  <Tag size={15} style={{ color: 'var(--moc-text-muted)' }} />
                  <span className="moc-sr-label">קטגוריית מחיר</span>
                  <span className={`moc-sr-value ${dress.priceCategory ? '' : 'empty'}`}>{dress.priceCategory || 'לא נבחרה'}</span>
                </div>
                <div className="moc-summary-row">
                  <Calendar size={15} style={{ color: 'var(--moc-text-muted)' }} />
                  <span className="moc-sr-label">תאריך כניסה</span>
                  <span className={`moc-sr-value ${dress.entryDateToRepo ? '' : 'empty'}`}>{fmtDate(dress.entryDateToRepo) || 'לא נבחר'}</span>
                </div>
                {showImages && (
                  <div className="moc-summary-row">
                    <ImageIcon size={15} style={{ color: 'var(--moc-text-muted)' }} />
                    <span className="moc-sr-label">תמונה</span>
                    <span className={`moc-sr-value ${dress.imageUrl ? '' : 'empty'}`}>
                      {dress.imageUrl ? 'הועלתה' : `תיטען אוטומטית לפי הקוד (${dress.barcodePrefix || '####'}.jpg)`}
                    </span>
                  </div>
                )}
                <div className="moc-summary-row">
                  <AlertTriangle size={15} style={{ color: 'var(--moc-text-muted)' }} />
                  <span className="moc-sr-label">הצג בבדיקה</span>
                  <span className={`moc-sr-value ${dress.inInspection ? '' : 'empty'}`}>{dress.inInspection ? 'מופעל' : 'כבוי'}</span>
                </div>
                <div className="moc-summary-row" style={{ alignItems: 'flex-start' }}>
                  <FileText size={15} style={{ color: 'var(--moc-text-muted)', marginTop: '3px' }} />
                  <span className="moc-sr-label">הערות</span>
                  <span className={`moc-sr-value ${dress.notes ? '' : 'empty'}`} style={{ whiteSpace: 'pre-wrap' }}>{dress.notes || 'אין'}</span>
                </div>
              </div>

              {totalItems > 0 ? (
                <>
                  <h3 style={{ margin: '20px 0 10px', fontSize: '1.05rem' }}>הפריטים שייווצרו</h3>
                  <div className="moc-table-scroll" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table className="moc-data-table">
                      <thead>
                        <tr><th>מידה</th><th>מס' סידורי</th><th>ברקוד</th><th>מיקום</th></tr>
                      </thead>
                      <tbody>
                        {plannedItems.map((it, idx) => (
                          <tr key={idx}>
                            <td><span className="moc-size-pill">{it.sizeText}</span></td>
                            <td className="moc-mono">{pad2(it.serialNumber)}</td>
                            <td className="moc-mono">{it.dressBarcode}</td>
                            <td>{it.location || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="moc-status-note warn" style={{ marginTop: '18px' }}>
                  <div>
                    <div className="moc-sn-label"><AlertTriangle size={15} /> הדגם ייווצר ללא פריטים</div>
                    <div className="moc-sn-sub">דגם ללא פריטים פעילים לא יופיע כזמין בהזמנה חדשה. אפשר להוסיף פריטים מיד לאחר היצירה.</div>
                  </div>
                  <button className="moc-btn moc-btn-outline moc-btn-sm" onClick={() => setStep(3)}>הוסף מלאי</button>
                </div>
              )}
            </div>
          )}

          {/* ===== ניווט ===== */}
          <div className="moc-wizard-foot">
            <button
              className="moc-btn moc-btn-outline"
              onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
              disabled={saving}
            >
              <ArrowRight size={15} /> {step === 1 ? 'ביטול' : 'הקודם'}
            </button>

            {step < STEPS.length ? (
              <button
                className="moc-btn moc-btn-gold"
                onClick={() => setStep(step + 1)}
                disabled={!canGoTo(step + 1) || saving}
                title={!canGoTo(step + 1) ? 'יש להשלים את פרטי הזיהוי' : ''}
              >
                הבא <ArrowLeft size={15} />
              </button>
            ) : (
              <button className="moc-btn moc-btn-gold" onClick={handleCreate} disabled={saving}>
                {saving ? <><span className="moc-spinner" /> יוצר...</> : <><Check size={15} /> צור דגם{totalItems > 0 ? ` ו-${totalItems} פריטים` : ''}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
