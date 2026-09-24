'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import UploadZone from '../../../app/components/UploadZone';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { Card, Btn, Field, Row, Rows, Seg, Switch, Tip, Icon } from '@/app/v3/ui/components';
import '../dresses-v3.css';

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return `${new Date(d).toLocaleDateString('he-IL')} (${getHebrewDateString(d)})`;
  } catch (e) {
    return new Date(d).toLocaleDateString('he-IL');
  }
};

/**
 * טאב "פרטי דגם" — זהות הדגם, תמונה, סטטוס פעילות/בדיקה והערות.
 * כל השדות ערוכים ישירות (ללא מצב "עריכה" נפרד) — כמו שאר מסכי הטופס במערכת.
 */
export default function ModernDressDetailsTab({
  dress,
  onChange,
  isNewModel,
  useModelNames,
  showImages,
  categories,
  imageSrc,
  uploading,
  onImageUpload,
  onRemoveImage,
  onAutoCode,
  onMarkInactive,
  onReturnToActivity,
  onToggleInspection,
  onDelete,
  onRestore,
  onSave,
  saving
}) {
  const fileRef = useRef(null);
  const hasExitDate = !!dress.exitDateFromRepo;

  return (
    <>
      <div className={showImages ? 'dr3-two dr3-two--img' : 'dr3-two'}>
        {showImages && (
          <Card icon="image" title="תמונה">
            {imageSrc ? (
              <>
                <div className="dr3-photo">
                  <img
                    src={imageSrc}
                    alt={dress.name || 'תמונת דגם'}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div className="v3-cluster">
                  <Btn size="sm" icon="upload" loading={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? 'מעלים…' : 'החלפת תמונה'}
                  </Btn>
                  <Btn size="sm" variant="danger" icon="trash" title="הסרת התמונה" onClick={onRemoveImage}>הסרה</Btn>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="dr3-hidden-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(f); e.target.value = ''; }}
                />
              </>
            ) : (
              <UploadZone
                id="dress-detail-image"
                accept="image/*"
                onFileSelect={onImageUpload}
                disabled={uploading}
                label={uploading ? 'מעלים תמונה…' : 'אין תמונה. לחצו כדי להעלות'}
                hint="PNG או JPG"
              />
            )}

            <Field
              id="dress-detail-image-url"
              label="כתובת תמונה ידנית"
              tip={`בלי תמונה מועלית המערכת מחפשת קובץ בשם הקוד (${dress.barcodePrefix || '####'}.jpg), לפי ההגדרה "שמות קבצים לתמונות".`}
              className="dr3-ltr"
              type="text"
              dir="ltr"
              value={dress.imageUrl || ''}
              onChange={(e) => onChange({ imageUrl: e.target.value || null })}
              placeholder={`/images/dresses/${dress.barcodePrefix || '1234'}.jpg`}
            />
          </Card>
        )}

        <Card icon="id" title="זיהוי הדגם">
          <div className="v3-stack">
            <Field
              id="dress-detail-code"
              label="קוד הדגם"
              required={!!isNewModel}
              tip="הקוד הוא קידומת הברקוד של כל הפריטים, ולכן אי אפשר לשנות אותו אחרי יצירת הדגם."
              hint={isNewModel ? undefined : 'נעול אחרי היצירה'}
              type="number"
              value={dress.barcodePrefix ?? ''}
              disabled={!isNewModel}
              title={isNewModel ? '' : 'לא ניתן לשנות קוד לדגם קיים — הוא מרכיב את ברקודי הפריטים'}
              onChange={(e) => onChange({ barcodePrefix: e.target.value })}
            />
            {isNewModel && (
              <div>
                <Btn size="sm" icon="refresh" onClick={onAutoCode}>קוד אוטומטי</Btn>
              </div>
            )}

            {useModelNames && (
              <Field
                id="dress-detail-name"
                label="שם הדגם"
                required
                type="text"
                value={dress.name || ''}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            )}

            <Field
              id="dress-detail-category"
              as="select"
              label="קטגוריית מחיר"
              value={dress.priceCategory || ''}
              onChange={(e) => onChange({ priceCategory: e.target.value })}
            >
              <option value="">בחרו קטגוריה</option>
              {(categories || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
            </Field>

            {/* 35/36 - שמלת פרימיום. "דגם מפוצל 2 חלקים" הוסתר זמנית לבקשת ההנהלה (דיווח
                תקלה 2761ce82, 2026-09-10) כדי למנוע תקלות - השדה isSplit עצמו לא נגע בו,
                דגמים קיימים עם isSplit=true ממשיכים לפעול כרגיל, רק אי אפשר לסמן דגם חדש. */}
            <div id="dress-split-premium">
              <Switch
                label={<>שמלת פרימיום <Tip>שמלת פרימיום מתומחרת לפי קטגוריית הפרימיום, כשהאפשרות הזו מופעלת בהגדרות.</Tip></>}
                checked={!!dress.isPremium}
                onChange={(v) => onChange({ isPremium: v })}
              />
            </div>

            <div className="v3-field">
              <span className="v3-label">תאריך כניסה למאגר</span>
              <HebrewDatePicker value={dress.entryDateToRepo} onChange={(date) => onChange({ entryDateToRepo: date })} />
            </div>

            <div>
              <Link href="/dashboard/pricelist" target="_blank" className="v3-btn v3-btn--quiet v3-btn--sm">
                <Icon name="link" /><span>למחירון הקטגוריה</span>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {!isNewModel && (
        <Card icon="check-circle" title="סטטוס ובדיקה">
          <div className="v3-stack">
            <Row label={hasExitDate ? 'הדגם לא פעיל' : 'הדגם פעיל'} tip={hasExitDate
              ? 'הדגם הוצא מהמאגר, ואי אפשר לבחור בו בהזמנה חדשה.'
              : 'הדגם זמין להשכרה ומופיע בבחירת דגמים בהזמנה חדשה.'}>
              <Seg
                label="סטטוס הדגם"
                value={hasExitDate ? 'inactive' : 'active'}
                onChange={(v) => {
                  if (v === 'active') { if (hasExitDate) onReturnToActivity(); }
                  else if (!hasExitDate) onMarkInactive();
                }}
                options={[
                  { value: 'active', label: 'פעיל', icon: 'check-circle' },
                  { value: 'inactive', label: 'לא פעיל', icon: 'x-circle' },
                ]}
              />
            </Row>

            {hasExitDate && (
              <div className="v3-note v3-note--attn">
                <Rows>
                  <Row label="סיבה" icon="x-circle">{dress.inactiveReason || 'לא צוינה סיבה'}</Row>
                  <Row label="יצא מהמאגר בתאריך" icon="calendar"><bdi>{fmtDate(dress.exitDateFromRepo)}</bdi></Row>
                </Rows>
                <Btn size="sm" icon="edit" onClick={onMarkInactive}>עריכת סיבה ותאריך</Btn>
              </div>
            )}

            <Switch
              label={<>סימון &quot;בבדיקה&quot; <Tip>סימון עזר בלבד. כשהוא פעיל מופיע תג &quot;בבדיקה&quot; בכותרת הדגם ובהדפסה, כדי שכל מי שרואה את הדגם ידע שהוא דורש תשומת לב. הוא לא חוסם השכרה ולא מופיע בהתראות המלאי.</Tip></>}
              checked={!!dress.inInspection}
              onChange={() => onToggleInspection()}
              title={dress.inInspection ? 'הצג בבדיקה — מופעל. לחץ לכיבוי' : 'הצג בבדיקה — כבוי. לחץ להפעלה'}
            />
          </div>
        </Card>
      )}

      <Card icon="file" title="הערות">
        <Field
          id="dress-detail-notes"
          as="textarea"
          label="הערות לדגם"
          rows={3}
          value={dress.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="הערות כלליות על הדגם"
        />
      </Card>

      <div className="v3-stack">
        {!isNewModel && (
          <Row label="מזהה במערכת הישנה (Access)"><bdi>{dress.legacyId ?? '—'}</bdi></Row>
        )}
        <div className="v3-cluster">
          <Btn variant="primary" icon="check" loading={saving} onClick={() => onSave()}>
            {isNewModel ? 'שמירה ויצירת הדגם' : 'שמירת פרטי הדגם'}
          </Btn>
          {!isNewModel && (
            dress.isDeleted ? (
              <Btn size="sm" icon="refresh" onClick={onRestore}>שחזור הדגם</Btn>
            ) : (
              <Btn size="sm" variant="danger" icon="trash" onClick={onDelete}>מחיקת הדגם</Btn>
            )
          )}
        </div>
      </div>
    </>
  );
}
