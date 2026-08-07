'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { useLabels } from '@/app/components/LabelsContext';
import { fetchSharedJson, readCache, TTL } from '@/lib/apiCache';
import { buildDressesListParams } from '@/app/lib/prefetchRoutes';

export default function DressesManagement() {
  const { getLabel } = useLabels();
  const router = useRouter();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('active'); // 'active', 'inactive', 'deleted', 'all'
  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true' });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState({ key: 'name', direction: 'asc' });
  const [advancedFilters, setAdvancedFilters] = useState({
    name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Server-side pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDresses, setTotalDresses] = useState(0);

  const fetchDresses = async (isPrefetch = false, targetPage = page) => {
    if (!isPrefetch) setLoading(true);
    try {
      // בניית ה-query דרך prefetchRoutes כדי שה-prefetch מדפים אחרים ייצר
      // את אותו מפתח מטמון בדיוק, תו בתו.
      const queryParams = buildDressesListParams({
        page: targetPage, limit, filterStatus, search: catalogSearch,
        sortKey: catalogSort.key, sortDir: catalogSort.direction, advancedFilters
      });

      const url = `/api/dresses?${queryParams.toString()}`;

      // מטמון משותף (SWR): נתונים שנטענו כבר מוצגים מיידית; mutations לשמלות/פריטים
      // מבטלות את המטמון אוטומטית דרך lib/apiCache.js
      const cached = readCache(url);
      if (!isPrefetch && cached && Array.isArray(cached.data)) {
        setDresses(cached.data);
        setTotalPages(cached.totalPages || 1);
        setTotalDresses(cached.total || 0);
        setLoading(false); // UI becomes interactive instantly
      }

      const data = await fetchSharedJson(url, { ttl: TTL.LIST });

      let parsedData = [];
      let parsedTotalPages = 1;
      let parsedTotal = 0;

      if (data && Array.isArray(data.data)) {
        parsedData = data.data;
        parsedTotalPages = data.totalPages || 1;
        parsedTotal = data.total || 0;
      } else if (Array.isArray(data)) {
        parsedData = data;
        parsedTotalPages = 1;
        parsedTotal = data.length;
      } else {
        console.error('API returned non-array:', data);
      }

      if (!isPrefetch && targetPage === page) {
        setDresses(parsedData);
        setTotalPages(parsedTotalPages);
        setTotalDresses(parsedTotal);
      }
    } catch (e) {
      console.error('Failed to fetch dresses:', e);
      if (!isPrefetch) setDresses([]);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const data = await fetchSharedJson('/api/settings', { ttl: TTL.STATIC });

    const settingsObj = { useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' };
    if (Array.isArray(data)) {
      data.forEach(s => {
        if (s.key) settingsObj[s.key] = s.value;
      });
    } else {
      Object.assign(settingsObj, data);
    }

    setSettings(settingsObj);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchDresses(false, page);

      // Background Prefetching for the next page
      const prefetchTimer = setTimeout(() => {
        if (page < totalPages) {
          fetchDresses(true, page + 1);
        }
      }, 1500);

    }, 400); // Debounce API calls
    return () => clearTimeout(handler);
  }, [page, limit, filterStatus, catalogSearch, catalogSort, advancedFilters, totalPages]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, catalogSearch, catalogSort, advancedFilters]);

  const handleDeleteModel = async (id) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך למחוק דגם זה? לא ניתן למחוק אם יש פריטים מקושרים.')) return;

    try {
      const res = await fetch(`/api/dresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchDresses();
      } else {
        alert(data.error || 'שגיאה במחיקת הדגם');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת');
    }
  };

  const handleRestoreModel = async (dress) => {
    if (!await window.customConfirm(`האם אתה בטוח שברצונך לשחזר את הדגם ${dress.barcodePrefix || dress.name}?`)) return;
    try {
      const res = await fetch(`/api/dresses/${dress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      if (res.ok) {
        alert('הדגם שוחזר בהצלחה');
        fetchDresses();
      } else {
        const err = await res.json();
        alert(err.error || 'שגיאה בשחזור הדגם');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת');
    }
  };

  const handleReturnToActivity = async (dress) => {
    if (!await window.customConfirm(`האם אתה בטוח שברצונך להחזיר לפעילות את הדגם ${dress.barcodePrefix || dress.name}?`)) return;

    // Check if the reason it's inactive is because of items
    const hasActiveItems = dress.items && dress.items.length > 0 && dress.items.some(i => !i.notInUse && !i.isDeleted);
    if (!hasActiveItems) {
        alert('שימו לב: לדגם זה אין פריטים פעילים במלאי. כדי שהדגם יהיה פעיל לחלוטין, יש להיכנס לכרטיס השמלה ולהוסיף פריטים או להחזירם לשימוש.');
    }

    try {
      const res = await fetch(`/api/dresses/${dress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitDateFromRepo: null })
      });
      if (res.ok) {
        alert('הדגם חזר לפעילות בהצלחה');
        fetchDresses();
      } else {
        const err = await res.json();
        alert(err.error || 'שגיאה בהחזרת הדגם לפעילות');
      }
    } catch (error) {
      console.error(error);
      alert('שגיאה בתקשורת');
    }
  };

  const formatHebrewDate = (isoString) => {
    if (!isoString) return '-';
    try {
      return getHebrewDateString(isoString);
    } catch (e) {
      return new Date(isoString).toLocaleDateString('he-IL');
    }
  };

  const getImageSource = (dress) => {
    if (dress.imageUrl) return dress.imageUrl;
    if (settings.useFileNamesForImages === 'true' && dress.barcodePrefix) {
      return `/images/dresses/${dress.barcodePrefix}.jpg`;
    }
    return null;
  };

  const filteredDresses = dresses;

  const handleCatalogSort = (key) => {
    let direction = 'asc';
    if (catalogSort.key === key && catalogSort.direction === 'asc') direction = 'desc';
    setCatalogSort({ key, direction });
  };

  const renderCatalogSortIcon = (key) => {
    if (catalogSort.key !== key) {
      return <svg className="icon"><use href="#i-sort" /></svg>;
    }
    return (
      <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: catalogSort.direction === 'desc' ? 'rotate(180deg)' : 'none' }}>
        <use href="#i-chevron-down" />
      </svg>
    );
  };

  const useModelNames = settings.useModelNames !== 'false';
  const showImageColumn = settings.hide_dress_images !== 'true';
  const emptyStateColSpan = 4 + (showImageColumn ? 1 : 0) + (useModelNames ? 1 : 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>מאגר שמלות - קטלוג ראשי</h1>
          <div className="page-desc">סה"כ רשומות: {totalDresses}</div>
        </div>
        <div className="page-actions">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="btn btn-secondary btn-icon-only"
            title="סינון מתקדם"
            style={showAdvancedFilters ? { color: 'var(--primary-solid)', borderColor: 'var(--primary-solid)' } : undefined}
          >
            <svg className="icon"><use href="#i-list" /></svg>
          </button>
          <button
            onClick={() => router.push('/dashboard/dresses/new')}
            className="btn btn-primary"
          >
            <svg className="icon"><use href="#i-plus" /></svg>
            דגם חדש
          </button>
        </div>
      </div>

      {/* סרגל חיפוש: מקביל להתנהגות ה-AISearchBar הישן על הדף הזה — חיפוש טקסט חופשי בלבד
          (ללא חיפוש AI/סטטיסטיקה מחוברים בפועל בדף המקורי), עם ניקוי מיידי */}
      <div className="toolbar">
        <div className="search-toolbar">
          <svg className="icon"><use href="#i-search" /></svg>
          <input
            type="text"
            placeholder="חיפוש טקסט חופשי (שם, מקט, מידה)..."
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
          />
          <div className="search-toolbar-actions">
            {catalogSearch && (
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה חיפוש" onClick={() => setCatalogSearch('')}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* סינון סטטוס: פעילים / לא פעילים / מחוקים / הכל */}
      <div className="pill-tabs" style={{ marginBottom: '20px' }}>
        <button onClick={() => setFilterStatus('active')} className={filterStatus === 'active' ? 'pill-tab active' : 'pill-tab'} title="דגמים פעילים">
          <svg className="icon"><use href="#i-check-circle" /></svg>
          פעילים
        </button>
        <button onClick={() => setFilterStatus('inactive')} className={filterStatus === 'inactive' ? 'pill-tab active' : 'pill-tab'} title="לא פעילים">
          <svg className="icon"><use href="#i-x-circle" /></svg>
          לא פעילים
        </button>
        <button onClick={() => setFilterStatus('deleted')} className={filterStatus === 'deleted' ? 'pill-tab active' : 'pill-tab'} title="מחוקים">
          <svg className="icon"><use href="#i-trash" /></svg>
          מחוקים
        </button>
        <button onClick={() => setFilterStatus('all')} className={filterStatus === 'all' ? 'pill-tab active' : 'pill-tab'} title="הצג הכל">
          <svg className="icon"><use href="#i-list" /></svg>
          הכל
        </button>
      </div>

      {showAdvancedFilters && (
        <div className="card card-pad" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14.5px', marginBottom: '14px' }}>סינון מתקדם:</h2>

          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="dresses-filter-name">שם דגם / קידומת</label>
              <input id="dresses-filter-name" type="text" className="input" value={advancedFilters.name} onChange={e => setAdvancedFilters({ ...advancedFilters, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="dresses-filter-size">מידה</label>
              <input id="dresses-filter-size" type="text" className="input" value={advancedFilters.size} onChange={e => setAdvancedFilters({ ...advancedFilters, size: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="dresses-filter-serial">מס' סידורי</label>
              <input id="dresses-filter-serial" type="number" className="input" value={advancedFilters.serialNumber} onChange={e => setAdvancedFilters({ ...advancedFilters, serialNumber: e.target.value })} />
            </div>
          </div>
          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="dresses-filter-rentals-min">השכרות מינימום</label>
              <input id="dresses-filter-rentals-min" type="number" className="input" value={advancedFilters.rentalsCountMin} onChange={e => setAdvancedFilters({ ...advancedFilters, rentalsCountMin: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div className="checkbox-row">
              <input id="dresses-filter-not-in-use" type="checkbox" checked={advancedFilters.notInUse} onChange={e => setAdvancedFilters({ ...advancedFilters, notInUse: e.target.checked })} />
              <label htmlFor="dresses-filter-not-in-use">לא בשימוש (פריט)</label>
            </div>
            <div className="checkbox-row">
              <input id="dresses-filter-in-repair" type="checkbox" checked={advancedFilters.inRepair} onChange={e => setAdvancedFilters({ ...advancedFilters, inRepair: e.target.checked })} />
              <label htmlFor="dresses-filter-in-repair">בתיקון</label>
            </div>
            <div className="checkbox-row">
              <input id="dresses-filter-item-deleted" type="checkbox" checked={advancedFilters.itemDeleted} onChange={e => setAdvancedFilters({ ...advancedFilters, itemDeleted: e.target.checked })} />
              <label htmlFor="dresses-filter-item-deleted">פריט מחוק</label>
            </div>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => setAdvancedFilters({ name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false })}>
            נקה סינונים
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-inline"><span className="spinner" /> טוען נתונים...</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {showImageColumn && <th>תמונה</th>}
                <th className={catalogSort.key === 'barcodePrefix' ? 'sortable sort-active' : 'sortable'} onClick={() => handleCatalogSort('barcodePrefix')}>
                  {getLabel('item_barcode', 'קוד')} {renderCatalogSortIcon('barcodePrefix')}
                </th>
                {useModelNames && (
                  <th className={catalogSort.key === 'name' ? 'sortable sort-active' : 'sortable'} onClick={() => handleCatalogSort('name')}>
                    {getLabel('item_modelName', 'שם דגם')} {renderCatalogSortIcon('name')}
                  </th>
                )}
                <th className={catalogSort.key === 'entryDateToRepo' ? 'sortable sort-active' : 'sortable'} onClick={() => handleCatalogSort('entryDateToRepo')}>
                  תאריך כניסה {renderCatalogSortIcon('entryDateToRepo')}
                </th>
                <th className={catalogSort.key === 'itemsCount' ? 'sortable sort-active' : 'sortable'} onClick={() => handleCatalogSort('itemsCount')}>
                  כמות פריטים {renderCatalogSortIcon('itemsCount')}
                </th>
                <th style={{ textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredDresses.length === 0 ? (
                <tr>
                  <td colSpan={emptyStateColSpan} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)', fontSize: '1.2rem' }}>
                    לא נמצאו דגמים. נסה לשנות את הסינון או הוסף דגם חדש.
                  </td>
                </tr>
              ) : filteredDresses.map(dress => {
                const isInactive = (!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo;
                const imgSrc = getImageSource(dress);
                return (
                  <tr key={dress.id} className={dress.isDeleted ? 'row-flag' : undefined} style={!dress.isDeleted && isInactive ? { background: 'var(--warning-tint)' } : undefined}>
                    {showImageColumn && (
                      <td>
                        {imgSrc && (
                          <img
                            src={imgSrc}
                            alt={dress.name}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                          />
                        )}
                        <div
                          className="file-icon"
                          style={{
                            display: imgSrc ? 'none' : 'flex', width: '44px', height: '44px', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)', color: 'var(--text-3)', fontSize: '10.5px'
                          }}
                        >
                          אין
                        </div>
                      </td>
                    )}
                    <td className={dress.isDeleted ? 'cell-primary cell-muted' : 'cell-primary'}>{dress.barcodePrefix || '-'}</td>
                    {useModelNames && (
                      <td className={dress.isDeleted ? 'cell-primary cell-muted' : 'cell-primary'}>
                        {dress.name}
                      </td>
                    )}
                    <td className={dress.isDeleted ? 'cell-muted' : undefined}>{formatHebrewDate(dress.entryDateToRepo)}</td>
                    <td className={dress.isDeleted ? 'cell-muted' : undefined}>{dress.items?.filter(i => !i.isDeleted).length || 0}</td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/dashboard/dresses/${dress.id}`} className="btn btn-primary btn-sm">כרטיס שמלה</Link>
                        {dress.isDeleted ? (
                          <button onClick={() => handleRestoreModel(dress)} className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--success)' }} title="שחזר">
                            <svg className="icon"><use href="#i-refresh" /></svg>
                          </button>
                        ) : isInactive ? (
                          <button onClick={() => handleReturnToActivity(dress)} className="btn btn-secondary btn-sm" style={{ color: 'var(--warning)' }} title="החזר לפעילות">
                            החזר לפעילות
                          </button>
                        ) : (
                          <button onClick={() => handleDeleteModel(dress.id)} className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--danger)' }} title="מחק">
                            <svg className="icon"><use href="#i-trash" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="table-foot">
            <span>סה"כ שורות מוצגות: {loading ? '...' : filteredDresses.length}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} title="עמוד קודם">
                  <svg className="icon"><use href="#i-chevron-end" /></svg>הקודם
                </button>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="dresses-page-num">עמוד</label>
                  <input
                    id="dresses-page-num"
                    type="number"
                    className="input"
                    min={1}
                    max={totalPages || 1}
                    value={page}
                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                    style={{ width: '60px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                  />
                  מתוך {totalPages} (סה"כ {totalDresses} תוצאות)
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} title="עמוד הבא">
                  הבא<svg className="icon"><use href="#i-chevron-start" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
