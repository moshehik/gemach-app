'use client';

import { useState, useEffect } from 'react';
import styles from './pricelist.module.css';

// SVG Icons
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const EditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const UnlockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>
);


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

  return (
    <div className={`${styles.pageContainer} page-shell`}>
      <div className="page-scroll">
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>ניהול מחירון</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button data-element-name="כפתור_page_1" 
            className={styles.addButton} 
            onClick={() => setShowLockModal(true)}
            style={{ backgroundColor: isLocked ? '#ef4444' : '#22c55e', width: 'auto' }}
            title={isLocked ? 'נעול - לחץ כדי לפתוח' : 'פתוח - לחץ כדי לנעול'}
          >
            {isLocked ? <LockIcon data-element-name="רכיב_page_2" /> : <UnlockIcon data-element-name="רכיב_page_3" />}
            {isLocked ? 'מחיקה נעולה' : 'מחיקה פתוחה'}
          </button>
          <button data-element-name="כפתור_page_4" className={styles.addButton} onClick={() => handleAddNew('', true)}>
            <PlusIcon data-element-name="רכיב_page_5" />
            מחירון חדש
          </button>
        </div>
      </div>

      {showLockModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', width: '320px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: isLocked ? '#ef4444' : '#22c55e' }}>
              {isLocked ? <LockIcon data-element-name="רכיב_page_6" /> : <UnlockIcon data-element-name="רכיב_page_7" />}
            </div>
            <h3 style={{ marginTop: 0, color: 'var(--primary-color)', marginBottom: '0.5rem' }}>
              {isLocked ? 'פתיחת נעילת מחיקה' : 'נעילת מחיקה'}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1.5rem' }}>
              יש להזין קוד עובד (מנהל/מתכנת)
            </p>
            <input data-element-name="שדה_page_8" 
              type="password" 
              value={unlockCode}
              onChange={e => setUnlockCode(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter') handleLockSubmit(); }}
              placeholder="קוד עובד"
              autoFocus
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.2rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button data-element-name="כפתור_page_9" 
                onClick={handleLockSubmit}
                style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
              >
                אישור
              </button>
              <button data-element-name="כפתור_page_10" 
                onClick={() => { setShowLockModal(false); setUnlockCode(''); }}
                style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner}></div>
          <h3>טוען נתונים...</h3>
        </div>
      ) : (
        <>
          {isAddingNew && editingId === 'new' && addingCategory === 'NEW' && (
            <div className={styles.newEntryCard}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--primary-color)' }}>הוספת קטגוריה / שורה חדשה</h3>
              <div className={styles.newEntryGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>קטגוריה</label>
                  <input data-element-name="שדה_page_11" type="text" value={editForm.category || ''} onChange={e => setEditForm({...editForm, category: e.target.value})} className={styles.inputField} placeholder="לדוגמה: נשים" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>תיאור</label>
                  <input data-element-name="שדה_page_12" type="text" value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className={styles.inputField} placeholder="לדוגמה: תחרה" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>ממידה</label>
                  <input data-element-name="שדה_page_13" type="number" value={editForm.fromSize || ''} onChange={e => setEditForm({...editForm, fromSize: e.target.value})} className={styles.inputField} placeholder="36" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>עד מידה</label>
                  <input data-element-name="שדה_page_14" type="number" value={editForm.toSize || ''} onChange={e => setEditForm({...editForm, toSize: e.target.value})} className={styles.inputField} placeholder="44" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>מחיר (₪)</label>
                  <input data-element-name="שדה_page_15" type="number" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: e.target.value})} className={styles.inputField} placeholder="350" />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>פיקדון (₪)</label>
                  <input data-element-name="שדה_page_16" type="number" value={editForm.deposit || ''} onChange={e => setEditForm({...editForm, deposit: e.target.value})} className={styles.inputField} placeholder="50" />
                </div>
              </div>
              <div className={styles.actionButtons} style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button data-element-name="כפתור_page_17" className={`${styles.addButton} ${styles.saveBtn}`} onClick={() => handleSave(null)}>
                  <CheckIcon data-element-name="רכיב_page_18" /> שמור
                </button>
                <button data-element-name="כפתור_page_19" className={styles.addCategoryButton} onClick={() => { setEditingId(null); setIsAddingNew(false); }}>
                  <XIcon data-element-name="רכיב_page_20" /> בטל
                </button>
              </div>
            </div>
          )}

          {Object.keys(categoriesMap).map((categoryName) => (
            <div key={categoryName} className={styles.categoryCard}>
              <div className={styles.categoryHeader}>
                <h2 className={styles.categoryTitle}>{categoryName}</h2>
                <button data-element-name="כפתור_page_21" className={styles.addCategoryButton} onClick={() => handleAddNew(categoryName !== 'ללא קטגוריה' ? categoryName : '')}>
                  <PlusIcon data-element-name="רכיב_page_22" /> הוסף שורה לקטגוריה
                </button>
              </div>
              
              <div className={styles.tableWrapper}>
                <table className={styles.priceTable}>
                  <thead>
                    <tr>
                      <th>תיאור</th>
                      <th>מידות</th>
                      <th>מחיר השכרה</th>
                      <th>החזר פיקדון</th>
                      <th style={{ textAlign: 'left' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesMap[categoryName].map(item => (
                      <tr key={item.id}>
                        {editingId === item.id ? (
                          <>
                            <td><input data-element-name="שדה_page_23" type="text" value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className={styles.inputField} /></td>
                            <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input data-element-name="שדה_page_24" type="number" value={editForm.fromSize || ''} onChange={e => setEditForm({...editForm, fromSize: e.target.value})} className={styles.inputField} style={{ width: '60px' }} placeholder="מ-" />
                              <span>-</span>
                              <input data-element-name="שדה_page_25" type="number" value={editForm.toSize || ''} onChange={e => setEditForm({...editForm, toSize: e.target.value})} className={styles.inputField} style={{ width: '60px' }} placeholder="עד" />
                            </td>
                            <td><input data-element-name="שדה_page_26" type="number" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: e.target.value})} className={styles.inputField} style={{ width: '90px' }} /></td>
                            <td><input data-element-name="שדה_page_27" type="number" value={editForm.deposit || ''} onChange={e => setEditForm({...editForm, deposit: e.target.value})} className={styles.inputField} style={{ width: '90px' }} /></td>
                            <td style={{ textAlign: 'left' }}>
                              <div className={styles.actionButtons} style={{ justifyContent: 'flex-end' }}>
                                <button data-element-name="כפתור_page_28" className={`${styles.iconButton} ${styles.save}`} onClick={() => handleSave(item.id)} title="שמור"><CheckIcon data-element-name="רכיב_page_29" /></button>
                                <button data-element-name="כפתור_page_30" className={`${styles.iconButton} ${styles.cancel}`} onClick={() => { setEditingId(null); setIsAddingNew(false); }} title="בטל"><XIcon data-element-name="רכיב_page_31" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 500 }}>{item.description || '-'}</td>
                            <td>
                              {item.fromSize || item.toSize ? (
                                <span className={styles.sizeBadge}>
                                  {item.fromSize && item.toSize ? `${item.fromSize} - ${item.toSize}` : item.fromSize ? `מ-${item.fromSize}` : `עד ${item.toSize}`}
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              <span className={styles.priceTag}>{item.price ? `₪${item.price}` : '-'}</span>
                            </td>
                            <td>
                              {item.deposit ? `₪${item.deposit}` : '-'}
                            </td>
                            <td style={{ textAlign: 'left' }}>
                              <div className={styles.actionButtons} style={{ justifyContent: 'flex-end' }}>
                                <button data-element-name="כפתור_page_32" className={`${styles.iconButton} ${styles.edit}`} onClick={() => handleEditClick(item)} title="ערוך"><EditIcon data-element-name="רכיב_page_33" /></button>
                                <button data-element-name="כפתור_page_34" 
                                  className={`${styles.iconButton} ${styles.delete}`} 
                                  onClick={() => handleDelete(item.id)} 
                                  title="מחק"
                                  disabled={isLocked}
                                  style={{ opacity: isLocked ? 0.4 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                                >
                                  {isLocked ? <LockIcon data-element-name="רכיב_page_35" /> : <TrashIcon data-element-name="רכיב_page_36" />}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {isAddingNew && editingId === 'new' && addingCategory === (categoryName !== 'ללא קטגוריה' ? categoryName : '') && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td><input data-element-name="שדה_page_37" type="text" value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className={styles.inputField} placeholder="תיאור" autoFocus /></td>
                        <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input data-element-name="שדה_page_38" type="number" value={editForm.fromSize || ''} onChange={e => setEditForm({...editForm, fromSize: e.target.value})} className={styles.inputField} style={{ width: '60px' }} placeholder="מ-" />
                          <span>-</span>
                          <input data-element-name="שדה_page_39" type="number" value={editForm.toSize || ''} onChange={e => setEditForm({...editForm, toSize: e.target.value})} className={styles.inputField} style={{ width: '60px' }} placeholder="עד" />
                        </td>
                        <td><input data-element-name="שדה_page_40" type="number" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: e.target.value})} className={styles.inputField} style={{ width: '90px' }} placeholder="מחיר" /></td>
                        <td><input data-element-name="שדה_page_41" type="number" value={editForm.deposit || ''} onChange={e => setEditForm({...editForm, deposit: e.target.value})} className={styles.inputField} style={{ width: '90px' }} placeholder="פיקדון" /></td>
                        <td style={{ textAlign: 'left' }}>
                          <div className={styles.actionButtons} style={{ justifyContent: 'flex-end' }}>
                            <button data-element-name="כפתור_page_42" className={`${styles.iconButton} ${styles.save}`} onClick={() => handleSave(null)} title="שמור"><CheckIcon data-element-name="רכיב_page_43" /></button>
                            <button data-element-name="כפתור_page_44" className={`${styles.iconButton} ${styles.cancel}`} onClick={() => { setEditingId(null); setIsAddingNew(false); }} title="בטל"><XIcon data-element-name="רכיב_page_45" /></button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
      </div>
    </div>
  );
}
