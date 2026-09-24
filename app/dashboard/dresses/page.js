'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { useLabels } from '@/app/components/LabelsContext';
import { fetchSharedJson, readCache, TTL } from '@/lib/apiCache';
import { buildDressesListParams } from '@/app/lib/prefetchRoutes';
import { getDressThumbUrl } from '@/app/lib/dressImageUrl';
import { V3Page, Card, Btn, Field, Switch, Seg, Tip, Icon, Tag, Table, Empty } from '@/app/v3/ui/components';
import { v3Toast } from '@/app/v3/notify';
import useDressDialogs from '@/components/dresses/useDressDialogs';

export default function DressesManagement() {
  const { getLabel } = useLabels();
  const { confirm, notice, dialogs } = useDressDialogs();
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
  // הוספה/מחיקה של דגם היא פעולת ניהול המוגבלת להנהלה ראשית/מתכנת בשרת
  // (ר' app/api/dresses/route.js POST, app/api/dresses/[id]/route.js DELETE) —
  // הכפתורים כאן מוסתרים בהתאם כדי לא להציע פעולה שתידחה.
  const [isHeadManagement, setIsHeadManagement] = useState(false);

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
    fetch('/api/me').then(r => r.json()).then(data => {
      const roleId = data?.employee?.roleId;
      setIsHeadManagement(roleId === 0 || roleId === 2);
    }).catch(() => {});
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
    if (!await confirm({ title: 'למחוק את הדגם?', text: 'אי אפשר למחוק דגם שיש לו פריטים מקושרים.', confirmLabel: 'מחיקה', danger: true, mode: 'dark', icon: 'trash' })) return;

    try {
      const res = await fetch(`/api/dresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchDresses();
      } else {
        await notice({ title: 'המחיקה נכשלה', text: data.error || 'לא הצלחנו למחוק את הדגם.', icon: 'alert-circle' });
      }
    } catch (error) {
      console.error(error);
      await notice({ title: 'בעיית תקשורת', text: 'הבקשה לא הגיעה לשרת. נסו שוב.', icon: 'alert-circle' });
    }
  };

  const handleRestoreModel = async (dress) => {
    if (!await confirm({ title: 'לשחזר את הדגם?', text: `הדגם ${dress.barcodePrefix || dress.name} יחזור לקטלוג.`, confirmLabel: 'שחזור', mode: 'dark', icon: 'refresh' })) return;
    try {
      const res = await fetch(`/api/dresses/${dress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      if (res.ok) {
        v3Toast('הדגם שוחזר', 'success');
        fetchDresses();
      } else {
        const err = await res.json();
        await notice({ title: 'השחזור נכשל', text: err.error || 'לא הצלחנו לשחזר את הדגם.', icon: 'alert-circle' });
      }
    } catch (error) {
      console.error(error);
      await notice({ title: 'בעיית תקשורת', text: 'הבקשה לא הגיעה לשרת. נסו שוב.', icon: 'alert-circle' });
    }
  };

  const handleReturnToActivity = async (dress) => {
    if (!await confirm({ title: 'להחזיר לפעילות?', text: `הדגם ${dress.barcodePrefix || dress.name} יחזור להיות פעיל.`, confirmLabel: 'החזרה לפעילות', mode: 'dark', icon: 'refresh' })) return;

    // Check if the reason it's inactive is because of items
    const hasActiveItems = dress.items && dress.items.length > 0 && dress.items.some(i => !i.notInUse && !i.isDeleted);
    if (!hasActiveItems) {
        await notice({ title: 'שימו לב', text: 'לדגם הזה אין פריטים פעילים במלאי. כדי שיהיה פעיל באמת, פתחו את כרטיס השמלה והוסיפו פריטים או החזירו אותם לשימוש.', icon: 'info' });
    }

    try {
      const res = await fetch(`/api/dresses/${dress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitDateFromRepo: null })
      });
      if (res.ok) {
        v3Toast('הדגם פעיל שוב', 'success');
        fetchDresses();
      } else {
        const err = await res.json();
        await notice({ title: 'הפעולה נכשלה', text: err.error || 'לא הצלחנו להחזיר את הדגם לפעילות.', icon: 'alert-circle' });
      }
    } catch (error) {
      console.error(error);
      await notice({ title: 'בעיית תקשורת', text: 'הבקשה לא הגיעה לשרת. נסו שוב.', icon: 'alert-circle' });
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
  const showImageColumn = settings.hide_dress_images !== 'true';
  const emptyStateColSpan = 4 + (showImageColumn ? 1 : 0) + (useModelNames ? 1 : 0);

  const clearAdvanced = () => setAdvancedFilters({ name: '', size: '', serialNumber: '', rentalsCountMin: '', notInUse: false, inRepair: false, itemDeleted: false });

  const columns = [
    ...(showImageColumn ? [{
      key: 'image', header: 'תמונה',
      render: (dress) => {
        const imgSrc = getImageSource(dress);
        // תא של 44px לא צריך את תמונת המקור — מנסים קודם את ה-thumb
        // (קיים רק להעלאות חדשות); onError נופל חזרה למקור ורק אז מוותר.
        const thumbSrc = getDressThumbUrl(dress);
        return (
          <>
            {imgSrc && (
              <img
                src={thumbSrc || imgSrc}
                alt={dress.name}
                loading="lazy"
                decoding="async"
                width={44}
                height={44}
                onError={(e) => {
                  const img = e.target;
                  if (thumbSrc && !img.dataset.fellBack) {
                    // אין קובץ thumb (תמונה ישנה) — ננסה את המקור
                    img.dataset.fellBack = '1';
                    img.src = imgSrc;
                  } else {
                    img.style.display = 'none';
                    img.nextSibling.style.display = 'flex';
                  }
                }}
                style={{ width: 'var(--v3-tap)', height: 'var(--v3-tap)', objectFit: 'cover', borderRadius: 'var(--v3-r-md)' }}
              />
            )}
            <div
              className="file-icon v3-item__thumb v3-faint"
              style={{ display: imgSrc ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="dress" anim={false} />
              <span className="v3-sr">אין תמונה</span>
            </div>
          </>
        );
      },
    }] : []),
    {
      key: 'barcodePrefix', header: getLabel('item_barcode', 'קוד'), sortable: true,
      render: (dress) => (
        <span className={dress.isDeleted ? 'v3-muted' : undefined}><bdi>{dress.barcodePrefix || '-'}</bdi></span>
      ),
    },
    ...(useModelNames ? [{
      key: 'name', header: getLabel('item_modelName', 'שם דגם'), sortable: true,
      render: (dress) => (
        <span className={dress.isDeleted ? 'v3-muted' : undefined}>{dress.name}</span>
      ),
    }] : []),
    {
      key: 'entryDateToRepo', header: 'נכנס למאגר', sortable: true,
      render: (dress) => <span className={dress.isDeleted ? 'v3-muted' : undefined}>{formatHebrewDate(dress.entryDateToRepo)}</span>,
    },
    {
      key: 'itemsCount', header: 'פריטים', sortable: true, num: true,
      render: (dress) => <span className={dress.isDeleted ? 'v3-muted' : undefined}><bdi>{dress.items?.filter(i => !i.isDeleted).length || 0}</bdi></span>,
    },
    {
      key: 'actions', header: 'פעולות',
      render: (dress) => {
        const isInactive = (!dress.items || !dress.items.some(i => !i.notInUse)) || dress.exitDateFromRepo;
        return (
          <div className="v3-cluster">
            {dress.isDeleted && <Tag variant="attn" icon="trash">מחוק</Tag>}
            {!dress.isDeleted && isInactive && <Tag variant="attn" icon="x-circle">לא פעיל</Tag>}
            <Link href={`/dashboard/dresses/${dress.id}`} className="v3-btn v3-btn--primary v3-btn--sm"><Icon name="dress" /><span>לכרטיס</span></Link>
            {dress.isDeleted ? (
              isHeadManagement && <Btn size="sm" icon="refresh" onClick={() => handleRestoreModel(dress)}>שחזור</Btn>
            ) : isInactive ? (
              <Btn size="sm" icon="refresh" onClick={() => handleReturnToActivity(dress)}>החזרה לפעילות</Btn>
            ) : (
              isHeadManagement && <Btn variant="danger" size="sm" icon="trash" onClick={() => handleDeleteModel(dress.id)}>מחיקה</Btn>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <V3Page>
      <header className="v3-pagehead">
        <div className="v3-pagehead__title">
          <h1 className="v3-h1">קטלוג הדגמים</h1>
          <Tip>כאן מנהלים את דגמי השמלות. הסינון והמיון נשמרים רק עד שעוזבים את העמוד.</Tip>
        </div>
        <div className="v3-pagehead__tools">
          <Btn
            icon="list"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            aria-pressed={showAdvancedFilters}
            aria-expanded={showAdvancedFilters}
          >
            סינון מפורט
          </Btn>
          {isHeadManagement && (
            <Btn variant="primary" icon="plus" onClick={() => router.push('/dashboard/dresses/new')}>
              דגם חדש
            </Btn>
          )}
        </div>
      </header>
      <p className="v3-muted">נמצאו <bdi>{totalDresses}</bdi> דגמים</p>

      {/* סרגל חיפוש: מקביל להתנהגות ה-AISearchBar הישן על הדף הזה — חיפוש טקסט חופשי בלבד
          (ללא חיפוש AI/סטטיסטיקה מחוברים בפועל בדף המקורי), עם ניקוי מיידי */}
      <div className="v3-filter-bar">
        <label className="v3-search">
          <Icon name="search" />
          <span className="v3-sr">חיפוש דגם</span>
          <input
            type="text"
            placeholder="שם, קוד או מידה"
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
          />
          <button type="button" className={catalogSearch ? 'v3-search__clear is-on' : 'v3-search__clear'} aria-label="ניקוי החיפוש" onClick={() => setCatalogSearch('')}>
            <Icon name="x" size="sm" />
          </button>
        </label>
      </div>

      {/* סינון סטטוס: פעילים / לא פעילים / מחוקים / הכל */}
      <Seg
        label="סטטוס הדגמים"
        value={filterStatus}
        onChange={setFilterStatus}
        options={[
          { value: 'active', label: 'פעילים', icon: 'check-circle' },
          { value: 'inactive', label: 'לא פעילים', icon: 'x-circle' },
          { value: 'deleted', label: 'מחוקים', icon: 'trash' },
          { value: 'all', label: 'הכול', icon: 'list' },
        ]}
      />

      {showAdvancedFilters && (
        <Card title="סינון מפורט" icon="list" level={2}>
          <div className="v3-stack">
            <Field id="dresses-filter-name" label="שם דגם או קוד" type="text" value={advancedFilters.name} onChange={e => setAdvancedFilters({ ...advancedFilters, name: e.target.value })} />
            <Field id="dresses-filter-size" label="מידה" type="text" value={advancedFilters.size} onChange={e => setAdvancedFilters({ ...advancedFilters, size: e.target.value })} />
            <Field id="dresses-filter-serial" label="מספר סידורי" type="number" value={advancedFilters.serialNumber} onChange={e => setAdvancedFilters({ ...advancedFilters, serialNumber: e.target.value })} />
            <Field id="dresses-filter-rentals-min" label="לפחות כמה השכרות" type="number" value={advancedFilters.rentalsCountMin} onChange={e => setAdvancedFilters({ ...advancedFilters, rentalsCountMin: e.target.value })} />
            <Switch id="dresses-filter-not-in-use" label="פריטים שאינם בשימוש" checked={advancedFilters.notInUse} onChange={(v) => setAdvancedFilters({ ...advancedFilters, notInUse: v })} />
            <Switch id="dresses-filter-in-repair" label="פריטים בתיקון" checked={advancedFilters.inRepair} onChange={(v) => setAdvancedFilters({ ...advancedFilters, inRepair: v })} />
            <Switch id="dresses-filter-item-deleted" label="פריטים שנמחקו" checked={advancedFilters.itemDeleted} onChange={(v) => setAdvancedFilters({ ...advancedFilters, itemDeleted: v })} />
            <div>
              <Btn variant="quiet" icon="x" onClick={clearAdvanced}>ניקוי הסינון</Btn>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="v3-empty" role="status"><Icon name="loader" size="xl" loop /><p className="v3-empty__text">טוענים דגמים…</p></div>
      ) : (
        <div className="v3-stack">
          {filteredDresses.length === 0 ? (
            <Empty icon="search" title="לא נמצאו דגמים" text="נסו לשנות את הסינון או להוסיף דגם חדש." />
          ) : (
            <Table
              columns={columns}
              rows={filteredDresses}
              rowKey="id"
              sort={{ key: catalogSort.key, dir: catalogSort.direction }}
              onSort={handleCatalogSort}
              caption="קטלוג הדגמים"
            />
          )}

          <div className="v3-cluster">
            <span className="v3-muted">מוצגים <bdi>{loading ? '...' : filteredDresses.length}</bdi> דגמים</span>
            {totalPages > 1 && (
              <div className="v3-cluster">
                <Btn size="sm" icon="chevron-end" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>הקודם</Btn>
                <Field
                  id="dresses-page-num"
                  label="עמוד"
                  type="number"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                  hint={<>מתוך <bdi>{totalPages}</bdi> (<bdi>{totalDresses}</bdi> דגמים בסך הכול)</>}
                />
                <Btn size="sm" iconEnd="chevron-start" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>הבא</Btn>
              </div>
            )}
          </div>
        </div>
      )}
      {dialogs}
    </V3Page>
  );
}
