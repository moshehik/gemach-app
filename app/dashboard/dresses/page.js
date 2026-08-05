'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { RefreshCw, Trash2, CheckCircle, XCircle, List, ArrowUp, ArrowDown, ArrowUpDown, X, Search, Filter, Plus } from 'lucide-react';
import { useLabels } from '@/app/components/LabelsContext';
import { cacheNamespace, getSettingsCached } from '@/app/lib/pageCache';
import { buildDressesListParams } from '@/app/lib/prefetchRoutes';

// מטמון SWR משותף — ראה app/lib/pageCache.js
const dressesCache = cacheNamespace('dresses');

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
      const queryParams = buildDressesListParams({
        page: targetPage, limit, filterStatus, search: catalogSearch,
        sortKey: catalogSort.key, sortDir: catalogSort.direction, advancedFilters
      });

      const cacheKey = queryParams.toString();
      
      // SWR: Instant Cache Hit
      if (!isPrefetch && dressesCache.has(cacheKey)) {
        const cachedData = dressesCache.get(cacheKey);
        setDresses(cachedData.data);
        setTotalPages(cachedData.totalPages);
        setTotalDresses(cachedData.total);
        setLoading(false); // UI becomes interactive instantly
      }

      const res = await fetch(`/api/dresses?${queryParams.toString()}`);
      const data = await res.json();
      
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
      
      // Update Cache silently
      dressesCache.set(cacheKey, { data: parsedData, totalPages: parsedTotalPages, total: parsedTotal });

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
    const data = await getSettingsCached();

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

  const useModelNames = settings.useModelNames !== 'false';

  return (
    <>
      <main className="container animate-fade-in page-shell">
        <div className="page-scroll">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem', fontWeight: 'bold' }}>מאגר שמלות - קטלוג ראשי</h1>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px' }}>
              <button data-element-name="כפתור_page_4" onClick={() => setFilterStatus('active')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'active' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'active' ? '#2e7d32' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="דגמים פעילים">
                <CheckCircle data-element-name="רכיב_page_5" size={20} />
                <span style={{ fontWeight: filterStatus === 'active' ? 'bold' : 'normal' }}>פעילים</span>
              </button>
              <button data-element-name="כפתור_page_6" onClick={() => setFilterStatus('inactive')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'inactive' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'inactive' ? '#f57c00' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="לא פעילים">
                <XCircle data-element-name="רכיב_page_7" size={20} />
                <span style={{ fontWeight: filterStatus === 'inactive' ? 'bold' : 'normal' }}>לא פעילים</span>
              </button>
              <button data-element-name="כפתור_page_8" onClick={() => setFilterStatus('deleted')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'deleted' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'deleted' ? '#e53935' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="מחוקים">
                <Trash2 data-element-name="רכיב_page_9" size={20} />
                <span style={{ fontWeight: filterStatus === 'deleted' ? 'bold' : 'normal' }}>מחוקים</span>
              </button>
              <button data-element-name="כפתור_page_10" onClick={() => setFilterStatus('all')} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'all' ? '#1976d2' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="הצג הכל">
                <List data-element-name="רכיב_page_11" size={20} />
                <span style={{ fontWeight: filterStatus === 'all' ? 'bold' : 'normal' }}>הכל</span>
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>סה"כ רשומות: {totalDresses}</div>
          </div>
        </div>
        
        {/* Search and Action Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem',
          background: 'var(--card-bg)', 
          padding: '0.75rem 1.5rem', 
          borderRadius: '16px', 
          boxShadow: 'var(--shadow-sm)',
          gap: '1rem',
          flexWrap: 'wrap',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ flex: '1', minWidth: '300px', maxWidth: '600px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <Search data-element-name="רכיב_search_icon" size={18} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)' }} />
              <input data-element-name="שדה_page_1" 
                type="text" 
                placeholder="חיפוש טקסט חופשי (שם, מקט, מידה)..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.6rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }}
              />
              {catalogSearch && (
                <button data-element-name="כפתור_page_2"
                  onClick={() => setCatalogSearch('')}
                  style={{
                    position: 'absolute',
                    left: '0.5rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="נקה חיפוש"
                >
                  <X data-element-name="רכיב_clear_icon" size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button data-element-name="כפתור_page_3" 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="btn-header-icon" 
              title="סינון מתקדם"
            >
              <Filter data-element-name="רכיב_filter_icon" size={22} color={showAdvancedFilters ? 'var(--primary-color)' : 'currentColor'} />
            </button>
            <button data-element-name="כפתור_page_12" 
              onClick={() => router.push('/dashboard/dresses/new')}
              className="btn-header-icon"
              title="הוסף דגם חדש"
            >
              <Plus data-element-name="רכיב_plus_icon" size={22} />
            </button>
          </div>
        </div>
        
        {showAdvancedFilters && (
          <div style={{ background: 'var(--element-bg)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', border: '1px solid var(--element-border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold', color: '#1976d2', width: '100%' }}>סינון מתקדם:</div>
            
            <input data-element-name="שדה_page_13" type="text" placeholder="שם דגם / קידומת" value={advancedFilters.name} onChange={e => setAdvancedFilters({...advancedFilters, name: e.target.value})} className="filter-select" style={{ minWidth: '150px' }} />
            <input data-element-name="שדה_page_14" type="text" placeholder="מידה" value={advancedFilters.size} onChange={e => setAdvancedFilters({...advancedFilters, size: e.target.value})} className="filter-select" style={{ width: '80px' }} />
            <input data-element-name="שדה_page_15" type="number" placeholder="מס' סידורי" value={advancedFilters.serialNumber} onChange={e => setAdvancedFilters({...advancedFilters, serialNumber: e.target.value})} className="filter-select" style={{ width: '100px' }} />
            <input data-element-name="שדה_page_16" type="number" placeholder="השכרות מינימום" value={advancedFilters.rentalsCountMin} onChange={e => setAdvancedFilters({...advancedFilters, rentalsCountMin: e.target.value})} className="filter-select" style={{ width: '140px' }} />
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--element-border)' }}>
              <input data-element-name="שדה_page_17" type="checkbox" checked={advancedFilters.notInUse} onChange={e => setAdvancedFilters({...advancedFilters, notInUse: e.target.checked})} />
              לא בשימוש (פריט)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--element-border)' }}>
              <input data-element-name="שדה_page_18" type="checkbox" checked={advancedFilters.inRepair} onChange={e => setAdvancedFilters({...advancedFilters, inRepair: e.target.checked})} />
              בתיקון
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--element-border)' }}>
              <input data-element-name="שדה_page_19" type="checkbox" checked={advancedFilters.itemDeleted} onChange={e => setAdvancedFilters({...advancedFilters, itemDeleted: e.target.checked})} />
              פריט מחוק
            </label>
            
            <button data-element-name="כפתור_page_20" onClick={() => setAdvancedFilters({name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false})} className="btn" style={{ background: 'var(--element-bg)', color: 'var(--text-main)', border: 'none', padding: '0.4rem 1rem' }}>
              נקה סינונים
            </button>
          </div>
        )}
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>טוען נתונים...</div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ overflow: 'visible', minHeight: '50vh' }}>
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--element-border)', background: 'var(--element-bg)' }}>
                  {settings.hide_dress_images !== 'true' && <th style={{ padding: '0.4rem 0.5rem' }}>תמונה</th>}
                  <th data-element-name="לחיץ_page_21" style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('barcodePrefix')}>{getLabel('item_barcode', 'קוד')} {catalogSort.key === 'barcodePrefix' ? (catalogSort.direction === 'asc' ? <ArrowUp data-element-name="רכיב_page_22" size={14}/> : <ArrowDown data-element-name="רכיב_page_23" size={14}/>) : <ArrowUpDown data-element-name="רכיב_page_24" size={14} color="var(--text-muted)" />}</th>
                  {useModelNames && <th data-element-name="לחיץ_page_25" style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('name')}>{getLabel('item_modelName', 'שם דגם')} {catalogSort.key === 'name' ? (catalogSort.direction === 'asc' ? <ArrowUp data-element-name="רכיב_page_26" size={14}/> : <ArrowDown data-element-name="רכיב_page_27" size={14}/>) : <ArrowUpDown data-element-name="רכיב_page_28" size={14} color="var(--text-muted)" />}</th>}
                  <th data-element-name="לחיץ_page_29" style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('entryDateToRepo')}>תאריך כניסה {catalogSort.key === 'entryDateToRepo' ? (catalogSort.direction === 'asc' ? <ArrowUp data-element-name="רכיב_page_30" size={14}/> : <ArrowDown data-element-name="רכיב_page_31" size={14}/>) : <ArrowUpDown data-element-name="רכיב_page_32" size={14} color="var(--text-muted)" />}</th>
                  <th data-element-name="לחיץ_page_33" style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleCatalogSort('itemsCount')}>כמות פריטים {catalogSort.key === 'itemsCount' ? (catalogSort.direction === 'asc' ? <ArrowUp data-element-name="רכיב_page_34" size={14}/> : <ArrowDown data-element-name="רכיב_page_35" size={14}/>) : <ArrowUpDown data-element-name="רכיב_page_36" size={14} color="var(--text-muted)" />}</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredDresses.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                      לא נמצאו דגמים. נסה לשנות את הסינון או הוסף דגם חדש.
                    </td>
                  </tr>
                ) : filteredDresses.map(dress => (
                  <tr key={dress.id} style={{ borderBottom: '1px solid var(--element-border)', background: dress.isDeleted ? 'var(--deleted-bg, #ffebee)' : ((!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo ? 'var(--inactive-bg, #fff5f5)' : 'transparent') }}>
                    {settings.hide_dress_images !== 'true' && (
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        {getImageSource(dress) ? (
                          <img src={getImageSource(dress)} alt={dress.name} onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                        ) : null}
                        <div style={{ display: getImageSource(dress) ? 'none' : 'flex', width: '50px', height: '50px', background: 'var(--element-bg)', borderRadius: '4px', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>אין</div>
                      </td>
                    )}
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{dress.barcodePrefix || '-'}</td>
                    {useModelNames && <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold' }}>{dress.name}</td>}
                    <td style={{ padding: '0.4rem 0.5rem' }}>{formatHebrewDate(dress.entryDateToRepo)}</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{dress.items?.filter(i => !i.isDeleted).length || 0}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                      <Link data-element-name="כפתור_page_37" href={`/dashboard/dresses/${dress.id}`} className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem', marginLeft: '0.5rem', textDecoration: 'none', display: 'inline-block' }}>כרטיס שמלה</Link>
                      {dress.isDeleted ? (
                        <button data-element-name="כפתור_page_38" onClick={() => handleRestoreModel(dress)} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', borderColor: '#4caf50', color: '#4caf50' }} title="שחזר"><RefreshCw data-element-name="רכיב_page_39" size={18} /></button>
                      ) : ((!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo) ? (
                        <button data-element-name="כפתור_page_40" onClick={() => handleReturnToActivity(dress)} className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem', borderColor: '#ff9800', color: '#ff9800' }}>החזר לפעילות</button>
                      ) : (
                        <button data-element-name="כפתור_page_41" onClick={() => handleDeleteModel(dress.id)} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem', borderColor: '#e53935', color: '#e53935' }} title="מחק"><Trash2 data-element-name="רכיב_page_42" size={18} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
        </div>

        {/* סיכום הרשומות ועימוד — מוצמד תמיד לתחתית המסך */}
        <div className="page-footer-bar">
          <div className="page-footer-summary">סה"כ שורות מוצגות: {loading ? '...' : filteredDresses.length}</div>

          {totalPages > 1 && (
            <div className="page-footer-pager">
              <button data-element-name="כפתור_page_43" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>&lt; הקודם</button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>עמוד <input data-element-name="שדה_page_44" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} /> מתוך {totalPages} (סה"כ {totalDresses} תוצאות)</span>
              <button data-element-name="כפתור_page_45" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>הבא &gt;</button>
            </div>
          )}
        </div>
      </main>

    </>
  );
}
