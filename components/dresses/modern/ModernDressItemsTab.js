'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModernDressItemModal from './ModernDressItemModal';

const STATUS_FILTERS = [
  { id: 'all', label: 'הכל' },
  { id: 'normal', label: 'תקין' },
  { id: 'attention', label: 'דורש טיפול' },
  { id: 'repair', label: 'בתיקון' },
  { id: 'unused', label: 'לא בשימוש' },
  { id: 'deleted', label: 'מחוק' }
];

const statusOf = (it) => it.isDeleted ? 'deleted' : it.notInUse ? 'unused' : it.inRepair ? 'repair' : 'normal';

const SortIcon = ({ sort, colKey }) => {
  if (sort.key !== colKey) return <svg className="icon"><use href="#i-sort" /></svg>;
  return (
    <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: sort.direction === 'desc' ? 'rotate(180deg)' : 'none' }}>
      <use href="#i-chevron-down" />
    </svg>
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

  const [newItem, setNewItem] = useState({ sizeText: '', serialNumber: '', dressBarcode: '', location: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [showAddBar, setShowAddBar] = useState(false);

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
    setShowAddBar(true);
    setViewMode('rows');
  };

  return (
    <>
      {/* ===== סרגל סינון / תצוגה / חיפוש ===== */}
      <div className="toolbar">
        <div className="pill-tabs">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`pill-tab${statusFilter === f.id ? ' active' : ''}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label} ({counts[f.id] ?? 0})
            </button>
          ))}
        </div>
        <div className="spacer" />

        <div className="input-icon-wrap" style={{ maxWidth: '260px' }}>
          <svg className="icon"><use href="#i-search" /></svg>
          <label htmlFor="dress-items-search" className="sr-only">חיפוש פריטים</label>
          <input
            id="dress-items-search"
            className="input"
            type="text"
            placeholder="חיפוש: מידה, מס' סידורי, ברקוד, מיקום..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-icon-only"
          title="סינון לפי עמודות"
          style={showColFilters ? { color: 'var(--primary-solid)' } : undefined}
          onClick={() => setShowColFilters(v => !v)}
        >
          <svg className="icon"><use href="#i-list" /></svg>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${showAddBar ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => { setShowAddBar(v => !v); setAddError(''); }}
        >
          <svg className="icon"><use href="#i-plus" /></svg>הוסף פריט
        </button>

        <div className="toggle-btn-group">
          <button type="button" className={viewMode === 'rows' ? 'on' : undefined} onClick={() => setViewMode('rows')}>
            <svg className="icon"><use href="#i-list" /></svg>שורות
          </button>
          <button type="button" className={viewMode === 'cubes' ? 'on' : undefined} onClick={() => setViewMode('cubes')}>
            <svg className="icon"><use href="#i-grid" /></svg>קוביות
          </button>
        </div>
      </div>

      {/* ===== סרגל הוספה — נפתח רק בלחיצה על "הוסף פריט" ===== */}
      {showAddBar && (
        <div className="card card-pad" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '13px' }}>הוספת פריט חדש</h3>
            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגור" onClick={() => { setShowAddBar(false); setAddError(''); }}>
              <svg className="icon"><use href="#i-x" /></svg>
            </button>
          </div>
          <div className="form-grid cols-3">
            <div className="field">
              <label htmlFor="dress-items-newsize">{getLabel ? getLabel('item_size', 'מידה') : 'מידה'} *</label>
              <input
                id="dress-items-newsize"
                className="input"
                type="number"
                min="0"
                max="99"
                placeholder="38"
                autoFocus
                value={newItem.sizeText}
                onChange={e => changeNewItem('sizeText', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              />
            </div>
            <div className="field">
              <label htmlFor="dress-items-newserial">{getLabel ? getLabel('item_serialNumber', "מס' סידורי") : "מס' סידורי"}</label>
              <input
                id="dress-items-newserial"
                className="input"
                type="number"
                min="0"
                max="99"
                placeholder="אוטומטי"
                value={newItem.serialNumber}
                onChange={e => changeNewItem('serialNumber', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
              />
            </div>
            <div className="field">
              <label htmlFor="dress-items-newloc">מיקום</label>
              <select id="dress-items-newloc" className="select" value={newItem.location} onChange={e => changeNewItem('location', e.target.value)}>
                <option value="">-- בחר מיקום --</option>
                {(locations || []).map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="chip" title="הברקוד נבנה אוטומטית מקוד הדגם + מידה + מס' סידורי">
              {getLabel ? getLabel('item_barcode', 'ברקוד פריט') : 'ברקוד פריט'} (אוטומטי): {newItem.dressBarcode || `${prefix}____`}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={addItem} disabled={adding}>
              {adding ? <><span className="spinner" />מוסיף...</> : <><svg className="icon"><use href="#i-plus" /></svg>הוסף</>}
            </button>
            {addError && <span className="error-text"><svg className="icon"><use href="#i-alert-circle" /></svg>{addError}</span>}
          </div>
        </div>
      )}

      {/* ===== תצוגת שורות ===== */}
      {viewMode === 'rows' ? (
        visibleItems.length === 0 ? (
          <div className="empty-state">
            <svg className="icon"><use href="#i-box" /></svg>
            <p>אין פריטים להצגה בסינון הנוכחי.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className={sort.key === 'sizeText' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('sizeText')}>
                    {getLabel ? getLabel('item_size', 'מידה') : 'מידה'} <SortIcon sort={sort} colKey="sizeText" />
                  </th>
                  <th className={sort.key === 'serialNumber' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('serialNumber')}>
                    {getLabel ? getLabel('item_serialNumber', "מס' סידורי") : "מס' סידורי"} <SortIcon sort={sort} colKey="serialNumber" />
                  </th>
                  <th className={sort.key === 'dressBarcode' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('dressBarcode')}>
                    {getLabel ? getLabel('item_barcode', 'ברקוד פריט') : 'ברקוד פריט'} <SortIcon sort={sort} colKey="dressBarcode" />
                  </th>
                  <th className={sort.key === 'location' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('location')}>
                    מיקום <SortIcon sort={sort} colKey="location" />
                  </th>
                  <th className={sort.key === 'inRepair' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('inRepair')}>
                    בתיקון <SortIcon sort={sort} colKey="inRepair" />
                  </th>
                  <th className={sort.key === 'notInUse' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('notInUse')}>
                    לא בשימוש <SortIcon sort={sort} colKey="notInUse" />
                  </th>
                  <th style={{ textAlign: 'center' }} />
                </tr>

                {showColFilters && (
                  <tr>
                    <td style={{ padding: '6px 10px' }}><input className="input" style={{ padding: '5px 8px', fontSize: '12px' }} type="text" placeholder="סנן מידה" value={colFilters.sizeText} onChange={e => setColFilters({ ...colFilters, sizeText: e.target.value })} /></td>
                    <td style={{ padding: '6px 10px' }}><input className="input" style={{ padding: '5px 8px', fontSize: '12px' }} type="text" placeholder="סנן מס'" value={colFilters.serialNumber} onChange={e => setColFilters({ ...colFilters, serialNumber: e.target.value })} /></td>
                    <td style={{ padding: '6px 10px' }}><input className="input" style={{ padding: '5px 8px', fontSize: '12px' }} type="text" placeholder="סנן ברקוד" value={colFilters.dressBarcode} onChange={e => setColFilters({ ...colFilters, dressBarcode: e.target.value })} /></td>
                    <td style={{ padding: '6px 10px' }}><input className="input" style={{ padding: '5px 8px', fontSize: '12px' }} type="text" placeholder="סנן מיקום" value={colFilters.location} onChange={e => setColFilters({ ...colFilters, location: e.target.value })} /></td>
                    <td colSpan={3} className="cell-muted" style={{ fontSize: '11.5px' }}>סינון לפי סטטוס — דרך הצ&apos;יפים שמעל הטבלה</td>
                  </tr>
                )}
              </thead>

              <tbody>
                {paginatedItems.map(item => {
                  const isEditing = editingId === item.id;
                  const rowStatus = statusOf(item);
                  const rowClass = (rowStatus === 'deleted' || highlightId === item.id) ? 'row-flag' : undefined;

                  const repairOn = isEditing ? draft.inRepair : item.inRepair;
                  const unusedOn = isEditing ? draft.notInUse : item.notInUse;

                  return (
                    <tr key={item.id} className={rowClass} ref={el => { rowRefs.current[item.id] = el; }}>
                      {/* מידה — נעול תמיד */}
                      <td className="cell-primary">{item.sizeText || '—'}</td>

                      {/* מס' סידורי — נעול תמיד */}
                      <td className="cell-muted">{item.serialNumber != null ? String(item.serialNumber).padStart(2, '0') : '—'}</td>

                      {/* ברקוד — נעול תמיד (נגזר מקוד הדגם + מידה + מס' סידורי) */}
                      <td title="הברקוד נקבע אוטומטית ואינו ניתן לעריכה">{item.dressBarcode || '—'}</td>

                      {/* מיקום */}
                      <td>
                        {isEditing ? (
                          <select
                            className="select"
                            style={{ padding: '6px 9px', fontSize: '12.5px' }}
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
                        {isEditing ? (
                          <button
                            type="button"
                            className={`pill-tab${repairOn ? ' active' : ''}`}
                            title='שנה סימון "בתיקון"'
                            onClick={() => setDraft({ ...draft, inRepair: !draft.inRepair, notInUse: !draft.inRepair ? false : draft.notInUse })}
                          >
                            {repairOn ? 'בתיקון' : 'לא'}
                          </button>
                        ) : repairOn ? (
                          <span className="badge badge-warning"><svg className="icon"><use href="#i-alert-tri" /></svg>בתיקון</span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>

                      {/* לא בשימוש */}
                      <td>
                        {isEditing ? (
                          <button
                            type="button"
                            className={`pill-tab${unusedOn ? ' active' : ''}`}
                            title='שנה סימון "לא בשימוש"'
                            onClick={() => setDraft({ ...draft, notInUse: !draft.notInUse, inRepair: !draft.notInUse ? false : draft.inRepair })}
                          >
                            {unusedOn ? 'לא בשימוש' : 'בשימוש'}
                          </button>
                        ) : unusedOn ? (
                          <span className="badge badge-danger"><svg className="icon"><use href="#i-x-circle" /></svg>לא בשימוש</span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>

                      {/* פעולות */}
                      <td>
                        <div className="row-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon-only btn-sm"
                                title="שמור שינויים בשורה"
                                onClick={() => saveEdit(item)}
                                disabled={rowSaving}
                              >
                                {rowSaving ? <span className="spinner" /> : <svg className="icon"><use href="#i-check" /></svg>}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon-only btn-sm"
                                title="ביטול עריכה (Esc)"
                                onClick={cancelEdit}
                                disabled={rowSaving}
                              >
                                <svg className="icon"><use href="#i-x" /></svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon-only btn-sm"
                                title="עריכת הפריט"
                                onClick={() => startEdit(item)}
                                disabled={item.isDeleted}
                              >
                                <svg className="icon"><use href="#i-edit" /></svg>
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon-only btn-sm"
                                title="פרטי פריט והיסטוריית השכרות"
                                onClick={() => setInfoItem(item)}
                              >
                                <svg className="icon"><use href="#i-info" /></svg>
                              </button>
                              {item.isDeleted ? (
                                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--success)' }} title="שחזר פריט" onClick={() => restoreItem(item)}>
                                  <svg className="icon"><use href="#i-refresh" /></svg>
                                </button>
                              ) : (
                                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--danger)' }} title="מחק פריט" onClick={() => deleteItem(item)}>
                                  <svg className="icon"><use href="#i-trash" /></svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {isEditing && rowError && (
                          <div className="error-text" style={{ marginTop: '4px' }}>{rowError}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* שורת סך-הכל ועימוד — צמודה לתחתית הטבלה */}
            <div className="table-foot">
              <span>סה&quot;כ פריטים מוצגים: {visibleItems.length}</span>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} title="עמוד קודם">
                    <svg className="icon"><use href="#i-chevron-end" /></svg>הקודם
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label htmlFor="dress-items-page-num">עמוד</label>
                    <input
                      id="dress-items-page-num"
                      type="number"
                      className="input"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                      style={{ width: '60px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                    />
                    מתוך {totalPages}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} title="עמוד הבא">
                    הבא<svg className="icon"><use href="#i-chevron-start" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        /* ===== תצוגת קוביות ===== */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {Object.keys(itemsBySize)
            .sort((a, b) => (isNaN(a) || isNaN(b)) ? String(a).localeCompare(String(b), 'he') : a - b)
            .map(size => {
              const arr = itemsBySize[size];
              const ok = arr.filter(i => statusOf(i) === 'normal');
              const rep = arr.filter(i => statusOf(i) === 'repair').length;
              const un = arr.filter(i => statusOf(i) === 'unused').length;
              const del = arr.filter(i => statusOf(i) === 'deleted').length;
              return (
                <div key={size} className="card card-pad">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary-tint)', paddingBottom: '8px', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary-solid)' }}>מידה {size}</h3>
                    <span className="badge badge-neutral">{arr.length} פריטים</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {ok.length > 0 && !rep && !un && !del
                      ? <span className="badge badge-success">כל הפריטים תקינים</span>
                      : ok.length > 0 && <span className="badge badge-success">תקין: {ok.length}</span>}
                    {rep > 0 && <span className="badge badge-warning">בתיקון: {rep}</span>}
                    {un > 0 && <span className="badge badge-danger">לא בשימוש: {un}</span>}
                    {del > 0 && <span className="badge badge-neutral">מחוק: {del}</span>}
                  </div>

                  <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginBottom: '10px' }}>
                    <div className="hint" style={{ color: 'var(--text-3)', fontWeight: 700, marginBottom: '3px' }}>מספרים סידוריים (תקינים)</div>
                    <div style={{ color: 'var(--primary-solid)', fontSize: '1rem' }}>
                      {serialRanges(ok.map(i => i.serialNumber)) || <span className="cell-muted">אין פריטים תקינים</span>}
                    </div>
                  </div>

                  {size !== 'ללא מידה' && (
                    <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => addItemForSize(size)}>
                      <svg className="icon"><use href="#i-plus" /></svg>הוסף פריט למידה זו
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {infoItem && <ModernDressItemModal item={infoItem} onClose={() => setInfoItem(null)} />}
    </>
  );
}
