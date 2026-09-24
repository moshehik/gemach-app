'use client';

import { useState, useEffect, useRef } from 'react';
import { listGapRanges, normalizeGapRule, GAP_RULE_CHEAPER } from '@/lib/priceRows';
import { V3Page, Card, Btn, IconBtn, Field, Tip, Dialog, Icon } from '@/app/v3/ui/components';
import { v3Toast } from '@/app/v3/notify';

// קטגוריות שאינן מחירי שמלה לפי מידה (תיקונים / תוספת חו"ל) - כלל "מידה בין טווחים" לא חל עליהן
const NON_DRESS_CATEGORIES = ['תיקונים', 'תיקון אורך', 'חול', 'חו"ל'];

// רוחב שדה מספר בטבלה - נגזר מטוקן מטרת המגע (R2)
const NUM_INPUT_STYLE = { inlineSize: 'calc(var(--v3-tap) * 2)' };

export default function PricelistManagement() {
  const [pricelists, setPricelists] = useState([]);
  // gap_size_price_rule: none (ברירת מחדל) / cheaper. null = עדיין לא נטען / נכשל - אז לא מציגים דבר
  const [gapRule, setGapRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [addingCategory, setAddingCategory] = useState(null);

  const [isLocked, setIsLocked] = useState(true);

  // חלונית אישור v3 שמחליפה את window.customConfirm - אותו זרימת await: מחזירה true/false
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmResolve = useRef(null);
  const askConfirm = () => new Promise((resolve) => {
    confirmResolve.current = resolve;
    setConfirmOpen(true);
  });
  const settleConfirm = (value) => {
    setConfirmOpen(false);
    if (confirmResolve.current) confirmResolve.current(value);
    confirmResolve.current = null;
  };

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

  useEffect(() => {
    fetchPricelists();
    // קריאת ההגדרה כמו ב-app/orders/new/page.js: /api/settings מחזיר מערך {key, value}
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (Array.isArray(data)) {
          const row = data.find(s => s.key === 'gap_size_price_rule');
          setGapRule(normalizeGapRule(row ? row.value : ''));
        }
      })
      .catch(e => console.error(e));
  }, []);

  // כמו בכל מסך אחר שדורש אישור מנהל (app/orders/[id]/page.js וכו') - אימות בפועל מול
  // ה-DB דרך /api/auth/verify-pin, לא רק בדיקה מול הרשימה שכבר בדפדפן (שהייתה משווה את
  // הקוד שהוקלד ל-UUID הפנימי של העובד, שאף עובד לא מקליד בפועל כ"קוד עובד" שלו - ולכן
  // אף אחד לא הצליח לפתוח את הנעילה).
  // הרמה חייבת להיות 'הנהלה ראשית' (roleId 0/2) ולא 'מנהל' (roleId 1/2) - כך בדיוק
  // נבדקת ההרשאה בפועל ב-DELETE/PUT של app/api/pricelists/[id]/route.js ובנעילת הדף
  // עצמה (HEAD_MANAGEMENT_ROLES). עם 'מנהל' עובד מסווג הנהלה ראשית (roleId 0, לא 1
  // ולא 2) שמקליד את הסיסמה האמיתית שלו נדחה כאן ("אין הרשאת מנהל/מתכנת") אף שהוא
  // בדיוק מי שאמור להיות מורשה - זו הייתה הסיבה ל"שגיאה במחיקה גם אחרי הזנת קוד מנהל".
  const handleLockToggle = async () => {
    const authResult = await window.customAuthPrompt('נדרש אישור הנהלה ראשית/מתכנת כדי לשנות את נעילת המחיקה.', 'הנהלה ראשית');
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'הנהלה ראשית' })
      });
      const data = await res.json();
      if (!data.success) {
        v3Toast(data.error || 'הקוד שגוי, או שאין לך הרשאת הנהלה ראשית / מתכנת.', 'error');
        return;
      }
      setIsLocked(prev => !prev);
    } catch (e) {
      console.error(e);
      v3Toast('האימות נכשל. נסו שוב.', 'error');
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
        // התראת הצלחה משנית (NOTIFICATIONS-DESIGN §4) - לא נשמרת בפעמון
        try { v3Toast({ kind: 'success', title: 'המחירון נשמר', persistToBell: false }); } catch (e2) { /* התראה משנית - אין השפעה על השמירה */ }
      } else {
        v3Toast('השמירה נכשלה. נסו שוב.', 'error');
      }
    } catch (e) {
      console.error(e);
      v3Toast('השמירה נכשלה. נסו שוב.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (isLocked) {
      v3Toast('המחיקה נעולה. יש לפתוח אותה קודם בקוד הנהלה.', 'warn');
      return;
    }
    if (!await askConfirm()) return;
    try {
      const res = await fetch(`/api/pricelists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPricelists();
      } else {
        v3Toast('המחיקה נכשלה. נסו שוב.', 'error');
      }
    } catch (e) {
      console.error(e);
      v3Toast('המחיקה נכשלה. נסו שוב.', 'error');
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

  // טווחי מידות שנופלים בפער בין שני טווחי מחיר סמוכים, לכל קטגוריית שמלות (לפי המחירון כפי שמוצג כאן)
  const gapsByCategory = Object.keys(categoriesMap)
    .filter(cat => !NON_DRESS_CATEGORIES.includes(cat))
    .map(cat => ({ category: cat, gaps: listGapRanges(pricelists, cat) }))
    .filter(entry => entry.gaps.length > 0);

  const formatGapSizes = (gap) => (gap.fromSize === gap.toSize ? `מידה ${gap.fromSize}` : `מידות ${gap.fromSize}–${gap.toSize}`);

  const cancelEdit = () => { setEditingId(null); setIsAddingNew(false); };

  const renderEditRow = (isNewRow, rowKey) => (
    <tr key={rowKey}>
      <td>
        <input
          type="text"
          value={editForm.description || ''}
          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
          className="v3-input"
          aria-label="תיאור"
          placeholder={isNewRow ? 'תיאור' : undefined}
          autoFocus={isNewRow}
        />
      </td>
      <td>
        <div className="v3-cluster">
          <input
            type="number"
            value={editForm.fromSize || ''}
            onChange={e => setEditForm({ ...editForm, fromSize: e.target.value })}
            className="v3-input"
            style={NUM_INPUT_STYLE}
            aria-label="ממידה"
            placeholder="מ-"
          />
          <span aria-hidden="true">-</span>
          <input
            type="number"
            value={editForm.toSize || ''}
            onChange={e => setEditForm({ ...editForm, toSize: e.target.value })}
            className="v3-input"
            style={NUM_INPUT_STYLE}
            aria-label="עד מידה"
            placeholder="עד"
          />
        </div>
      </td>
      <td>
        <input
          type="number"
          value={editForm.price || ''}
          onChange={e => setEditForm({ ...editForm, price: e.target.value })}
          className="v3-input"
          style={NUM_INPUT_STYLE}
          aria-label="מחיר השכרה"
          placeholder={isNewRow ? 'מחיר' : undefined}
        />
      </td>
      <td>
        <input
          type="number"
          value={editForm.deposit || ''}
          onChange={e => setEditForm({ ...editForm, deposit: e.target.value })}
          className="v3-input"
          style={NUM_INPUT_STYLE}
          aria-label="פיקדון"
          placeholder={isNewRow ? 'פיקדון' : undefined}
        />
      </td>
      <td>
        <div className="v3-cluster">
          <IconBtn icon="check" label="שמירה" variant="primary" size="sm" title="שמירה" onClick={() => handleSave(isNewRow ? null : editingId)} />
          <IconBtn icon="x" label="ביטול" variant="quiet" size="sm" title="ביטול" onClick={cancelEdit} />
        </div>
      </td>
    </tr>
  );

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">מחירון</h1>
            <span className="v3-muted">מחיר השכרה ופיקדון לפי קטגוריה ומידה</span>
          </div>
          <div className="v3-pagehead__tools">
            <Btn
              variant={isLocked ? 'danger' : 'secondary'}
              icon={isLocked ? 'lock' : 'check-circle'}
              onClick={handleLockToggle}
              title={isLocked ? 'המחיקה נעולה. לחיצה תפתח אותה' : 'המחיקה פתוחה. לחיצה תנעל אותה'}
            >
              {isLocked ? 'מחיקה נעולה' : 'מחיקה פתוחה'}
            </Btn>
            <Btn variant="primary" icon="plus" onClick={() => handleAddNew('', true)}>קטגוריה חדשה</Btn>
          </div>
        </div>

        {loading ? (
          <div className="v3-cluster" role="status">
            <Icon name="loader" loop />
            <span className="v3-muted">טוען מחירון...</span>
          </div>
        ) : (
          <>
            {gapRule === GAP_RULE_CHEAPER && (
              <Card
                variant="info"
                icon="info"
                title="מידות בין טווחים מחויבות לפי הזול"
                tip="מידה שאין לה שורת מחיר ונמצאת בין שני טווחים סמוכים מחויבת לפי המחיר הזול מבין השניים."
              >
                {gapsByCategory.length > 0 ? (
                  <ul className="v3-stack">
                    {gapsByCategory.map(entry => entry.gaps.map(gap => (
                      <li key={`${entry.category}-${gap.fromSize}`}>
                        <b>{entry.category}</b>
                        <div className="v3-muted">
                          <bdi>{formatGapSizes(gap)}</bdi> · לפי הטווח הזול
                          {gap.row.description ? ` (${gap.row.description})` : ''}, <bdi>₪{gap.price}</bdi>
                        </div>
                      </li>
                    )))}
                  </ul>
                ) : (
                  <p className="v3-muted">אין כרגע מידות שנופלות בין טווחים.</p>
                )}
              </Card>
            )}

            {gapRule !== null && gapRule !== GAP_RULE_CHEAPER && gapsByCategory.length > 0 && (
              <div className="v3-note v3-note--attn" role="status">
                <div className="v3-stack">
                  <div className="v3-cluster">
                    <Icon name="alert-tri" />
                    <b>יש מידות בלי מחיר</b>
                    <Tip>
                      מידות שבין שני טווחים ללא שורת מחיר מחויבות כרגע 0 ₪. כדי לחייב אותן לפי הזול משני הטווחים, יש לשנות את ההגדרה &quot;מידה בין שני טווחי מחיר&quot; (קבוצת תשלומים) בהגדרות המערכת.
                    </Tip>
                  </div>
                  <ul className="v3-stack">
                    {gapsByCategory.map(entry => entry.gaps.map(gap => (
                      <li key={`${entry.category}-${gap.fromSize}`}>
                        <b>{entry.category}</b>
                        <div className="v3-muted"><bdi>{formatGapSizes(gap)}</bdi></div>
                      </li>
                    )))}
                  </ul>
                  <div className="v3-cluster">
                    <Btn href="/admin/settings" variant="secondary" size="sm" icon="settings">להגדרות המערכת</Btn>
                  </div>
                </div>
              </div>
            )}

            {isAddingNew && editingId === 'new' && addingCategory === 'NEW' && (
              <Card icon="plus" title="קטגוריה או שורה חדשה">
                <div className="v3-stack">
                  <Field label="קטגוריה" id="pricelist-newCategory" type="text" value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} placeholder="לדוגמה: נשים" />
                  <Field label="תיאור" id="pricelist-newDescription" type="text" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="לדוגמה: תחרה" />
                  <Field label="ממידה" id="pricelist-newFromSize" type="number" value={editForm.fromSize || ''} onChange={e => setEditForm({ ...editForm, fromSize: e.target.value })} placeholder="36" />
                  <Field label="עד מידה" id="pricelist-newToSize" type="number" value={editForm.toSize || ''} onChange={e => setEditForm({ ...editForm, toSize: e.target.value })} placeholder="44" />
                  <Field label="מחיר השכרה (₪)" id="pricelist-newPrice" type="number" value={editForm.price || ''} onChange={e => setEditForm({ ...editForm, price: e.target.value })} placeholder="350" />
                  <Field label="פיקדון (₪)" id="pricelist-newDeposit" type="number" value={editForm.deposit || ''} onChange={e => setEditForm({ ...editForm, deposit: e.target.value })} placeholder="50" />
                  <div className="v3-cluster">
                    <Btn variant="primary" icon="check" onClick={() => handleSave(null)}>שמירה</Btn>
                    <Btn variant="quiet" icon="x" onClick={cancelEdit}>ביטול</Btn>
                  </div>
                </div>
              </Card>
            )}

            {Object.keys(categoriesMap).map((categoryName) => (
              <section key={categoryName} className="v3-stack">
                <div className="v3-pagehead">
                  <div className="v3-pagehead__title">
                    <h2 className="v3-h2">{categoryName}</h2>
                    <span className="v3-muted v3-text-sm"><bdi>{categoriesMap[categoryName].length}</bdi> שורות</span>
                  </div>
                  <Btn size="sm" icon="plus" onClick={() => handleAddNew(categoryName !== 'ללא קטגוריה' ? categoryName : '')}>שורה בקטגוריה</Btn>
                </div>

                <div className="v3-table__wrap">
                  <table className="v3-table">
                    <caption className="v3-sr">{categoryName}</caption>
                    <thead>
                      <tr>
                        <th scope="col">תיאור</th>
                        <th scope="col">מידות</th>
                        <th scope="col">מחיר השכרה</th>
                        <th scope="col">פיקדון</th>
                        <th scope="col"><span className="v3-sr">פעולות</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriesMap[categoryName].map(item => (
                        editingId === item.id ? (
                          renderEditRow(false, item.id)
                        ) : (
                          <tr key={item.id}>
                            <td><b>{item.description || '-'}</b></td>
                            <td>
                              {item.fromSize || item.toSize ? (
                                <span className="v3-badge v3-badge--neutral">
                                  <bdi>{item.fromSize && item.toSize ? `${item.fromSize} - ${item.toSize}` : item.fromSize ? `מ-${item.fromSize}` : `עד ${item.toSize}`}</bdi>
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              {item.price ? <span className="v3-badge v3-badge--navy"><bdi>₪{item.price}</bdi></span> : '-'}
                            </td>
                            <td>
                              {item.deposit ? <bdi>₪{item.deposit}</bdi> : '-'}
                            </td>
                            <td>
                              <div className="v3-cluster">
                                <IconBtn icon="edit" label="עריכה" variant="quiet" size="sm" title="עריכה" onClick={() => handleEditClick(item)} />
                                <IconBtn
                                  icon={isLocked ? 'lock' : 'trash'}
                                  label="מחיקה"
                                  variant="quiet"
                                  size="sm"
                                  title="מחיקה"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={isLocked}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      ))}
                      {isAddingNew && editingId === 'new' && addingCategory === (categoryName !== 'ללא קטגוריה' ? categoryName : '') && renderEditRow(true, 'new-row')}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => settleConfirm(false)}
        variant="confirm"
        mode="light"
        icon="trash"
        title="למחוק את השורה?"
        sub="אי אפשר לשחזר אותה אחרי המחיקה."
        actions={
          <>
            <Btn variant="danger" icon="trash" data-autofocus="" onClick={() => settleConfirm(true)}>מחיקה</Btn>
            <Btn variant="quiet" onClick={() => settleConfirm(false)}>ביטול</Btn>
          </>
        }
      />
    </V3Page>
  );
}
