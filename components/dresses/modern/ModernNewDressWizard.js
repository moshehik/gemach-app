'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import UploadZone from '../../../app/components/UploadZone';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { Card, Btn, IconBtn, Field, Tip, Stepper, StepNav, Table, Empty, Banner, Row, Rows, Chip, Switch, Icon } from '@/app/v3/ui/components';

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
  { id: 1, label: 'זיהוי' },
  { id: 2, label: showImages ? 'תמונה והערות' : 'הערות' },
  { id: 3, label: 'מלאי' },
  { id: 4, label: 'סיכום' }
]);

/**
 * אשף "הוספת דגם חדש" — אשף רב-שלבי (v3 Stepper/StepNav).
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
      if (data.success) patch({ imageUrl: data.imageUrl, thumbnailUrl: data.thumbnailUrl });
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

  // חסרים לצעד 1 - מוצג כהסבר ליד "להמשך" (הלוגיקה של step1Ok ללא שינוי)
  const missingList = [
    !codeOk && (codeStr ? 'קוד דגם בן 3 ספרות' : 'קוד דגם'),
    !nameOk && 'שם דגם',
    !catOk && 'קטגוריית מחיר'
  ].filter(Boolean).join(', ');

  const planned = plannedItems.map((it, idx) => ({ ...it, key: pendingItems[idx].key }));
  const summaryRows = plannedItems.map((it, idx) => ({ ...it, key: idx }));
  const itemColumns = [
    { key: 'sizeText', header: 'מידה', render: (it) => <b><bdi>{it.sizeText}</bdi></b> },
    { key: 'serialNumber', header: 'מס׳ סידורי', render: (it) => <bdi>{pad2(it.serialNumber)}</bdi> },
    { key: 'dressBarcode', header: 'ברקוד', render: (it) => <bdi>{it.dressBarcode}</bdi> },
    { key: 'location', header: 'מיקום', render: (it) => it.location || '—' }
  ];

  const stepperSteps = STEPS.map((s) => ({
    key: s.id,
    label: s.label,
    locked: !canGoTo(s.id),
    lockedReason: 'קודם משלימים את פרטי הזיהוי'
  }));

  return (
    <div className="v3-stack">
      <div className="v3-pagehead">
        <div className="v3-pagehead__title">
          <h1 className="v3-h1">דגם חדש</h1>
          <span className="v3-muted">
            <Link href="/dashboard/dresses">מאגר שמלות</Link> &laquo; דגם חדש
          </span>
        </div>
        <div className="v3-pagehead__tools">
          <Btn variant="quiet" size="sm" icon="x" onClick={onCancel} disabled={saving}>חזרה לקטלוג</Btn>
        </div>
      </div>

      <Card>
        <Stepper
          label="שלבי הוספת הדגם"
          steps={stepperSteps}
          current={step - 1}
          onStep={(i) => { const id = i + 1; if (canGoTo(id) && !saving) setStep(id); }}
        />
      </Card>

      <Card>
        <div className="v3-stack">
          {message && (
            <Banner kind={isErrorMsg ? 'alert' : 'info'} text={message} />
          )}

          <div key={step} className="v3-stack v3-anim-fade">
            {/* ===== צעד 1 — זיהוי ===== */}
            {step === 1 && (
              <>
                <h2 className="v3-h2">איזה דגם מוסיפים?</h2>

                <Field
                  label="קוד דגם"
                  required
                  tip="הקוד מרכיב את ברקודי הפריטים, ואי אפשר לשנות אותו אחרי היצירה."
                  id="dress-new-code"
                  type="number"
                  value={dress.barcodePrefix}
                  placeholder={codeLoading ? 'טוען קוד פנוי...' : ''}
                  onChange={e => patch({ barcodePrefix: e.target.value })}
                />
                <div className="v3-cluster">
                  <Btn size="sm" icon="refresh" onClick={handleAutoCode}>קוד פנוי</Btn>
                </div>

                {useModelNames && (
                  <Field label="שם דגם" required id="dress-new-name" type="text" value={dress.name} onChange={e => patch({ name: e.target.value })} placeholder="לדוגמה: רומנטיקה" autoFocus />
                )}

                <Field label="קטגוריית מחיר" required id="dress-new-category">
                  <select value={dress.priceCategory} onChange={e => patch({ priceCategory: e.target.value })}>
                    <option value="">בחירת קטגוריה</option>
                    {(categories || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                  </select>
                </Field>

                <div className="v3-field">
                  <span className="v3-label" id="dress-new-entrydate-label">תאריך כניסה למאגר</span>
                  <div role="group" aria-labelledby="dress-new-entrydate-label">
                    <HebrewDatePicker value={dress.entryDateToRepo} onChange={(date) => patch({ entryDateToRepo: date })} />
                  </div>
                </div>

                {!step1Ok && (
                  <div className="v3-hint" role="status">
                    <Icon name="alert-tri" size="sm" /> להמשך חסר: {missingList}
                  </div>
                )}
              </>
            )}

            {/* ===== צעד 2 — תמונה והערות ===== */}
            {step === 2 && (
              <>
                {showImages && (
                  <div className="v3-field">
                    <span className="v3-label">
                      תמונת הדגם
                      <Tip>אפשר לדלג: המערכת תחפש אוטומטית קובץ בשם <bdi>{dress.barcodePrefix || '####'}.jpg</bdi>.</Tip>
                    </span>
                    {imageSrc ? (
                      <>
                        <div style={{
                          borderRadius: 'var(--v3-r-md)', overflow: 'hidden', border: 'var(--v3-bw-hair) solid var(--v3-line)',
                          background: 'var(--v3-surface-2)', blockSize: 'calc(var(--v3-tap) * 5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <img src={imageSrc} alt="תצוגה מקדימה" style={{ maxInlineSize: '100%', maxBlockSize: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                        <div className="v3-cluster">
                          <Btn size="sm" icon="upload" onClick={() => fileRef.current?.click()}>החלפת תמונה</Btn>
                          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
                          <Btn size="sm" icon="trash" onClick={() => patch({ imageUrl: '', thumbnailUrl: '' })}>הסרת תמונה</Btn>
                        </div>
                      </>
                    ) : (
                      <UploadZone
                        id="dress-new-image"
                        accept="image/*"
                        onFileSelect={handleImageUpload}
                        disabled={uploading}
                        label={uploading ? 'מעלה תמונה...' : 'אין תמונה. לחצו כדי להעלות'}
                        hint="PNG או JPG"
                      />
                    )}
                  </div>
                )}

                <h2 className="v3-h2">הערות לדגם</h2>
                <Field
                  label="הערות"
                  tip="מוצגות לעובד כשהוא בוחר את הדגם."
                  as="textarea"
                  id="dress-new-notes"
                  rows={4}
                  value={dress.notes}
                  onChange={e => patch({ notes: e.target.value })}
                  placeholder="לדוגמה: רכיסה אחורית, לשים לב בהחזרה"
                />

                <div className="v3-cluster">
                  <Switch checked={!!dress.inInspection} onChange={() => patch({ inInspection: !dress.inInspection })} label="סימון בבדיקה" />
                  <Tip>תג לסימון עצמי בלבד: מופיע &quot;בבדיקה&quot; בכותרת הדגם ובהדפסה. לא חוסם השכרה ולא מופיע בהתראות המלאי.</Tip>
                </div>
              </>
            )}

            {/* ===== צעד 3 — מלאי ראשוני ===== */}
            {step === 3 && (
              <>
                <h2 className="v3-h2">אילו פריטים יש בדגם?</h2>
                <div className="v3-cluster">
                  <span className="v3-muted">כל שורה היא פריט אחד</span>
                  <Tip>הברקוד נבנה אוטומטית מקוד הדגם, המידה והמספר הסידורי.</Tip>
                </div>

                <Field
                  label="מידה"
                  required
                  id="dress-new-item-size"
                  type="number" min="0" max="99" placeholder="38"
                  value={newItem.sizeText}
                  onChange={e => changeNewItem('sizeText', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addPendingItem(); }}
                />
                <Field
                  label="מס׳ סידורי"
                  id="dress-new-item-serial"
                  type="number" min="1" max="99"
                  value={newItem.serialNumber}
                  onChange={e => changeNewItem('serialNumber', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addPendingItem(); }}
                />
                <Field label="מיקום" id="dress-new-item-loc">
                  <select value={newItem.location} onChange={e => changeNewItem('location', e.target.value)}>
                    <option value="">בחירת מיקום</option>
                    {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                  </select>
                </Field>

                <div className="v3-cluster">
                  <Chip variant="info" icon="tag">
                    ברקוד: <bdi>{String(newItem.sizeText).trim() ? buildBarcode(newItem.sizeText, Number(newItem.serialNumber) || nextSerialFor(newItem.sizeText)) : `${codeStr || '###'}____`}</bdi>
                  </Chip>
                  <Btn variant="primary" size="sm" icon="plus" onClick={addPendingItem}>הוספת פריט</Btn>
                </div>
                {addError && (
                  <div className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{addError}</div>
                )}

                {pendingItems.length === 0 ? (
                  <Empty icon="box" title="עוד אין פריטים" text="אפשר גם להוסיף אותם אחרי יצירת הדגם." />
                ) : (
                  <Table
                    caption="פריטים שנוספו"
                    sticky
                    rowKey="key"
                    rows={planned}
                    columns={[
                      ...itemColumns,
                      {
                        key: 'remove',
                        header: <span className="v3-sr">הסרה</span>,
                        render: (it) => (
                          <IconBtn icon="trash" label="הסרת פריט" variant="quiet" size="sm" title="הסרת פריט" onClick={() => removePendingItem(it.key)} />
                        )
                      }
                    ]}
                  />
                )}
              </>
            )}

            {/* ===== צעד 4 — סיכום ===== */}
            {step === 4 && (
              <>
                <h2 className="v3-h2">הכול מוכן ליצירה?</h2>

                <Rows>
                  <Row label="קוד דגם" icon="tag"><bdi>{dress.barcodePrefix || '—'}</bdi></Row>
                  {useModelNames && (
                    <Row label="שם דגם" icon="tag" missing={!dress.name} missingText="לא הוזן">{dress.name}</Row>
                  )}
                  <Row label="קטגוריית מחיר" icon="category" missing={!dress.priceCategory} missingText="לא נבחרה">{dress.priceCategory}</Row>
                  <Row label="תאריך כניסה למאגר" icon="calendar" missing={!fmtDate(dress.entryDateToRepo)} missingText="לא נבחר"><bdi>{fmtDate(dress.entryDateToRepo)}</bdi></Row>
                  {showImages && (
                    <Row label="תמונה" icon="image">
                      {dress.imageUrl ? 'הועלתה' : <>תיטען אוטומטית מהקובץ <bdi>{dress.barcodePrefix || '####'}.jpg</bdi></>}
                    </Row>
                  )}
                  <Row label="סימון בבדיקה" icon="alert-tri">{dress.inInspection ? 'פעיל' : 'כבוי'}</Row>
                  <Row label="הערות" icon="file"><span style={{ whiteSpace: 'pre-wrap' }}>{dress.notes || 'אין'}</span></Row>
                  <Row label="מידות" icon="ruler"><bdi>{new Set(pendingItems.map(p => String(p.sizeText).trim())).size}</bdi></Row>
                  <Row label="פריטים שייווצרו" icon="box"><bdi>{totalItems}</bdi></Row>
                </Rows>

                {totalItems > 0 ? (
                  <>
                    <h3 className="v3-h2">הפריטים</h3>
                    <Table caption="הפריטים שייווצרו" sticky rowKey="key" rows={summaryRows} columns={itemColumns} />
                  </>
                ) : (
                  <Banner
                    kind="warning"
                    title="הדגם ייווצר בלי פריטים"
                    text="דגם בלי פריטים פעילים לא יוצג כזמין בהזמנה. אפשר להוסיף פריטים מיד אחרי היצירה."
                    action={{ label: 'הוספת מלאי', onClick: () => setStep(3) }}
                  />
                )}
              </>
            )}
          </div>

          {/* ===== ניווט ===== */}
          {step < STEPS.length ? (
            <StepNav
              onBack={() => { if (saving) return; if (step === 1) onCancel(); else setStep(step - 1); }}
              backLabel={step === 1 ? 'ביטול' : 'חזרה'}
              onNext={() => setStep(step + 1)}
              nextDisabled={!canGoTo(step + 1) || saving}
              nextTip="קודם משלימים את פרטי הזיהוי."
            />
          ) : (
            <div className="v3-stepnav">
              <div className="v3-cluster">
                <Btn variant="primary" icon="check" onClick={handleCreate} loading={saving}>
                  {saving ? 'יוצר...' : `יצירת הדגם${totalItems > 0 ? ` ו-${totalItems} פריטים` : ''}`}
                </Btn>
              </div>
              <Btn variant="quiet" icon="back" onClick={() => { if (!saving) setStep(step - 1); }} disabled={saving}>חזרה</Btn>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
