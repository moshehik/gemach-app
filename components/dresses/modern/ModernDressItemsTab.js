'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModernDressItemModal from './ModernDressItemModal';
import { Btn, IconBtn, Card, Chip, Tag, Badge, Field, Row, Seg, Tip, Dialog, Empty, Icon } from '@/app/v3/ui/components';
import { v3Toast } from '@/app/v3/notify';

const STATUS_FILTERS = [
  { id: 'all', label: 'הכל' },
  { id: 'normal', label: 'תקין' },
  { id: 'attention', label: 'לטיפול' },
  { id: 'repair', label: 'בתיקון' },
  { id: 'unused', label: 'לא בשימוש' },
  { id: 'deleted', label: 'נמחק' }
];

const statusOf = (it) => it.isDeleted ? 'deleted' : it.notInUse ? 'unused' : it.inRepair ? 'repair' : 'normal';

const SortIcon = ({ sort, colKey }) => {
  if (sort.key !== colKey) return <Icon name="sort" size="sm" anim={false} />;
  return (
    <Icon
      name="chevron-down"
      size="sm"
      anim={false}
      className="is-on"
      style={{ transform: sort.direction === 'desc' ? 'rotate(180deg)' : 'none' }}
    />
  );
};

// כיווץ רשימת מספרים סידוריים לטווחים: 1,2,3,5 ⟵ "1-3, 5"
const serialRanges = (serials) => {
  const nums = serials.map(s => parseInt(s, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (!nums.length) return '';
  const out = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    if (nums[i] === prev + 1) { prev = nums[i]; continue; }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = nums[i];
    prev = nums[i];
  }
  return out.join(', ');
};

/**
 * טאב "פריטים ומלאי".
 *
 * שורה בטבלה היא לקריאה בלבד — עריכה נפתחת רק מאייקון העיפרון, ואז העיפרון
 * מתחלף באייקון שמירה לצד אייקון ביטול. מידה ומספר סידורי נעולים תמיד לפריט
 * קיים (הם מרכיבים את הברקוד ואת הזהות ההיסטורית של הפריט).
 */
export default function ModernDressItemsTab({
  dress,
  items,
  locations,
  getLabel,
  onItemsChange,
  externalFilter,
  highlightBarcode,
  onHighlightHandled
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [colFilters, setColFilters] = useState({ sizeText: '', serialNumber: '', dressBarcode: '', location: '' });
  const [showColFilters, setShowColFilters] = useState(false);
  const [sort, setSort] = useState({ key: 'sizeText', direction: 'asc' });
  const [viewMode, setViewMode] = useState('rows');

  const [page, setPage] = useState(1);
  const limit = 50;

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rowSaving, setRowSaving] = useState(false);
  const [rowError, setRowError] = useState('');
  const [quickMovingId, setQuickMovingId] = useState(null);
  const [quickCartonSavingId, setQuickCartonSavingId] = useState(null);

  const [newItem, setNewItem] = useState({ sizeText: '', serialNumber: '', dressBarcode: '', location: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [showAddBar, setShowAddBar] = useState(false);

  const [infoItem, setInfoItem] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const rowRefs = useRef({});

  // חלוניות v3 במקום customConfirm / customPrompt — אותו זרם await: ההבטחה
  // נפתרת ב-true/false (אישור) או במחרוזת/null (הזנת טקסט), כמו החלונות הישנים.
  const [dlg, setDlg] = useState(null);
  const dlgRef = useRef(null);
  const openDlg = (cfg) => new Promise((resolve) => {
    const d = { ...cfg, resolve };
    dlgRef.current = d;
    setDlg(d);
  });
  const closeDlg = (result) => {
    const d = dlgRef.current;
    if (!d) return;
    dlgRef.current = null;
    setDlg(null);
    d.resolve(result);
  };
  const askConfirm = (cfg) => openDlg({ kind: 'confirm', ...cfg });
  const askText = (cfg) => openDlg({ kind: 'text', ...cfg });

  const prefix = dress?.barcodePrefix != null ? String(dress.barcodePrefix) : '';

  // סינון חיצוני (אייקון המלאי בטופ-בר / סריקת ברקוד) מגיע דרך הכרטיס
  useEffect(() => {
    if (externalFilter) setStatusFilter(externalFilter);
  }, [externalFilter]);

  // סריקת ברקוד בסיידבר — איתור הפריט, הדגשתו וגלילה אליו
  useEffect(() => {
    if (!highlightBarcode) return;
    const found = items.find(i => (i.dressBarcode || '').trim() === highlightBarcode.trim());
    if (found) {
      setStatusFilter('all');
      setSearch('');
      setHighlightId(found.id);
      setTimeout(() => {
        rowRefs.current[found.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 60);
      setTimeout(() => setHighlightId(null), 2600);
    }
    onHighlightHandled?.(!!found, highlightBarcode);
  }, [highlightBarcode]);

  const counts = useMemo(() => {
    const c = { all: items.length, normal: 0, repair: 0, unused: 0, deleted: 0, attention: 0 };
    items.forEach(i => {
      c[statusOf(i)]++;
      if (!i.isDeleted && (i.inRepair || i.notInUse)) c.attention++;
    });
    return c;
  }, [items]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter(it => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'attention') return !it.isDeleted && (it.inRepair || it.notInUse);
        return statusOf(it) === statusFilter;
      })
      .filter(it => {
        if (!term) return true;
        return [it.sizeText, it.serialNumber, it.dressBarcode, it.location]
          .some(v => v != null && String(v).toLowerCase().includes(term));
      })
      .filter(it => {
        const check = (field, val) => !val || (it[field] != null && String(it[field]).toLowerCase().includes(val.toLowerCase()));
        return check('sizeText', colFilters.sizeText)
          && check('serialNumber', colFilters.serialNumber)
          && check('dressBarcode', colFilters.dressBarcode)
          && check('location', colFilters.location);
      })
      .sort((a, b) => {
        const dir = sort.direction === 'asc' ? 1 : -1;
        const av = a[sort.key];
        const bv = b[sort.key];
        if (typeof av === 'boolean' || typeof bv === 'boolean') return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
        const an = Number(av);
        const bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '' && av != null && bv != null) return (an - bn) * dir;
        return String(av ?? '').localeCompare(String(bv ?? ''), 'he') * dir;
      });
  }, [items, statusFilter, search, colFilters, sort]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, colFilters, sort]);

  const totalPages = Math.ceil(visibleItems.length / limit) || 1;
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return visibleItems.slice(start, start + limit);
  }, [visibleItems, page]);

  const itemsBySize = useMemo(() => {
    const map = {};
    visibleItems.forEach(it => {
      let size = (it.sizeText || '').trim() || 'ללא מידה';
      if (size !== 'ללא מידה' && !isNaN(size)) size = parseInt(size, 10).toString();
      (map[size] = map[size] || []).push(it);
    });
    return map;
  }, [visibleItems]);

  const handleSort = (key) => {
    setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // ===== עריכת שורה =====
  // הברקוד אינו ניתן לעריכה: הוא נגזר מקוד הדגם + מידה + מס' סידורי, ומשמש
  // כמפתח הסריקה בהשכרות ובהחזרות. שינוי שלו היה מנתק פריט מההיסטוריה שלו.
  const startEdit = (item) => {
    setRowError('');
    setEditingId(item.id);
    setDraft({
      location: item.location || '',
      cartonNumber: item.cartonNumber || '',
      inRepair: !!item.inRepair,
      notInUse: !!item.notInUse,
      notInUseReason: item.notInUseReason || ''
    });
  };

  // הפעלת "לא בשימוש" תמיד עוברת דרך בקשת סיבה (חלון כתיבה חופשי) - כמו הדפוס
  // הקיים ב"דיווח על בעיה" בהחזרות. ביטול הסימון מנקה את הסיבה הישנה.
  const toggleNotInUse = async () => {
    if (draft.notInUse) {
      setDraft({ ...draft, notInUse: false, notInUseReason: '' });
      return;
    }
    const reason = await askText({
      title: 'סימון "לא בשימוש"',
      label: 'מה הסיבה? אפשר להשאיר ריק.',
      value: draft.notInUseReason || ''
    });
    if (reason === null) return; // בוטל - הסימון לא משתנה
    setDraft({ ...draft, notInUse: true, inRepair: false, notInUseReason: reason.trim() });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setRowError('');
  };

  const saveEdit = async (item) => {
    if (rowSaving) return;
    setRowSaving(true);
    setRowError('');
    try {
      const payload = {
        location: draft.location || null,
        cartonNumber: draft.cartonNumber || null,
        inRepair: draft.inRepair,
        notInUse: draft.notInUse,
        notInUseSince: draft.notInUse ? (item.notInUseSince || new Date().toISOString()) : null,
        notInUseReason: draft.notInUse ? (draft.notInUseReason || null) : null
      };
      const res = await fetch(`/api/dresses/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(data.error || 'שגיאה בשמירת הפריט');
        return;
      }
      onItemsChange(items.map(i => i.id === item.id ? { ...i, ...data } : i));
      cancelEdit();
    } catch (err) {
      console.error(err);
      setRowError('שגיאה בתקשורת עם השרת');
    } finally {
      setRowSaving(false);
    }
  };

  // העברה מהירה למחסן/לחנות - קיצור דרך לשינוי מיקום בלבד, בלי לפתוח את מצב
  // העריכה המלאה של השורה (משתמש באותו endpoint ששמירת השורה משתמשת בו).
  const quickSetLocation = async (item, location) => {
    if (quickMovingId) return;
    setQuickMovingId(item.id);
    try {
      const res = await fetch(`/api/dresses/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location })
      });
      const data = await res.json();
      if (!res.ok) {
        v3Toast(data.error || 'שגיאה בעדכון מיקום', 'error');
        return;
      }
      onItemsChange(items.map(i => i.id === item.id ? { ...i, ...data } : i));
    } catch (err) {
      console.error(err);
      v3Toast('שגיאה בתקשורת עם השרת', 'error');
    } finally {
      setQuickMovingId(null);
    }
  };

  // עדכון מהיר של מספר קרטון - כמו quickSetLocation, בלי לפתוח מצב עריכה מלאה
  // (התבקש כי מיקום ניתן לשינוי מהיר דרך הבורר, אבל מספר קרטון היה נעול לעריכה מלאה בלבד).
  const quickSetCartonNumber = async (item, value) => {
    const trimmed = (value || '').trim();
    if (trimmed === (item.cartonNumber || '')) return;
    if (quickCartonSavingId) return;
    setQuickCartonSavingId(item.id);
    try {
      const res = await fetch(`/api/dresses/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartonNumber: trimmed || null })
      });
      const data = await res.json();
      if (!res.ok) {
        v3Toast(data.error || 'שגיאה בעדכון מספר קרטון', 'error');
        return;
      }
      onItemsChange(items.map(i => i.id === item.id ? { ...i, ...data } : i));
    } catch (err) {
      console.error(err);
      v3Toast('שגיאה בתקשורת עם השרת', 'error');
    } finally {
      setQuickCartonSavingId(null);
    }
  };

  // ===== מחיקה / שחזור =====
  const deleteItem = async (item) => {
    if (!(await askConfirm({
      title: 'למחוק את הפריט?',
      sub: <bdi>{item.dressBarcode || ''}</bdi>,
      icon: 'trash',
      danger: true,
      confirmLabel: 'מחיקה'
    }))) return;
    try {
      const res = await fetch(`/api/dresses/items/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        onItemsChange(items.map(i => i.id === item.id ? { ...i, isDeleted: true } : i));
      } else {
        const data = await res.json().catch(() => null);
        v3Toast((data && data.error) || 'שגיאה במחיקת הפריט', 'error');
      }
    } catch (err) {
      console.error(err);
      v3Toast('שגיאה בתקשורת', 'error');
    }
  };

  const restoreItem = async (item) => {
    if (!(await askConfirm({
      title: 'לשחזר את הפריט?',
      sub: <bdi>{item.dressBarcode || ''}</bdi>,
      icon: 'refresh',
      confirmLabel: 'שחזור'
    }))) return;
    try {
      const res = await fetch(`/api/dresses/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      const data = await res.json();
      if (res.ok) {
        onItemsChange(items.map(i => i.id === item.id ? { ...i, ...data } : i));
      } else {
        v3Toast(data.error || 'שגיאה בשחזור הפריט', 'error');
      }
    } catch (err) {
      console.error(err);
      v3Toast('שגיאה בתקשורת', 'error');
    }
  };

  // ===== הוספת פריט =====
  const nextSerialFor = (size) => {
    const same = items.filter(i => String(i.sizeText || '').trim() === String(size).trim() && i.serialNumber != null);
    return same.length ? Math.max(...same.map(i => parseInt(i.serialNumber, 10) || 0)) + 1 : 1;
  };

  const buildBarcode = (size, serial) =>
    `${prefix}${String(size).padStart(2, '0')}${String(serial).padStart(2, '0')}`;

  const changeNewItem = (field, value) => {
    setAddError('');
    setNewItem(prev => {
      const next = { ...prev, [field]: value };
      // הברקוד תמיד נגזר ולא מוזן — כדי שלא ייווצרו ברקודים שלא תואמים לקוד/מידה/סידורי
      const size = next.sizeText;
      const serial = next.serialNumber;
      next.dressBarcode = size ? buildBarcode(size, serial || nextSerialFor(size)) : '';
      return next;
    });
  };

  const addItem = async () => {
    if (adding) return;
    const size = String(newItem.sizeText || '').trim();
    if (!size) { setAddError('חובה להזין מידה'); return; }
    const sizeNum = Number(size);
    if (!isNaN(sizeNum) && (sizeNum < 0 || sizeNum > 99 || !Number.isInteger(sizeNum))) {
      setAddError('מידה חייבת להיות מספר שלם בין 0 ל-99');
      return;
    }

    const serial = newItem.serialNumber || nextSerialFor(size);
    const payload = {
      sizeText: size,
      serialNumber: serial,
      dressBarcode: newItem.dressBarcode || buildBarcode(size, serial),
      location: newItem.location || (locations && locations[0]) || null,
      barcodePrefix: dress.barcodePrefix,
      dressName: dress.name,
      entryDateToRepo: new Date().toISOString()
    };

    setAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/dresses/${dress.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'שגיאה בהוספת הפריט');
        return;
      }
      onItemsChange([...items, data]);
      setNewItem({ sizeText: '', serialNumber: '', dressBarcode: '', location: newItem.location });
    } catch (err) {
      console.error(err);
      setAddError('שגיאה בתקשורת');
    } finally {
      setAdding(false);
    }
  };

  const addItemForSize = (size) => {
    const serial = nextSerialFor(size);
    setNewItem({ sizeText: String(size), serialNumber: String(serial), dressBarcode: buildBarcode(size, serial), location: newItem.location });
    setShowAddBar(true);
    setViewMode('rows');
  };

  const sortAria = (key) => (sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
  const sortTh = (colKey, children) => (
    <th scope="col" aria-sort={sortAria(colKey)}>
      <button type="button" className="v3-th-btn" onClick={() => handleSort(colKey)}>
        {children}<SortIcon sort={sort} colKey={colKey} />
      </button>
    </th>
  );
  const rowMark = { background: 'var(--v3-gold-a14)' };

  return (
    <>
      {/* ===== סינון / חיפוש / תצוגה ===== */}
      <div className="v3-filter-bar">
        <Seg
          label="סינון לפי מצב"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ flexWrap: 'wrap' }}
          options={STATUS_FILTERS.map(f => ({ value: f.id, label: <>{f.label} <bdi>{counts[f.id] ?? 0}</bdi></> }))}
        />

        <div className="v3-search">
          <Icon name="search" />
          <label htmlFor="dress-items-search" className="v3-sr">חיפוש פריטים</label>
          <input
            id="dress-items-search"
            type="text"
            placeholder="מידה, סידורי, ברקוד או מיקום"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <span className="v3-cluster">
          <IconBtn
            icon="category"
            label="סינון לפי עמודות"
            title="סינון לפי עמודות"
            aria-pressed={showColFilters}
            variant={showColFilters ? 'primary' : 'secondary'}
            onClick={() => setShowColFilters(v => !v)}
          />
          <Tip label="על סינון העמודות">סינון לפי עמודה נפרד מהסינון לפי מצב שבכפתורים למעלה.</Tip>
        </span>

        <Btn
          size="sm"
          variant={showAddBar ? 'secondary' : 'primary'}
          icon="plus"
          onClick={() => { setShowAddBar(v => !v); setAddError(''); }}
        >
          פריט חדש
        </Btn>

        <Seg
          label="סוג תצוגה"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'rows', label: 'רשימה', icon: 'list' },
            { value: 'cubes', label: 'לפי מידה', icon: 'grid' }
          ]}
        />
      </div>

      {/* ===== הוספת פריט — נפתח מ"פריט חדש" ===== */}
      {showAddBar && (
        <Card
          title="פריט חדש"
          icon="plus"
          className="v3-stack"
          actions={<IconBtn icon="x" label="סגירה" variant="quiet" size="sm" onClick={() => { setShowAddBar(false); setAddError(''); }} />}
        >
          <Field
            id="dress-items-newsize"
            label={getLabel ? getLabel('item_size', 'מידה') : 'מידה'}
            required
            type="number"
            min="0"
            max="99"
            placeholder="38"
            autoFocus
            value={newItem.sizeText}
            onChange={e => changeNewItem('sizeText', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          />
          <Field
            id="dress-items-newserial"
            label={getLabel ? getLabel('item_serialNumber', "מס' סידורי") : "מס' סידורי"}
            type="number"
            min="0"
            max="99"
            placeholder="אוטומטי"
            value={newItem.serialNumber}
            onChange={e => changeNewItem('serialNumber', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          />
          <Field
            id="dress-items-newloc"
            as="select"
            label="מיקום"
            value={newItem.location}
            onChange={e => changeNewItem('location', e.target.value)}
          >
            <option value="">בחירת מיקום</option>
            {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
          </Field>
          <div className="v3-cluster">
            <Chip icon="tag">
              {getLabel ? getLabel('item_barcode', 'ברקוד פריט') : 'ברקוד פריט'}: <bdi>{newItem.dressBarcode || `${prefix}____`}</bdi>
            </Chip>
            <Tip label="על הברקוד">הברקוד נוצר לבד: קוד הדגם, אחריו המידה ואחריה המספר הסידורי.</Tip>
          </div>
          <div className="v3-cluster">
            <Btn variant="primary" icon="plus" loading={adding} onClick={addItem}>
              {adding ? 'מוסיף' : 'הוספה'}
            </Btn>
          </div>
          {addError && <div className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{addError}</div>}
        </Card>
      )}

      {/* ===== תצוגת רשימה ===== */}
      {viewMode === 'rows' ? (
        visibleItems.length === 0 ? (
          <Empty icon="box" text="אין פריטים בסינון הזה." />
        ) : (
          <div className="v3-stack">
            <div className="v3-table__wrap">
              <table className="v3-table">
                <caption className="v3-sr">פריטי הדגם</caption>
                <thead>
                  <tr>
                    {sortTh('sizeText', getLabel ? getLabel('item_size', 'מידה') : 'מידה')}
                    {sortTh('serialNumber', getLabel ? getLabel('item_serialNumber', "מס' סידורי") : "מס' סידורי")}
                    {sortTh('dressBarcode', getLabel ? getLabel('item_barcode', 'ברקוד פריט') : 'ברקוד פריט')}
                    {sortTh('location', 'מיקום')}
                    <th scope="col">מס&apos; קרטון</th>
                    {sortTh('inRepair', 'בתיקון')}
                    {sortTh('notInUse', 'לא בשימוש')}
                    <th scope="col"><span className="v3-sr">פעולות</span></th>
                  </tr>

                  {showColFilters && (
                    <tr>
                      <td><input className="v3-input" type="text" aria-label="סינון לפי מידה" placeholder="מידה" value={colFilters.sizeText} onChange={e => setColFilters({ ...colFilters, sizeText: e.target.value })} /></td>
                      <td><input className="v3-input" type="text" aria-label="סינון לפי מספר סידורי" placeholder="סידורי" value={colFilters.serialNumber} onChange={e => setColFilters({ ...colFilters, serialNumber: e.target.value })} /></td>
                      <td><input className="v3-input" type="text" aria-label="סינון לפי ברקוד" placeholder="ברקוד" value={colFilters.dressBarcode} onChange={e => setColFilters({ ...colFilters, dressBarcode: e.target.value })} /></td>
                      <td><input className="v3-input" type="text" aria-label="סינון לפי מיקום" placeholder="מיקום" value={colFilters.location} onChange={e => setColFilters({ ...colFilters, location: e.target.value })} /></td>
                      <td colSpan={4} />
                    </tr>
                  )}
                </thead>

                <tbody>
                  {paginatedItems.map(item => {
                    const isEditing = editingId === item.id;
                    const rowStatus = statusOf(item);
                    const marked = rowStatus === 'deleted' || highlightId === item.id;

                    const repairOn = isEditing ? draft.inRepair : item.inRepair;
                    const unusedOn = isEditing ? draft.notInUse : item.notInUse;

                    return (
                      <tr key={item.id} style={marked ? rowMark : undefined} ref={el => { rowRefs.current[item.id] = el; }}>
                        {/* מידה — נעול תמיד */}
                        <td><b><bdi>{item.sizeText || '—'}</bdi></b></td>

                        {/* מס' סידורי — נעול תמיד */}
                        <td className="v3-muted"><bdi>{item.serialNumber != null ? String(item.serialNumber).padStart(2, '0') : '—'}</bdi></td>

                        {/* ברקוד — נעול תמיד (נגזר מקוד הדגם + מידה + מס' סידורי) */}
                        <td>
                          <span className="v3-cluster">
                            <bdi>{item.dressBarcode || '—'}</bdi>
                            <Tip label="על הברקוד">הברקוד נקבע אוטומטית ואי אפשר לערוך אותו.</Tip>
                          </span>
                        </td>

                        {/* מיקום */}
                        <td>
                          {isEditing ? (
                            <select
                              className="v3-input"
                              aria-label="מיקום"
                              value={draft.location}
                              onChange={e => setDraft({ ...draft, location: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') cancelEdit(); }}
                              autoFocus
                            >
                              {!draft.location && <option value="" disabled hidden>---</option>}
                              {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                            </select>
                          ) : (
                            <select
                              className="v3-input"
                              aria-label="מיקום"
                              value={item.location || ''}
                              disabled={quickMovingId === item.id || item.isDeleted}
                              onChange={e => e.target.value && quickSetLocation(item, e.target.value)}
                            >
                              {!item.location && <option value="" disabled hidden>---</option>}
                              {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                            </select>
                          )}
                        </td>

                        {/* מספר קרטון */}
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="v3-input"
                              aria-label="מספר קרטון"
                              value={draft.cartonNumber}
                              onChange={e => setDraft({ ...draft, cartonNumber: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') cancelEdit(); }}
                            />
                          ) : (
                            <input
                              type="text"
                              className="v3-input"
                              aria-label="מספר קרטון"
                              defaultValue={item.cartonNumber || ''}
                              key={item.cartonNumber || ''}
                              disabled={quickCartonSavingId === item.id || item.isDeleted}
                              onBlur={e => quickSetCartonNumber(item, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                            />
                          )}
                        </td>

                        {/* בתיקון */}
                        <td>
                          {isEditing ? (
                            <Chip
                              variant={repairOn ? 'attn' : undefined}
                              icon="alert-tri"
                              aria-pressed={!!repairOn}
                              title="החלפת סימון בתיקון"
                              onClick={() => setDraft({ ...draft, inRepair: !draft.inRepair, notInUse: !draft.inRepair ? false : draft.notInUse })}
                            >
                              {repairOn ? 'בתיקון' : 'לא בתיקון'}
                            </Chip>
                          ) : repairOn ? (
                            <Tag variant="attn" icon="alert-tri">בתיקון</Tag>
                          ) : (
                            <span className="v3-faint">—</span>
                          )}
                        </td>

                        {/* לא בשימוש */}
                        <td>
                          {isEditing ? (
                            <div className="v3-cluster">
                              <Chip
                                variant={unusedOn ? 'attn' : undefined}
                                icon="x-circle"
                                aria-pressed={!!unusedOn}
                                title="החלפת סימון לא בשימוש"
                                onClick={toggleNotInUse}
                              >
                                {unusedOn ? 'לא בשימוש' : 'בשימוש'}
                              </Chip>
                              {unusedOn && (
                                <IconBtn
                                  icon="edit"
                                  label={draft.notInUseReason ? `עריכת הסיבה: ${draft.notInUseReason}` : 'הוספת סיבה'}
                                  title={draft.notInUseReason ? `עריכת הסיבה: ${draft.notInUseReason}` : 'הוספת סיבה'}
                                  variant="quiet"
                                  size="sm"
                                  onClick={async () => {
                                    const reason = await askText({
                                      title: 'סיבה לאי-שימוש',
                                      label: 'למה הפריט לא בשימוש? אפשר להשאיר ריק.',
                                      value: draft.notInUseReason || ''
                                    });
                                    if (reason === null) return;
                                    setDraft({ ...draft, notInUseReason: reason.trim() });
                                  }}
                                />
                              )}
                            </div>
                          ) : unusedOn ? (
                            <div className="v3-stack" style={{ gap: 'var(--v3-sp-1)' }}>
                              <Tag variant="attn" icon="x-circle">לא בשימוש</Tag>
                              <span className="v3-hint">{item.notInUseReason ? item.notInUseReason : 'ללא סיבה'}</span>
                            </div>
                          ) : (
                            <span className="v3-faint">—</span>
                          )}
                        </td>

                        {/* פעולות */}
                        <td>
                          <div className="v3-cluster">
                            {isEditing ? (
                              <>
                                <IconBtn
                                  icon="check"
                                  label="שמירת השורה"
                                  title="שמירת השורה"
                                  variant="primary"
                                  size="sm"
                                  loading={rowSaving}
                                  onClick={() => saveEdit(item)}
                                />
                                <IconBtn
                                  icon="x"
                                  label="ביטול העריכה"
                                  title="ביטול העריכה (Esc)"
                                  variant="quiet"
                                  size="sm"
                                  onClick={cancelEdit}
                                  disabled={rowSaving}
                                />
                              </>
                            ) : (
                              <>
                                <IconBtn
                                  icon="edit"
                                  label="עריכת הפריט"
                                  title="עריכת הפריט"
                                  variant="quiet"
                                  size="sm"
                                  onClick={() => startEdit(item)}
                                  disabled={item.isDeleted}
                                />
                                <IconBtn
                                  icon="info"
                                  label="פרטי הפריט והשכרות"
                                  title="פרטי הפריט והשכרות"
                                  variant="quiet"
                                  size="sm"
                                  onClick={() => setInfoItem(item)}
                                />
                                {item.isDeleted ? (
                                  <IconBtn icon="refresh" label="שחזור הפריט" title="שחזור הפריט" variant="quiet" size="sm" onClick={() => restoreItem(item)} />
                                ) : (
                                  <IconBtn icon="trash" label="מחיקת הפריט" title="מחיקת הפריט" variant="danger" size="sm" onClick={() => deleteItem(item)} />
                                )}
                              </>
                            )}
                          </div>
                          {isEditing && rowError && (
                            <div className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{rowError}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* סך-הכל ועימוד */}
            <div className="v3-cluster">
              <span>מוצגים <bdi>{visibleItems.length}</bdi> פריטים</span>
              {totalPages > 1 && (
                <div className="v3-cluster">
                  <Btn size="sm" icon="chevron-end" title="העמוד הקודם" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>הקודם</Btn>
                  <span className="v3-cluster">
                    <label htmlFor="dress-items-page-num">עמוד</label>
                    <input
                      id="dress-items-page-num"
                      type="number"
                      className="v3-input"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                      style={{ width: 'calc(var(--v3-tap) * 1.5)', textAlign: 'center' }}
                    />
                    מתוך <bdi>{totalPages}</bdi>
                  </span>
                  <Btn size="sm" iconEnd="chevron-start" title="העמוד הבא" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>הבא</Btn>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        /* ===== תצוגה לפי מידה ===== */
        <div className="v3-grid">
          {Object.keys(itemsBySize)
            .sort((a, b) => (isNaN(a) || isNaN(b)) ? String(a).localeCompare(String(b), 'he') : a - b)
            .map(size => {
              const arr = itemsBySize[size];
              const ok = arr.filter(i => statusOf(i) === 'normal');
              const rep = arr.filter(i => statusOf(i) === 'repair').length;
              const un = arr.filter(i => statusOf(i) === 'unused').length;
              const del = arr.filter(i => statusOf(i) === 'deleted').length;
              const okSerials = serialRanges(ok.map(i => i.serialNumber));
              return (
                <Card
                  key={size}
                  level={3}
                  icon="shirt"
                  title={<>מידה <bdi>{size}</bdi></>}
                  actions={<Badge variant="neutral"><bdi>{arr.length}</bdi> פריטים</Badge>}
                  className="v3-stack"
                >
                  <div className="v3-cluster">
                    {ok.length > 0 && !rep && !un && !del
                      ? <Tag variant="done" icon="check-circle">הכול תקין</Tag>
                      : ok.length > 0 && <Tag variant="done" icon="check-circle">תקין <bdi>{ok.length}</bdi></Tag>}
                    {rep > 0 && <Tag variant="attn" icon="alert-tri">בתיקון <bdi>{rep}</bdi></Tag>}
                    {un > 0 && <Tag variant="attn" icon="x-circle">לא בשימוש <bdi>{un}</bdi></Tag>}
                    {del > 0 && <Tag variant="soft" icon="trash">נמחק <bdi>{del}</bdi></Tag>}
                  </div>

                  <Row label="מספרים סידוריים תקינים" icon="tag">
                    {okSerials ? <bdi>{okSerials}</bdi> : <span className="v3-faint">אין פריטים תקינים</span>}
                  </Row>

                  {size !== 'ללא מידה' && (
                    <Btn size="sm" icon="plus" block onClick={() => addItemForSize(size)}>הוספה במידה הזו</Btn>
                  )}
                </Card>
              );
            })}
        </div>
      )}

      {infoItem && <ModernDressItemModal item={infoItem} onClose={() => setInfoItem(null)} />}

      {/* ===== חלונית אישור (מחליפה customConfirm) ===== */}
      <Dialog
        open={dlg?.kind === 'confirm'}
        onClose={() => closeDlg(false)}
        variant="confirm"
        mode="light"
        icon={dlg?.icon}
        badgeKind={dlg?.danger ? 'danger' : undefined}
        title={dlg?.title}
        sub={dlg?.sub}
        actions={
          <>
            <Btn variant={dlg?.danger ? 'danger' : 'primary'} data-autofocus="" onClick={() => closeDlg(true)}>{dlg?.confirmLabel}</Btn>
            <Btn variant="quiet" onClick={() => closeDlg(false)}>ביטול</Btn>
          </>
        }
      />

      {/* ===== חלונית הזנת סיבה (מחליפה customPrompt) — טופס, בהיר בלבד ===== */}
      <Dialog
        open={dlg?.kind === 'text'}
        onClose={() => closeDlg(null)}
        variant="form"
        icon="edit"
        title={dlg?.title}
        actions={
          <>
            <Btn variant="primary" onClick={() => closeDlg(dlg?.value ?? '')}>אישור</Btn>
            <Btn variant="quiet" onClick={() => closeDlg(null)}>ביטול</Btn>
          </>
        }
      >
        <Field
          label={dlg?.label}
          type="text"
          data-autofocus=""
          value={dlg?.value ?? ''}
          onChange={e => setDlg(d => (d ? { ...d, value: e.target.value } : d))}
          onKeyDown={e => { if (e.key === 'Enter') closeDlg(dlg?.value ?? ''); }}
        />
      </Dialog>
    </>
  );
}
