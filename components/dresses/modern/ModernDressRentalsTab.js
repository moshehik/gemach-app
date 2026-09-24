'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { Card, Btn, Field, Row, Rows, Seg, Tag, Table, Empty, Banner, Icon } from '@/app/v3/ui/components';

/**
 * טאב "השכרות" — כל ההשכרות של כל פריטי הדגם, עם אריחי סיכום למעלה.
 */
export default function ModernDressRentalsTab({ dressId, active }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [sizeFilter, setSizeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const limit = 50;

  // נטען רק כשנכנסים לטאב בפעם הראשונה — לא מעכב את פתיחת הכרטיס
  useEffect(() => {
    if (!active || loaded || !dressId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dresses/${dressId}/rentals`)
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת ההשכרות');
        return res.json();
      })
      .then(d => { if (!cancelled) { setData(d); setLoaded(true); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, loaded, dressId]);

  const rentals = data?.rentals || [];
  const stats = data?.stats || { total: 0, lastYear: 0, outNow: 0, overdue: 0 };

  const sizes = useMemo(() => {
    const set = new Set(rentals.map(r => r.sizeText).filter(Boolean));
    return Array.from(set).sort((a, b) => (isNaN(a) || isNaN(b)) ? String(a).localeCompare(String(b), 'he') : a - b);
  }, [rentals]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rentals
      .filter(r => sizeFilter === 'all' || r.sizeText === sizeFilter)
      .filter(r => !term || [r.orderId, r.customerName, r.dressBarcode].some(v => v != null && String(v).toLowerCase().includes(term)));
  }, [rentals, sizeFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [sizeFilter, search]);

  const totalPages = Math.ceil(visible.length / limit) || 1;
  const paginatedRentals = useMemo(() => {
    const start = (page - 1) * limit;
    return visible.slice(start, start + limit);
  }, [visible, page]);

  if (loading) {
    return <div className="v3-empty" role="status"><Icon name="loader" size="xl" loop /><p className="v3-empty__text">טוענים השכרות…</p></div>;
  }

  if (error) {
    return <Banner kind="alert" title={error} />;
  }

  const columns = [
    { key: 'orderId', header: 'הזמנה', render: (r) => <bdi>{r.orderId}</bdi> },
    { key: 'customerName', header: 'לקוחה', render: (r) => r.customerName },
    {
      key: 'item', header: 'פריט',
      render: (r) => <>{r.sizeText || '—'} <span className="v3-muted">· <bdi>{r.dressBarcode || '—'}</bdi></span></>,
    },
    { key: 'eventDate', header: 'תאריך האירוע', render: (r) => r.eventDateHebrew || (r.eventDate ? getHebrewDateString(r.eventDate) : '—') },
    {
      key: 'takenDate', header: 'נלקחה',
      render: (r) => (r.takenDate ? (
        <span title={new Date(r.takenDate).toLocaleDateString('he-IL')}>
          {getHebrewDateString(r.takenDate) || new Date(r.takenDate).toLocaleDateString('he-IL')}
        </span>
      ) : '—'),
    },
    {
      key: 'returned', header: 'החזרה',
      render: (r) => (!r.isReturned ? (
        <Tag variant="attn" icon="clock">טרם הוחזרה</Tag>
      ) : r.returnedOk === false ? (
        <Tag variant="attn" icon="alert-tri">הוחזרה עם בעיה</Tag>
      ) : (
        <Tag variant="done" icon="check">הוחזרה תקין</Tag>
      )),
    },
    {
      key: 'open', header: 'כרטיס הזמנה',
      render: (r) => (
        <a
          href={`/orders/${r.orderId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="v3-btn v3-btn--sm v3-btn--icon"
          title="פתח כרטיס הזמנה"
          aria-label={`פתיחת כרטיס הזמנה ${r.orderId}`}
        >
          <Icon name="link" />
        </a>
      ),
    },
  ];

  return (
    <>
      <div className="v3-stack">
        <Card icon="refresh" title="השכרות במספרים">
          <Rows>
            <Row label="סך כל ההשכרות של הדגם"><bdi>{stats.total}</bdi></Row>
            <Row label="בשנה האחרונה"><bdi>{stats.lastYear}</bdi></Row>
            <Row label="מושכרות כרגע"><bdi>{stats.outNow}</bdi></Row>
            <Row label="באיחור בהחזרה" tip="השכרות שתאריך ההחזרה שלהן עבר והשמלה עדיין לא חזרה."><bdi>{stats.overdue}</bdi></Row>
          </Rows>
        </Card>
      </div>

      <div className="v3-filter-bar">
        <Seg
          label="סינון לפי מידה"
          value={sizeFilter}
          onChange={setSizeFilter}
          options={[{ value: 'all', label: 'כל המידות' }, ...sizes.map(s => ({ value: s, label: String(s) }))]}
        />
        <label className="v3-search">
          <Icon name="search" />
          <span className="v3-sr">חיפוש השכרות</span>
          <input
            id="dress-rentals-search"
            type="text"
            placeholder="הזמנה, לקוחה או ברקוד"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <Empty icon="refresh" title="אין השכרות להצגה" text="לא נמצאו השכרות לדגם הזה." />
      ) : (
        <div className="v3-stack">
          <Table
            columns={columns}
            rows={paginatedRentals.map((r, idx) => ({ ...r, _k: idx }))}
            rowKey="_k"
            caption="השכרות הדגם"
          />

          <div className="v3-cluster">
            <span className="v3-muted">מוצגות <bdi>{visible.length}</bdi> השכרות</span>
            {totalPages > 1 && (
              <div className="v3-cluster">
                <Btn size="sm" icon="chevron-end" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>הקודם</Btn>
                <Field
                  id="dress-rentals-page-num"
                  label="עמוד"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                  hint={<>מתוך <bdi>{totalPages}</bdi></>}
                />
                <Btn size="sm" iconEnd="chevron-start" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>הבא</Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
