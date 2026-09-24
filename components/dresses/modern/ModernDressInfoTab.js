'use client';

import React, { useEffect, useState } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips } from '../../modern/ChangesChips';
import { Card, Row, Rows, Tag, Empty, Banner, Icon } from '@/app/v3/ui/components';

const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return `${date.toLocaleDateString('he-IL')} (${getHebrewDateString(date)}) · ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
};

// מיפוי מקומי (עיצוב "אריג" בלבד) מפעולת יומן ל-badge סמנטי — אותה קיבוץ סמנטי
// בדיוק כמו ACTION_TONES ב-components/modern/ChangesChips.js (משותף, מחוץ לאשכול
// הזה), רק שממופה ל-וריאנטים של Tag ב-v3.
const ACTION_TAG_VARIANT = {
  CREATE: 'done',
  DELETE: 'attn',
  UPDATE: 'soft',
  CANCEL_RENTAL: 'attn',
  CANCEL_RETURN: 'attn',
  CANCEL_SCAN: 'attn',
  CANCEL_ITEM: 'attn',
  CANCEL_OBLIGATION: 'attn',
  CANCEL_PAYMENT: 'attn',
  CANCEL_ORDER: 'attn',
  CANCEL_CHANGES: 'attn',
  RESTORE_ITEM: 'done',
  RESTORE_OBLIGATION: 'done',
  RESTORE_PAYMENT: 'done',
  CONFIRM_RENTAL: 'done',
  RETURN_RENTAL: 'done',
  DEBT_APPROVED: 'done',
  CANCEL_DEBT_APPROVAL: 'attn'
};
const tagVariantFor = (action) => ACTION_TAG_VARIANT[action];

/**
 * טאב "מידע" — נתוני מערכת ויומן השינויים של הדגם ושל הפריטים שלו.
 * שורות היומן משתמשות ב-<details>/<summary> (רכיב faq-item) לפתיחה/סגירה.
 */
export default function ModernDressInfoTab({ dress, items, active }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!active || loaded || !dress?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const itemIds = (items || []).map(i => i.id).filter(Boolean);
    const requests = [
      fetch(`/api/audit?entityType=DressModel&entityId=${dress.id}&limit=100`).then(r => r.ok ? r.json() : { logs: [] })
    ];
    if (itemIds.length) {
      requests.push(
        fetch(`/api/audit?entityType=DressItem&entityIds=${itemIds.join(',')}&limit=200`).then(r => r.ok ? r.json() : { logs: [] })
      );
    }

    Promise.all(requests)
      .then(results => {
        if (cancelled) return;
        const barcodeById = {};
        (items || []).forEach(i => { barcodeById[i.id] = i.dressBarcode || i.sizeText || ''; });
        const merged = results.flatMap((res, idx) =>
          (res.logs || []).map(l => ({
            ...l,
            scope: idx === 0 ? 'model' : 'item',
            itemLabel: idx === 0 ? null : barcodeById[l.entityId]
          }))
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLogs(merged);
        setLoaded(true);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [active, loaded, dress?.id]);

  const activeItems = (items || []).filter(i => !i.isDeleted);
  const sizes = Array.from(new Set(activeItems.map(i => i.sizeText).filter(Boolean)));

  return (
    <>
      <div className="v3-stack">
        <Card icon="tag" title="פרטי המערכת">
          <Rows>
            <Row label="שם הדגם" icon="tag">{dress.name || '—'}</Row>
            <Row label="קידומת הברקוד" icon="box"><bdi>{dress.barcodePrefix ?? '—'}</bdi></Row>
            <Row label="נכנס למאגר" icon="calendar"><bdi>{dress.entryDateToRepo ? fmtDateTime(dress.entryDateToRepo) : '—'}</bdi></Row>
            <Row label="עודכן לאחרונה"><bdi>{fmtDateTime(dress.updatedAt)}</bdi></Row>
            <Row label="מזהה במערכת הישנה (Access)"><bdi>{dress.legacyId ?? '—'}</bdi></Row>
          </Rows>
        </Card>

        <Card icon="box" title="מצב המלאי">
          <Rows>
            <Row label="פריטים פעילים"><bdi>{activeItems.length}</bdi></Row>
            <Row label="זמינים"><bdi>{activeItems.filter(i => !i.inRepair && !i.notInUse).length}</bdi></Row>
            <Row label="לטיפול"><bdi>{activeItems.filter(i => i.inRepair || i.notInUse).length}</bdi></Row>
            <Row label="מידות במלאי">{sizes.length ? sizes.join(', ') : 'אין'}</Row>
          </Rows>
        </Card>

        <Card icon="history" title="יומן שינויים" tip="לחיצה על שורה מציגה את פירוט השינוי.">
          <p className="v3-muted"><bdi>{logs.length}</bdi> פעולות תועדו</p>

          {loading ? (
            <div className="v3-empty" role="status"><Icon name="loader" size="xl" loop /><p className="v3-empty__text">טוענים את היומן…</p></div>
          ) : error ? (
            <Banner kind="alert" title={`טעינת היומן נכשלה: ${error}`} />
          ) : logs.length === 0 ? (
            <Empty icon="history" title="אין עדיין היסטוריה" text="לא תועדו פעולות לדגם הזה." />
          ) : (
            <div className="v3-stack">
              {logs.map(log => {
                const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
                const d = new Date(log.createdAt);
                return (
                  <details key={log.id} className="v3-collapse">
                    <summary>
                      <Tag variant={tagVariantFor(log.action)}>{actionLabel}</Tag>
                      <span>
                        {log.scope === 'item' ? `פריט ${log.itemLabel || ''}` : 'פרטי הדגם'}
                      </span>
                      <span className="v3-muted">
                        <bdi>{d.toLocaleDateString('he-IL')} · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi>
                      </span>
                      <Icon name="chevron-down" className="v3-collapse__chev" />
                    </summary>
                    <div className="v3-collapse__in">
                      <ChangesChips changesJson={log.changesJson} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
