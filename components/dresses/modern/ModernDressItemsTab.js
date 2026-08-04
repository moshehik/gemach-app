'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, X, Filter, List, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown,
  Info, Trash2, RefreshCw, Pencil, Save, Wrench, XCircle, CheckCircle2, Check, Package
} from 'lucide-react';
import ModernDressItemModal from './ModernDressItemModal';

const STATUS_FILTERS = [
  { id: 'all', label: 'הכל', icon: List, tone: 'blue' },
  { id: 'normal', label: 'תקין', icon: CheckCircle2, tone: 'green' },
  { id: 'attention', label: 'דורש טיפול', icon: Wrench, tone: 'orange' },
  { id: 'repair', label: 'בתיקון', icon: Wrench, tone: 'orange' },
  { id: 'unused', label: 'לא בשימוש', icon: XCircle, tone: 'red' },
  { id: 'deleted', label: 'מחוק', icon: Trash2, tone: 'red' }
];

const statusOf = (it) => it.isDeleted ? 'deleted' : it.notInUse ? 'unused' : it.inRepair ? 'repair' : 'normal';

const SortIcon = ({ sort, colKey }) => {
  if (sort.key !== colKey) return <ArrowUpDown className="moc-sort-ic" size={13} />;
  return sort.direction === 'asc'
    ? <ArrowUp className="moc-sort-ic" size={13} />
    : <ArrowDown className="moc-sort-ic" size={13} />;
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

  const [newItem, setNewItem] = useState({ sizeText: '', serialNumber: '', dressBarcode: '', location: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [infoItem, setInfoItem] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const rowRefs = useRef({});

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
      inRepair: !!item.inRepair,
      notInUse: !!item.notInUse
    });
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
        inRepair: draft.inRepair,
        notInUse: draft.notInUse,
        notInUseSince: draft.notInUse ? (item.notInUseSince || new Date().toISOString()) : null
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

  // ===== מחיקה / שחזור =====
  const deleteItem = async (item) => {
    if (!(await window.customConfirm(`האם למחוק את הפריט ${item.dressBarcode || ''}?`))) return;
    try {
      const res = await fetch(`/api/dresses/items/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        onItemsChange(items.map(i => i.id === item.id ? { ...i, isDeleted: true } : i));
      } else {
        const data = await res.json().catch(() => null);
        alert((data && data.error) || 'שגיאה במחיקת הפריט');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בתקשורת');
    }
  };

  const restoreItem = async (item) => {
    if (!(await window.customConfirm(`האם לשחזר את הפריט ${item.dressBarcode || ''}?`))) return;
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
        alert(data.error || 'שגיאה בשחזור הפריט');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בתקשורת');
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
    setViewMode('rows');
  };

  return (
    <>
      {/* ===== סרגל הוספה מהירה ===== */}
      <div className="moc-add-bar">
        <div className="moc-fld w-sm">
          <span className="moc-field-label">{getLabel ? getLabel('item_size', 'מידה') : 'מידה'} *</span>
          <input
            type="number"
            min="0"
            max="99"
            placeholder="38"
            value={newItem.sizeText}
            onChange={e => changeNewItem('sizeText', e.target.value)}
          />
        </div>
        <div className="moc-fld w-sm">
          <span className="moc-field-label">{getLabel ? getLabel('item_serialNumber', "מס' סידורי") : "מס' סידורי"}</span>
          <input
            type="number"
            min="0"
            max="99"
            placeholder="אוטומטי"
            value={newItem.serialNumber}
            onChange={e => changeNewItem('serialNumber', e.target.value)}
          />
        </div>
        <div className="moc-fld w-md">
          <span className="moc-field-label">{getLabel ? getLabel('item_barcode', 'ברקוד פריט') : 'ברקוד פריט'}</span>
          <input
            type="text"
            className="moc-mono"
            placeholder={`${prefix}____`}
            value={newItem.dressBarcode}
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
        <button className="moc-btn moc-btn-gold" onClick={addItem} disabled={adding}>
          {adding ? <><span className="moc-spinner" /> מוסיף...</> : <><Plus size={15} /> הוסף פריט</>}
        </button>
        <div className="moc-add-hint">
          {addError
            ? <span style={{ color: 'var(--moc-danger-text)', fontWeight: 700 }}>{addError}</span>
            : <>מס' סידורי וברקוד נבנים אוטומטית לפי המידה — הברקוד אינו ניתן לעריכה.</>}
        </div>
      </div>

      {/* ===== סרגל סינון / תצוגה / חיפוש ===== */}
      <div className="moc-table-toolbar">
        <div className="moc-filter-chips">
          {STATUS_FILTERS.map(f => {
            const Icon = f.icon;
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                className={`moc-pill-toggle ${active ? `on ${f.tone}` : ''}`}
                onClick={() => setStatusFilter(f.id)}
              >
                <Icon size={13} /> {f.label} <span className="moc-cnt">{counts[f.id] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="moc-icon-btn-plain"
            title="סינון לפי עמודות"
            style={{ width: '34px', height: '34px', color: showColFilters ? 'var(--moc-primary-dark)' : undefined }}
            onClick={() => setShowColFilters(v => !v)}
          >
            <Filter size={17} />
          </button>

          <div className="moc-toolbar-search">
            <span className="moc-ts-icon"><Search size={15} /></span>
            <input
              type="text"
              placeholder="חיפוש: מידה, מס' סידורי, ברקוד, מיקום..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="moc-icon-btn-plain moc-ts-clear" title="נקה חיפוש" onClick={() => setSearch('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <div className="moc-toggle-pair">
            <button className={`moc-opt ${viewMode === 'rows' ? 'active' : ''}`} onClick={() => setViewMode('rows')}>
              <List size={14} /> שורות
            </button>
            <button className={`moc-opt ${viewMode === 'cubes' ? 'active' : ''}`} onClick={() => setViewMode('cubes')}>
              <LayoutGrid size={14} /> קוביות
            </button>
          </div>
        </div>
      </div>

      {/* ===== תצוגת שורות ===== */}
      {viewMode === 'rows' ? (
        visibleItems.length === 0 ? (
          <div className="moc-empty-state">
            <Package size={30} />
            <div style={{ marginTop: '8px' }}>אין פריטים להצגה בסינון הנוכחי.</div>
          </div>
        ) : (
          <div className="moc-table-scroll">
            <table className="moc-data-table">
              <thead>
                <tr>
                  <th className={sort.key === 'sizeText' ? 'sorted' : ''}>
                    <span className="moc-th-inner" onClick={() => handleSort('sizeText')}>
                      {getLabel ? getLabel('item_size', 'מידה') : 'מידה'} <SortIcon sort={sort} colKey="sizeText" />
                    </span>
                  </th>
                  <th className={sort.key === 'serialNumber' ? 'sorted' : ''}>
                    <span className="moc-th-inner" onClick={() => handleSort('serialNumber')}>
                      {getLabel ? getLabel('item_serialNumber', "מס' סידורי") : "מס' סידורי"} <SortIcon sort={sort} colKey="serialNumber" />
                    </span>
                  </th>
                  <th className={sort.key === 'dressBarcode' ? 'sorted' : ''}>
                    <span className="moc-th-inner" onClick={() => handleSort('dressBarcode')}>
                      {getLabel ? getLabel('item_barcode', 'ברקוד פריט') : 'ברקוד פריט'} <SortIcon sort={sort} colKey="dressBarcode" />
                    </span>
                  </th>
                  <th className={sort.key === 'location' ? 'sorted' : ''}>
                    <span className="moc-th-inner" onClick={() => handleSort('location')}>
                      מיקום <SortIcon sort={sort} colKey="location" />
                    </span>
                  </th>
                  <th className={sort.key === 'inRepair' ? 'sorted' : ''}>
                    <span className="moc-th-inner" onClick={() => handleSort('inRepair')}>
                      בתיקון <SortIcon sort={sort} colKey="inRepair" />
                    </span>
                  </th>
                  <th className={sort.key === 'notInUse' ? 'sorted' : ''}>
                    <span className="moc-th-inner" onClick={() => handleSort('notInUse')}>
                      לא בשימוש <SortIcon sort={sort} colKey="notInUse" />
                    </span>
                  </th>
                  <th style={{ textAlign: 'center' }}>פעולות</th>
                </tr>

                {showColFilters && (
                  <tr className="moc-col-filter-row">
                    <td><input type="text" placeholder="סנן מידה" value={colFilters.sizeText} onChange={e => setColFilters({ ...colFilters, sizeText: e.target.value })} /></td>
                    <td><input type="text" placeholder="סנן מס'" value={colFilters.serialNumber} onChange={e => setColFilters({ ...colFilters, serialNumber: e.target.value })} /></td>
                    <td><input type="text" placeholder="סנן ברקוד" value={colFilters.dressBarcode} onChange={e => setColFilters({ ...colFilters, dressBarcode: e.target.value })} /></td>
                    <td><input type="text" placeholder="סנן מיקום" value={colFilters.location} onChange={e => setColFilters({ ...colFilters, location: e.target.value })} /></td>
                    <td colSpan={3} style={{ color: 'var(--moc-text-muted)', fontSize: '0.78rem' }}>
                      סינון לפי סטטוס — דרך הצ'יפים שמעל הטבלה
                    </td>
                  </tr>
                )}
              </thead>

              <tbody>
                {paginatedItems.map(item => {
                  const isEditing = editingId === item.id;
                  const rowStatus = statusOf(item);
                  const rowClass = [
                    `st-${rowStatus}`,
                    isEditing ? 'row-editing' : '',
                    highlightId === item.id ? 'row-editing' : ''
                  ].filter(Boolean).join(' ');

                  const repairOn = isEditing ? draft.inRepair : item.inRepair;
                  const unusedOn = isEditing ? draft.notInUse : item.notInUse;

                  return (
                    <tr key={item.id} className={rowClass} ref={el => { rowRefs.current[item.id] = el; }}>
                      {/* מידה — נעול תמיד */}
                      <td>
                        <span className="moc-size-pill">{item.sizeText || '—'}</span>
                      </td>

                      {/* מס' סידורי — נעול תמיד */}
                      <td className="moc-mono moc-locked-cell">
                        {item.serialNumber != null ? String(item.serialNumber).padStart(2, '0') : '—'}
                      </td>

                      {/* ברקוד — נעול תמיד (נגזר מקוד הדגם + מידה + מס' סידורי) */}
                      <td className="moc-mono moc-locked-cell" title="הברקוד נקבע אוטומטית ואינו ניתן לעריכה">
                        {item.dressBarcode || '—'}
                      </td>

                      {/* מיקום */}
                      <td>
                        {isEditing ? (
                          <select
                            className="moc-cell-select"
                            value={draft.location}
                            onChange={e => setDraft({ ...draft, location: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') cancelEdit(); }}
                            autoFocus
                          >
                            <option value="">--</option>
                            {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                          </select>
                        ) : (
                          <span>{item.location || '—'}</span>
                        )}
                      </td>

                      {/* בתיקון */}
                      <td>
                        <button
                          className={`moc-state-chip ${repairOn ? 'on-repair' : ''}`}
                          disabled={!isEditing}
                          title={isEditing ? 'שנה סימון "בתיקון"' : 'לעריכה — לחץ על אייקון העיפרון'}
                          onClick={() => setDraft({ ...draft, inRepair: !draft.inRepair, notInUse: !draft.inRepair ? false : draft.notInUse })}
                        >
                          {repairOn ? <><Wrench size={12} /> בתיקון</> : <><X size={12} /> לא</>}
                        </button>
                      </td>

                      {/* לא בשימוש */}
                      <td>
                        <button
                          className={`moc-state-chip ${unusedOn ? 'on-unused' : ''}`}
                          disabled={!isEditing}
                          title={isEditing ? 'שנה סימון "לא בשימוש"' : 'לעריכה — לחץ על אייקון העיפרון'}
                          onClick={() => setDraft({ ...draft, notInUse: !draft.notInUse, inRepair: !draft.notInUse ? false : draft.inRepair })}
                        >
                          {unusedOn ? <><XCircle size={12} /> לא בשימוש</> : <><Check size={12} /> בשימוש</>}
                        </button>
                      </td>

                      {/* פעולות */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div className="moc-row-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="moc-icon-btn-plain act-save"
                                title="שמור שינויים בשורה"
                                onClick={() => saveEdit(item)}
                                disabled={rowSaving}
                              >
                                {rowSaving ? <span className="moc-spinner" /> : <Save size={16} />}
                              </button>
                              <button
                                className="moc-icon-btn-plain act-cancel"
                                title="ביטול עריכה (Esc)"
                                onClick={cancelEdit}
                                disabled={rowSaving}
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="moc-icon-btn-plain act-edit"
                                title="עריכת הפריט (ברקוד, מיקום, סטטוס)"
                                onClick={() => startEdit(item)}
                                disabled={item.isDeleted}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="moc-icon-btn-plain"
                                title="פרטי פריט והיסטוריית השכרות"
                                onClick={() => setInfoItem(item)}
                              >
                                <Info size={16} />
                              </button>
                              {item.isDeleted ? (
                                <button className="moc-icon-btn-plain restore" title="שחזר פריט" onClick={() => restoreItem(item)}>
                                  <RefreshCw size={16} />
                                </button>
                              ) : (
                                <button className="moc-icon-btn-plain row-delete" title="מחק פריט" onClick={() => deleteItem(item)}>
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {isEditing && rowError && (
                          <div style={{ color: 'var(--moc-danger-text)', fontSize: '0.76rem', fontWeight: 700, marginTop: '4px', whiteSpace: 'normal' }}>
                            {rowError}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ===== תצוגת קוביות ===== */
        <div className="moc-cubes-grid">
          {Object.keys(itemsBySize)
            .sort((a, b) => (isNaN(a) || isNaN(b)) ? String(a).localeCompare(String(b), 'he') : a - b)
            .map(size => {
              const arr = itemsBySize[size];
              const ok = arr.filter(i => statusOf(i) === 'normal');
              const rep = arr.filter(i => statusOf(i) === 'repair').length;
              const un = arr.filter(i => statusOf(i) === 'unused').length;
              const del = arr.filter(i => statusOf(i) === 'deleted').length;
              return (
                <div key={size} className="moc-size-cube">
                  <h4>
                    מידה {size}
                    <span className="moc-badge on-white neutral">{arr.length} פריטים</span>
                  </h4>

                  <div className="moc-cube-chips">
                    {ok.length > 0 && !rep && !un && !del
                      ? <span className="moc-cube-chip ok">כל הפריטים תקינים</span>
                      : ok.length > 0 && <span className="moc-cube-chip ok">תקין: {ok.length}</span>}
                    {rep > 0 && <span className="moc-cube-chip repair">בתיקון: {rep}</span>}
                    {un > 0 && <span className="moc-cube-chip unused">לא בשימוש: {un}</span>}
                    {del > 0 && <span className="moc-cube-chip deleted">מחוק: {del}</span>}
                  </div>

                  <div className="moc-serial-box">
                    <div className="moc-sb-label">מספרים סידוריים (תקינים)</div>
                    <div className="moc-sb-value">
                      {serialRanges(ok.map(i => i.serialNumber)) || (
                        <span style={{ color: 'var(--moc-text-muted)', fontSize: '0.85rem', fontFamily: 'inherit' }}>אין פריטים תקינים</span>
                      )}
                    </div>
                  </div>

                  {size !== 'ללא מידה' && (
                    <button className="moc-btn moc-btn-outline moc-btn-sm" style={{ justifyContent: 'center' }} onClick={() => addItemForSize(size)}>
                      <Plus size={14} /> הוסף פריט למידה זו
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Pagination Footer */}
      {viewMode === 'rows' && visibleItems.length > 0 && (
        <div className="page-footer-bar" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'var(--card-bg)', borderTop: '1px solid var(--border-color)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 10px rgba(0,0,0,0.05)' }}>
          <div className="page-footer-summary">סה"כ פריטים מוצגים: {visibleItems.length}</div>
          
          {totalPages > 1 && (
            <div className="page-footer-pager" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>&lt; הקודם</button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                עמוד 
                <input type="number" min={1} max={totalPages} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} /> 
                מתוך {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>הבא &gt;</button>
            </div>
          )}
        </div>
      )}

      {infoItem && <ModernDressItemModal item={infoItem} onClose={() => setInfoItem(null)} />}
    </>
  );
}
