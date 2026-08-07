'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function PricelistManagement() {
  const [pricelists, setPricelists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [addingCategory, setAddingCategory] = useState(null);

  const [isLocked, setIsLocked] = useState(true);
  const [showLockModal, setShowLockModal] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [showUnlockCode, setShowUnlockCode] = useState(false);
  const [employees, setEmployees] = useState([]);

  const fetchPricelists = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pricelists');
      if (res.ok) {
        const data = await res.json();
        setPricelists(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPricelists();
    fetchEmployees();
  }, []);

  const handleLockSubmit = () => {
    const employee = employees.find(emp => String(emp.id) === unlockCode);
    if (employee && (employee.roleId === 1 || employee.roleId === 2)) {
      setIsLocked(!isLocked);
      setShowLockModal(false);
      setUnlockCode('');
    } else {
      alert('קוד שגוי או שאין לך הרשאות מתאימות (נדרש סיווג מנהל/מתכנת).');
    }
  };

  const closeLockModal = () => {
    setShowLockModal(false);
    setUnlockCode('');
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item,
      startDate: item.startDate ? item.startDate.split('T')[0] : '',
      endDate: item.endDate ? item.endDate.split('T')[0] : ''
    });
    setIsAddingNew(false);
  };

  const handleSave = async (id) => {
    try {
      const url = id ? `/api/pricelists/${id}` : '/api/pricelists';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        setIsAddingNew(false);
        fetchPricelists();
      } else {
        alert('שגיאה בשמירת הנתונים');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בשמירת הנתונים');
    }
  };

  const handleDelete = async (id) => {
    if (isLocked) {
      alert('המחיקה נעולה. אנא פתח את הנעילה תחילה ע"י קוד מנהל/מתכנת.');
      return;
    }
    if (!await window.customConfirm('האם אתה בטוח שברצונך למחוק שורה זו? הפעולה אינה ניתנת לביטול.')) return;
    try {
      const res = await fetch(`/api/pricelists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPricelists();
      } else {
        alert('שגיאה במחיקה');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה במחיקה');
    }
  };

  const handleAddNew = (category = '', isNewCategory = false) => {
    let suggestedFromSize = '';
    if (category) {
      const catItems = pricelists.filter(p => p.category === category);
      if (catItems.length > 0) {
        const maxToSize = Math.max(...catItems.map(p => p.toSize || 0));
        if (maxToSize > 0) {
          suggestedFromSize = maxToSize + 1;
        }
      }
    }

    setEditForm({
      category: category,
      description: '',
      fromSize: suggestedFromSize,
      toSize: '',
      price: '',
      deposit: '',
      startDate: '',
      endDate: ''
    });
    setEditingId('new');
    setIsAddingNew(true);
    setAddingCategory(isNewCategory ? 'NEW' : category);
  };

  const categoriesMap = pricelists.reduce((acc, curr) => {
    const cat = curr.category || 'ללא קטגוריה';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  const cancelEdit = () => { setEditingId(null); setIsAddingNew(false); };

  const renderEditRow = (isNewRow, rowKey) => (
    <tr key={rowKey} style={isNewRow ? { background: 'var(--surface-alt)' } : undefined}>
      <td>
        <input
          type="text"
          value={editForm.description || ''}
          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
          className="input"
          placeholder={isNewRow ? 'תיאור' : undefined}
          autoFocus={isNewRow}
        />
      </td>
      <td>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="number"
            value={editForm.fromSize || ''}
            onChange={e => setEditForm({ ...editForm, fromSize: e.target.value })}
            className="input"
            style={{ width: '64px' }}
            placeholder="מ-"
          />
          <span>-</span>
          <input
            type="number"
            value={editForm.toSize || ''}
            onChange={e => setEditForm({ ...editForm, toSize: e.target.value })}
            className="input"
            style={{ width: '64px' }}
            placeholder="עד"
          />
        </div>
      </td>
      <td>
        <input
          type="number"
          value={editForm.price || ''}
          onChange={e => setEditForm({ ...editForm, price: e.target.value })}
          className="input"
          style={{ width: '90px' }}
          placeholder={isNewRow ? 'מחיר' : undefined}
        />
      </td>
      <td>
        <input
          type="number"
          value={editForm.deposit || ''}
          onChange={e => setEditForm({ ...editForm, deposit: e.target.value })}
          className="input"
          style={{ width: '90px' }}
          placeholder={isNewRow ? 'פיקדון' : undefined}
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleSave(isNewRow ? null : editingId)} title="שמור">
            <svg className="icon"><use href="#i-check" /></svg>
          </button>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--danger)' }} onClick={cancelEdit} title="בטל">
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול מחירון</h1>
          <div className="page-desc">מחירי השכרה ופיקדון לפי קטגוריה ומידה</div>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className={isLocked ? 'btn btn-danger-ghost' : 'btn btn-secondary'}
            style={isLocked ? undefined : { background: 'var(--success-tint)', color: 'var(--success)' }}
            onClick={() => setShowLockModal(true)}
            title={isLocked ? 'נעול - לחץ כדי לפתוח' : 'פתוח - לחץ כדי לנעול'}
          >
            <svg className="icon"><use href={isLocked ? '#i-lock' : '#i-check-circle'} /></svg>
            {isLocked ? 'מחיקה נעולה' : 'מחיקה פתוחה'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => handleAddNew('', true)}>
            <svg className="icon"><use href="#i-plus" /></svg>
            מחירון חדש
          </button>
        </div>
      </div>

      {showLockModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeLockModal}>
          <div className="modal" style={{ maxWidth: '360px', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href={isLocked ? '#i-lock' : '#i-check-circle'} /></svg>
                {isLocked ? 'פתיחת נעילת מחיקה' : 'נעילת מחיקה'}
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={closeLockModal}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="hint" style={{ color: 'var(--text-3)', marginBottom: '12px' }}>יש להזין קוד עובד (מנהל/מתכנת)</div>
              <div className="field">
                <label htmlFor="pricelist-unlockCode">קוד עובד</label>
                <div className="password-field">
                  <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                  <input
                    id="pricelist-unlockCode"
                    className="input"
                    type={showUnlockCode ? 'text' : 'password'}
                    value={unlockCode}
                    onChange={e => setUnlockCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleLockSubmit(); }}
                    placeholder="קוד עובד"
                    autoFocus
                  />
                  <button type="button" className="toggle-visibility" title="הצג קוד" onClick={() => setShowUnlockCode(v => !v)}>
                    <svg className="icon"><use href="#i-eye" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={closeLockModal}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={handleLockSubmit}>
                <svg className="icon"><use href="#i-check" /></svg>
                אישור
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loading ? (
        <div className="table-wrap">
          <div className="page-loading">
            <span className="spinner lg" />
            <h3 style={{ margin: 0 }}>טוען נתונים...</h3>
          </div>
        </div>
      ) : (
        <>
          {isAddingNew && editingId === 'new' && addingCategory === 'NEW' && (
            <div className="card card-pad" style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '15px' }}>הוספת קטגוריה / שורה חדשה</h2>
              <div className="form-grid cols-3">
                <div className="field">
                  <label htmlFor="pricelist-newCategory">קטגוריה</label>
                  <input id="pricelist-newCategory" type="text" value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="input" placeholder="לדוגמה: נשים" />
                </div>
                <div className="field">
                  <label htmlFor="pricelist-newDescription">תיאור</label>
                  <input id="pricelist-newDescription" type="text" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="input" placeholder="לדוגמה: תחרה" />
                </div>
                <div className="field">
                  <label htmlFor="pricelist-newFromSize">ממידה</label>
                  <input id="pricelist-newFromSize" type="number" value={editForm.fromSize || ''} onChange={e => setEditForm({ ...editForm, fromSize: e.target.value })} className="input" placeholder="36" />
                </div>
                <div className="field">
                  <label htmlFor="pricelist-newToSize">עד מידה</label>
                  <input id="pricelist-newToSize" type="number" value={editForm.toSize || ''} onChange={e => setEditForm({ ...editForm, toSize: e.target.value })} className="input" placeholder="44" />
                </div>
                <div className="field">
                  <label htmlFor="pricelist-newPrice">מחיר (₪)</label>
                  <input id="pricelist-newPrice" type="number" value={editForm.price || ''} onChange={e => setEditForm({ ...editForm, price: e.target.value })} className="input" placeholder="350" />
                </div>
                <div className="field">
                  <label htmlFor="pricelist-newDeposit">פיקדון (₪)</label>
                  <input id="pricelist-newDeposit" type="number" value={editForm.deposit || ''} onChange={e => setEditForm({ ...editForm, deposit: e.target.value })} className="input" placeholder="50" />
                </div>
              </div>
              <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-primary" onClick={() => handleSave(null)}>
                  <svg className="icon"><use href="#i-check" /></svg>
                  שמור
                </button>
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  <svg className="icon"><use href="#i-x" /></svg>
                  בטל
                </button>
              </div>
            </div>
          )}

          {Object.keys(categoriesMap).map((categoryName) => (
            <div key={categoryName} style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <h2 className="section-title" style={{ margin: 0 }}>{categoryName}</h2>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddNew(categoryName !== 'ללא קטגוריה' ? categoryName : '')}>
                  <svg className="icon"><use href="#i-plus" /></svg>
                  הוסף שורה לקטגוריה
                </button>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>תיאור</th>
                      <th>מידות</th>
                      <th>מחיר השכרה</th>
                      <th>החזר פיקדון</th>
                      <th style={{ textAlign: 'center' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesMap[categoryName].map(item => (
                      editingId === item.id ? (
                        renderEditRow(false, item.id)
                      ) : (
                        <tr key={item.id}>
                          <td className="cell-primary">{item.description || '-'}</td>
                          <td>
                            {item.fromSize || item.toSize ? (
                              <span className="badge badge-neutral">
                                {item.fromSize && item.toSize ? `${item.fromSize} - ${item.toSize}` : item.fromSize ? `מ-${item.fromSize}` : `עד ${item.toSize}`}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            {item.price ? <span className="badge badge-primary">₪{item.price}</span> : '-'}
                          </td>
                          <td>
                            {item.deposit ? `₪${item.deposit}` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => handleEditClick(item)} title="ערוך">
                                <svg className="icon"><use href="#i-edit" /></svg>
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon-only btn-sm"
                                onClick={() => handleDelete(item.id)}
                                title="מחק"
                                disabled={isLocked}
                                style={{ opacity: isLocked ? 0.45 : 1 }}
                              >
                                <svg className="icon"><use href={isLocked ? '#i-lock' : '#i-trash'} /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                    {isAddingNew && editingId === 'new' && addingCategory === (categoryName !== 'ללא קטגוריה' ? categoryName : '') && renderEditRow(true, 'new-row')}
                  </tbody>
                </table>
                <div className="table-foot">
                  <span>סה&quot;כ שורות מוצגות: {categoriesMap[categoryName].length}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
