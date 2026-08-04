'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X, Info, Package, RefreshCcw, History, Shirt, Tag, Calendar, ScanLine,
  Printer, Trash2, Save, Undo2, ArrowRight, FileText, ClipboardList, Barcode,
  Check, Power, AlertTriangle, CheckCircle2, XCircle, Image as ImageIcon, Upload
} from 'lucide-react';

const TAB_META = {
  details: { title: 'פרטי דגם' },
  items: { title: 'פריטים ומלאי', hint: 'עריכת שורה נפתחת מאייקון העיפרון · מידה, מס\' סידורי וברקוד נעולים לפריט קיים' },
  rentals: { title: 'השכרות הדגם', hint: 'כל ההשכרות של כל פריטי הדגם' },
  history: { title: 'מידע והיסטוריה' }
};

/**
 * המעטפת של כרטיס הדגם בעיצוב המודרני — פורט מדויק של אותה שיטה כמו ModernOrderCard
 * (סיידבר זהב עם טאבים, טופ-בר פעולות, ותוכן של טאב אחד בכל רגע). כל הטאבים נשארים
 * mounted (display:none) כדי לשמור על סטייט פנימי של הטבלאות והסינונים.
 */
export default function ModernDressCard({
  dress,
  items,
  isNewModel,
  useModelNames,
  showImages,
  activeTab,
  onTabChange,
  saving,
  saveMessage,
  hasUnsavedChanges,
  onSave,
  onCancelChanges,
  onDelete,
  onRestore,
  onExit,
  onToggleActive,
  onToggleInspection,
  onOpenImage,
  onPrint,
  imageSrc,
  onQuickScan,
  tabContents
}) {
  const [scanValue, setScanValue] = useState('');
  const printWrapRef = useRef(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  // סגירת תפריט ההדפסה בלחיצה מחוץ לו
  useEffect(() => {
    if (!printMenuOpen) return;
    const close = (e) => {
      if (printWrapRef.current && !printWrapRef.current.contains(e.target)) setPrintMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [printMenuOpen]);

  const activeItems = (items || []).filter(i => !i.isDeleted);
  const availableItems = activeItems.filter(i => !i.inRepair && !i.notInUse);
  const attentionCount = activeItems.filter(i => i.inRepair || i.notInUse).length;

  // "לא פעיל" נגזר גם מתאריך יציאה מפורש וגם ממצב שבו לא נותר אף פריט זמין —
  // בדיוק כמו הצביעה בקטלוג הראשי, כדי ששתי המסכים יספרו אותו סיפור.
  const hasExitDate = !!dress.exitDateFromRepo;
  const isInactive = hasExitDate || (activeItems.length > 0 && availableItems.length === 0);
  const statusLabel = dress.isDeleted ? 'מחוק' : isInactive ? 'לא פעיל' : 'פעיל';
  const StatusIcon = dress.isDeleted ? Trash2 : isInactive ? XCircle : CheckCircle2;
  const statusStyle = dress.isDeleted
    ? { background: 'rgba(239,68,68,0.28)', color: '#fff' }
    : isInactive
      ? { background: 'rgba(245,158,11,0.28)', color: '#fff8e1' }
      : { background: 'var(--moc-success-bg)', color: '#16a34a' };

  const modelTitle = isNewModel
    ? 'דגם חדש'
    : `דגם ${dress.barcodePrefix || '—'}`;

  const updatedLabel = dress.updatedAt
    ? `עודכן: ${new Date(dress.updatedAt).toLocaleDateString('he-IL')} · ${new Date(dress.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const meta = TAB_META[activeTab] || { title: '' };
  const hint = activeTab === 'details' ? updatedLabel : (meta.hint || '');

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setScanValue('');
    onQuickScan(code);
  };

  // בדגם חדש אין עדיין פריטים/השכרות/היסטוריה — הטאבים נחשפים רק אחרי השמירה הראשונה
  const tabs = isNewModel
    ? [{ id: 'details', label: 'פרטי דגם', icon: Info }]
    : [
      { id: 'details', label: 'פרטי דגם', icon: Info },
      { id: 'items', label: 'פריטים ומלאי', icon: Package, count: activeItems.length },
      { id: 'rentals', label: 'השכרות', icon: RefreshCcw },
      { id: 'history', label: 'מידע', icon: History }
    ];

  return (
    <div className="moc moc-page-overlay">
      <div className="moc-page-wrap">
        <div className="moc-top-strip">
          <div className="moc-breadcrumb">
            גמ"ח שמלות &raquo; <Link href="/dashboard/dresses">מאגר שמלות</Link> &raquo; <strong>{modelTitle}</strong>
          </div>
        </div>

        <div className="moc-container">
          {/* ============ סיידבר ============ */}
          <aside className="moc-sidebar">
            <div>
              <div className="moc-sidebar-top-row">
                <button className="moc-icon-btn-ghost" title="סגור כרטיס וחזור" onClick={onExit}>
                  <X size={16} />
                </button>
                <div className="moc-order-id-group">
                  <span className="moc-order-num">{modelTitle}</span>
                  {!isNewModel && (
                    <>
                      <span className="moc-v-divider" />
                      <span className="moc-badge" style={statusStyle}>
                        <StatusIcon size={13} /> {statusLabel}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {showImages && (
                <button className="moc-sidebar-thumb" onClick={onOpenImage} title="תמונת הדגם — לחץ להחלפה">
                  {imageSrc ? (
                    <img src={imageSrc} alt={dress.name || 'תמונת דגם'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <>
                      <ImageIcon size={26} />
                      <span>אין תמונה</span>
                    </>
                  )}
                  <span className="moc-thumb-overlay"><Upload size={15} /> החלף תמונה</span>
                </button>
              )}

              <div className="moc-sidebar-info-panel">
                {useModelNames && (
                  <div className="moc-sip-row"><Shirt size={15} /><strong>{dress.name || 'ללא שם'}</strong></div>
                )}
                <div className="moc-sip-row"><Barcode size={15} /><span>קוד {dress.barcodePrefix || '—'}</span></div>
                <div className="moc-sip-row"><Tag size={15} /><span>{dress.priceCategory || 'ללא קטגוריית מחיר'}</span></div>
                {!isNewModel && (
                  <div className="moc-sip-row">
                    <Package size={15} />
                    <span>{activeItems.length} פריטים · {availableItems.length} זמינים</span>
                  </div>
                )}
                {dress.entryDateToRepo && (
                  <div className="moc-sip-row">
                    <Calendar size={15} />
                    <span>נכנס: {new Date(dress.entryDateToRepo).toLocaleDateString('he-IL')}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <hr className="moc-sidebar-divider" />
              <nav className="moc-tab-nav">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`moc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => onTabChange(tab.id)}
                    >
                      <Icon size={17} /> {tab.label}
                      {tab.count !== undefined && <span className="moc-count">{tab.count}</span>}
                    </button>
                  );
                })}
              </nav>

              {!isNewModel && (
                <form className="moc-search-wrapper" style={{ marginTop: '16px' }} onSubmit={handleScanSubmit}>
                  <ScanLine size={17} />
                  <input
                    type="text"
                    className="moc-search-input"
                    value={scanValue}
                    onChange={e => setScanValue(e.target.value)}
                    placeholder="סריקת ברקוד — קפיצה לפריט"
                  />
                </form>
              )}
            </div>
          </aside>

          {/* ============ תוכן ============ */}
          <main className="moc-content-area">
            <div className="moc-content-topbar">
              <div className="moc-topbar-title-block">
                <h2>{isNewModel ? 'הוספת דגם חדש' : meta.title}</h2>
                {!isNewModel && hint && <span className="moc-hint" title={hint}>{hint}</span>}
                {saveMessage && (
                  <span className={`moc-save-msg ${saveMessage.includes('שגיאה') || saveMessage.includes('בוטל') ? 'err' : 'ok'}`} title={saveMessage}>
                    {saveMessage}
                  </span>
                )}
              </div>

              <div className="moc-topbar-actions">
                {!isNewModel && (
                  <>
                    <button
                      className={`moc-icon-btn-soft stock ${attentionCount ? 'attention' : 'ok'}`}
                      title={attentionCount
                        ? `${attentionCount} פריטים דורשים טיפול (בתיקון / לא בשימוש) — לחץ למעבר לרשימה`
                        : 'כל הפריטים תקינים'}
                      onClick={() => onTabChange('items', attentionCount ? 'attention' : 'all')}
                    >
                      <Package size={18} />
                      <span className="moc-amt-badge">{attentionCount || activeItems.length}</span>
                    </button>

                    <div className="moc-topbar-sep" />

                    <button
                      className={`moc-icon-btn-soft state ${hasExitDate ? 'no' : 'yes'}`}
                      title={hasExitDate ? 'הדגם לא פעיל — לחץ להחזרה לפעילות' : 'הדגם פעיל — לחץ לסימון כלא פעיל'}
                      onClick={onToggleActive}
                    >
                      <Power size={17} />
                      <span className="moc-mini-badge">
                        {hasExitDate ? <X size={8} /> : <Check size={8} />}
                      </span>
                    </button>

                    <button
                      className={`moc-icon-btn-soft inspect ${dress.inInspection ? 'on' : 'off'}`}
                      title={dress.inInspection
                        ? 'הצג בבדיקה (התראה) — מופעל. לחץ לכיבוי'
                        : 'הצג בבדיקה (התראה) — כבוי. לחץ להפעלה'}
                      onClick={onToggleInspection}
                    >
                      <AlertTriangle size={17} />
                      <span className="moc-mini-badge">
                        {dress.inInspection ? <Check size={8} /> : <X size={8} />}
                      </span>
                    </button>

                    <div style={{ position: 'relative' }} ref={printWrapRef}>
                      <button className="moc-icon-btn-soft purple" title="הדפסה / ייצוא" onClick={() => setPrintMenuOpen(o => !o)}>
                        <Printer size={18} />
                      </button>
                      {printMenuOpen && (
                        <div className="moc-dropdown-menu">
                          <div className="moc-dropdown-item" onClick={() => { setPrintMenuOpen(false); onPrint('card'); }}>
                            <FileText size={15} /> הדפסת כרטיס שמלה
                          </div>
                          <div className="moc-dropdown-item" onClick={() => { setPrintMenuOpen(false); onPrint('export'); }}>
                            <ClipboardList size={15} /> ייצוא פריטים (CSV)
                          </div>
                        </div>
                      )}
                    </div>

                    {dress.isDeleted ? (
                      <button className="moc-icon-btn-soft" style={{ color: '#16a34a' }} title="שחזור דגם מחוק" onClick={onRestore}>
                        <RefreshCcw size={18} />
                      </button>
                    ) : (
                      <button className="moc-icon-btn-soft danger" title="מחיקת דגם" onClick={onDelete}>
                        <Trash2 size={18} />
                      </button>
                    )}

                    <div className="moc-topbar-sep" />
                  </>
                )}

                <button
                  className="moc-icon-btn-soft primary"
                  title={isNewModel ? 'צור דגם' : 'שמור שינויים'}
                  onClick={() => onSave()}
                  disabled={saving}
                >
                  {saving ? <span className="moc-spinner" /> : <Save size={18} />}
                </button>

                <button
                  className="moc-icon-btn-soft warn"
                  title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}
                  onClick={onCancelChanges}
                  disabled={!hasUnsavedChanges || saving}
                >
                  <Undo2 size={18} />
                </button>

                <button className="moc-icon-btn-soft exit" title="שמירה וחזרה" onClick={onExit}>
                  <ArrowRight size={16} /> חזור
                </button>
              </div>
            </div>

            <div>
              {tabs.map(tab => (
                <section key={tab.id} className={`moc-content-section ${activeTab === tab.id ? 'active' : ''}`}>
                  {tabContents[tab.id]}
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
