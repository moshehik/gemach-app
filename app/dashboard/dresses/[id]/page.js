'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLabels } from '@/app/components/LabelsContext';
import ModernDressCard from '../../../../components/dresses/modern/ModernDressCard';
import ModernDressDetailsTab from '../../../../components/dresses/modern/ModernDressDetailsTab';
import ModernDressItemsTab from '../../../../components/dresses/modern/ModernDressItemsTab';
import ModernDressRentalsTab from '../../../../components/dresses/modern/ModernDressRentalsTab';
import ModernDressInfoTab from '../../../../components/dresses/modern/ModernDressInfoTab';
import { ModernInactiveReasonModal } from '../../../../components/dresses/modern/ModernDressModals';
import ModernNewDressWizard from '../../../../components/dresses/modern/ModernNewDressWizard';
import { addHistory } from '../../../../lib/historyManager';
import { cacheNamespace, getSettingsCached } from '@/app/lib/pageCache';

// השדות של הדגם שנשמרים בכפתור השמירה (הפריטים נשמרים בנפרד, מיידית)
const MODEL_FIELDS = ['name', 'barcodePrefix', 'priceCategory', 'notes', 'inInspection', 'imageUrl', 'entryDateToRepo', 'exitDateFromRepo', 'inactiveReason'];

const emptyDress = {
  name: '',
  barcodePrefix: '',
  priceCategory: '',
  notes: '',
  inInspection: false,
  imageUrl: '',
  entryDateToRepo: new Date().toISOString()
};

// הקטגוריות זהות לכל הכרטיסים ונשלפות פעם אחת; ההגדרות עברו ל-getSettingsCached
// המשותף. הדגם עצמו מוצג מיד מהמטמון בכניסה חוזרת ומתרענן ברקע (SWR) —
// דרך המטמון המשותף ב-app/lib/pageCache.js.
const lookupCache = { categories: null };
const dressCache = cacheNamespace('dress-detail');

const parseSettings = (data) => {
  const obj = { useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' };
  if (Array.isArray(data)) {
    data.forEach(s => { if (s.key) obj[s.key] = s.value; });
  } else if (data) {
    Object.assign(obj, data);
  }
  return obj;
};

export default function DressCardPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const isNewModel = id === 'new';
  const { getLabel } = useLabels();

  const cached = isNewModel ? null : dressCache.get(id);
  const [dress, setDress] = useState(isNewModel ? { ...emptyDress } : (cached?.model || null));
  const [items, setItems] = useState(cached?.items || []);
  const [loading, setLoading] = useState(!isNewModel && !cached);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' });
  const [categories, setCategories] = useState(lookupCache.categories || []);
  const [locations, setLocations] = useState(['חנות', 'רזרבה', 'מחסן']);

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [itemsFilter, setItemsFilter] = useState(null);
  const [scanBarcode, setScanBarcode] = useState(null);

  // מצב הדגם כפי שהוא בשרת — הבסיס להשוואה ולשחזור ב"ביטול שינויים"
  const savedSnapshotRef = useRef(null);
  // נספר כל שינוי מקומי בפריטים, כדי שרענון-רקע שהתחיל לפניו לא ידרוס אותו
  const itemsRevisionRef = useRef(0);
  const flashMessage = (msg, ms = 3000) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(''), ms);
  };

  // ===== טעינת נתוני עזר (פעם אחת לכל הכרטיסים) =====
  useEffect(() => {
    const applySettings = (obj) => {
      setSettings(obj);
      if (obj.item_locations) setLocations(obj.item_locations.split(',').map(l => l.trim()).filter(Boolean));
    };

    getSettingsCached()
      .then(data => applySettings(parseSettings(data)))
      .catch(err => console.error('Failed to load settings', err));

    // הקטגוריות נחוצות רק לבורר בעריכת הדגם — לא חוסמות את הצגת הכרטיס
    if (!lookupCache.categories) {
      fetch('/api/pricelists/categories')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          lookupCache.categories = Array.isArray(data) ? data : [];
          setCategories(lookupCache.categories);
        })
        .catch(err => console.error('Failed to load categories', err));
    }
  }, []);

  // ===== טעינת הדגם =====
  useEffect(() => {
    if (isNewModel) return;

    let cancelled = false;
    const revisionAtStart = itemsRevisionRef.current;
    fetch(`/api/dresses/${id}?includeDeleted=true`)
      .then(res => {
        if (!res.ok) throw new Error('הדגם לא נמצא');
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const loadedItems = data.items || [];
        const model = { ...data };
        delete model.items;
        dressCache.set(id, { model, items: loadedItems });
        setDress(model);
        // רענון-רקע לא דורס שינוי בפריטים שנשמר בזמן שהבקשה הייתה באוויר
        if (itemsRevisionRef.current === revisionAtStart) setItems(loadedItems);
        savedSnapshotRef.current = model;
        setHasUnsavedChanges(false);
        addHistory({
          type: 'dress',
          id: data.id,
          name: `דגם ${data.barcodePrefix || ''}`.trim(),
          subtext: data.name || ''
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
        // כשלון רענון על נתונים שכבר מוצגים מהמטמון לא צריך למחוק את המסך
        if (!dressCache.has(id)) setDress(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, isNewModel]);

  // אזהרה לפני יציאה מהדפדפן עם שינויים שלא נשמרו
  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = 'ישנם שינויים שלא נשמרו בכרטיס הדגם!';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const useModelNames = settings.useModelNames !== 'false';
  const showImages = settings.hide_dress_images !== 'true';

  const getImageSource = (d) => {
    if (!d) return null;
    if (d.imageUrl) return d.imageUrl;
    if (settings.useFileNamesForImages === 'true' && d.barcodePrefix) return `/images/dresses/${d.barcodePrefix}.jpg`;
    return null;
  };

  const patchDress = (patch) => {
    setDress(prev => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  // ===== שמירה =====
  const saveDress = async (overrides = null) => {
    if (saving) return null;
    const current = overrides ? { ...dress, ...overrides } : dress;

    if (useModelNames && !String(current.name || '').trim()) {
      flashMessage('שגיאה: חובה להזין שם דגם');
      return null;
    }
    if (!useModelNames && !String(current.barcodePrefix || '').trim()) {
      flashMessage('שגיאה: חובה להזין קוד דגם');
      return null;
    }
    if (current.exitDateFromRepo && current.entryDateToRepo
      && new Date(current.exitDateFromRepo) < new Date(current.entryDateToRepo)) {
      flashMessage('שגיאה: תאריך יציאה לא יכול להיות קודם לתאריך הכניסה');
      return null;
    }

    const payload = {};
    MODEL_FIELDS.forEach(f => { payload[f] = current[f] ?? null; });
    if (!useModelNames && !payload.name) {
      payload.name = `דגם ${payload.barcodePrefix || 'ללא קוד'}`;
    }

    setSaving(true);
    try {
      // יצירת דגם חדש נעשית באשף (ModernNewDressWizard) — כאן תמיד עדכון
      const res = await fetch(`/api/dresses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        flashMessage(`שגיאה: ${data.error || 'שמירת הדגם נכשלה'}`, 5000);
        return null;
      }

      const model = { ...data };
      delete model.items;
      setDress(model);
      dressCache.set(id, { model, items });
      savedSnapshotRef.current = model;
      setHasUnsavedChanges(false);
      flashMessage('השינויים נשמרו בהצלחה!');
      return model;
    } catch (err) {
      console.error(err);
      flashMessage('שגיאה בתקשורת עם השרת', 5000);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = async () => {
    const snap = savedSnapshotRef.current;
    if (!hasUnsavedChanges || !snap) {
      flashMessage('אין שינויים לביטול.');
      return;
    }
    const changed = MODEL_FIELDS.filter(f => JSON.stringify(snap[f] ?? null) !== JSON.stringify(dress[f] ?? null));
    const confirmed = await window.customConfirm(
      `פעולה זו תבטל את השינויים שלא נשמרו בכרטיס הדגם ותחזיר אותו למצב האחרון שנשמר${changed.length ? ` (${changed.length} שדות)` : ''}.`
    );
    if (!confirmed) return;
    setDress(snap);
    setHasUnsavedChanges(false);
    flashMessage('השינויים בוטלו.');
  };

  const handleExit = async () => {
    if (hasUnsavedChanges) {
      const saved = await saveDress();
      if (!saved) return; // שמירה נכשלה — נשארים בכרטיס כדי לא לאבד את השינויים
    }
    router.push('/dashboard/dresses');
  };

  // ===== מחיקה / שחזור =====
  const handleDelete = async () => {
    if (!(await window.customConfirm('האם למחוק דגם זה? לא ניתן למחוק אם יש פריטים פעילים במלאי.'))) return;
    try {
      const res = await fetch(`/api/dresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDress(prev => ({ ...prev, isDeleted: true }));
        savedSnapshotRef.current = { ...savedSnapshotRef.current, isDeleted: true };
        flashMessage('הדגם נמחק (מחיקה רכה).');
      } else {
        flashMessage(`שגיאה: ${data.error || 'מחיקת הדגם נכשלה'}`, 5000);
      }
    } catch (err) {
      console.error(err);
      flashMessage('שגיאה בתקשורת עם השרת', 5000);
    }
  };

  const handleRestore = async () => {
    if (!(await window.customConfirm('האם לשחזר את הדגם המחוק?'))) return;
    try {
      const res = await fetch(`/api/dresses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      const data = await res.json();
      if (res.ok) {
        setDress(prev => ({ ...prev, isDeleted: false }));
        savedSnapshotRef.current = { ...savedSnapshotRef.current, isDeleted: false };
        flashMessage('הדגם שוחזר בהצלחה.');
      } else {
        flashMessage(`שגיאה: ${data.error || 'שחזור הדגם נכשל'}`, 5000);
      }
    } catch (err) {
      console.error(err);
      flashMessage('שגיאה בתקשורת עם השרת', 5000);
    }
  };

  // ===== סטטוס פעילות =====
  const handleReturnToActivity = async () => {
    if (!(await window.customConfirm('האם להחזיר את הדגם לפעילות?'))) return;
    const activeItems = items.filter(i => !i.isDeleted && !i.notInUse);
    const saved = await saveDress({ exitDateFromRepo: null, inactiveReason: null });
    if (saved && activeItems.length === 0) {
      flashMessage('הדגם חזר לפעילות — שים לב שאין לו פריטים פעילים במלאי.', 6000);
    }
  };

  const handleSaveInactive = async ({ exitDateFromRepo, inactiveReason }) => {
    setShowReasonModal(false);
    await saveDress({ exitDateFromRepo, inactiveReason });
  };

  const handleToggleInspection = async () => {
    await saveDress({ inInspection: !dress.inInspection });
  };

  // ===== תמונה =====
  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        patchDress({ imageUrl: data.imageUrl });
        flashMessage('התמונה הועלתה — לחץ שמירה כדי לשמור אותה בדגם.', 4000);
      } else {
        flashMessage('שגיאה בהעלאת התמונה', 4000);
      }
    } catch (err) {
      console.error(err);
      flashMessage('שגיאה בתקשורת בהעלאת התמונה', 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleAutoCode = async () => {
    try {
      const res = await fetch('/api/dresses/next-code');
      const data = await res.json();
      if (res.ok) {
        patchDress({ barcodePrefix: data.nextCode });
      } else {
        flashMessage(`שגיאה: ${data.error || 'לא נמצא קוד פנוי'}`);
      }
    } catch (err) {
      console.error(err);
      flashMessage('שגיאה בתקשורת');
    }
  };

  // ===== הדפסה / ייצוא =====
  const handlePrint = (type) => {
    if (type === 'card') {
      window.open(`/dashboard/dresses/${id}/print`, '_blank');
      return;
    }
    if (type === 'export') {
      const rows = [['מידה', "מס' סידורי", 'ברקוד', 'מיקום', 'בתיקון', 'לא בשימוש', 'סיבת אי-שימוש', 'מחוק']];
      items.forEach(i => rows.push([
        i.sizeText || '', i.serialNumber ?? '', i.dressBarcode || '', i.location || '',
        i.inRepair ? 'כן' : 'לא', i.notInUse ? 'כן' : 'לא', i.notInUseReason || '', i.isDeleted ? 'כן' : 'לא'
      ]));
      // BOM כדי שאקסל יזהה עברית ב-UTF-8
      const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `דגם-${dress.barcodePrefix || id}-פריטים.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleTabChange = (tab, filter) => {
    setActiveTab(tab);
    if (filter) setItemsFilter(filter);
  };

  // דגם חדש נבנה באשף ייעודי (מבנה הצעדים של /orders/new), לא בכרטיס
  if (isNewModel) {
    return (
      <ModernNewDressWizard
        useModelNames={useModelNames}
        showImages={showImages}
        categories={categories}
        locations={locations}
        onCancel={() => router.push('/dashboard/dresses')}
        onCreated={(created, failedItems) => {
          if (failedItems?.length) {
            alert(`הדגם נוצר, אך חלק מהפריטים נכשלו:\n\n${failedItems.join('\n')}`);
          }
          router.replace(`/dashboard/dresses/${created.id}`);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        טוען כרטיס דגם...
      </div>
    );
  }

  if (!dress) {
    return (
      <div className="empty-state">
        <svg className="icon"><use href="#i-alert-circle" /></svg>
        <h4>הדגם לא נמצא</h4>
      </div>
    );
  }

  const imageSrc = getImageSource(dress);

  return (
    <>
      <ModernDressCard
        dress={dress}
        items={items}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        saving={saving}
        saveMessage={saveMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={() => saveDress()}
        onCancelChanges={handleCancelChanges}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onExit={handleExit}
        onPrint={handlePrint}
        tabContents={{
          details: (
            <ModernDressDetailsTab
              dress={dress}
              onChange={patchDress}
              isNewModel={isNewModel}
              useModelNames={useModelNames}
              showImages={showImages}
              categories={categories}
              imageSrc={imageSrc}
              uploading={uploading}
              onImageUpload={handleImageUpload}
              onRemoveImage={() => patchDress({ imageUrl: null })}
              onAutoCode={handleAutoCode}
              onMarkInactive={() => setShowReasonModal(true)}
              onReturnToActivity={handleReturnToActivity}
              onToggleInspection={handleToggleInspection}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onSave={saveDress}
              saving={saving}
            />
          ),
          items: (
            <ModernDressItemsTab
              dress={dress}
              items={items}
              locations={locations}
              getLabel={getLabel}
              onItemsChange={(next) => {
                itemsRevisionRef.current += 1;
                dressCache.set(id, { model: dress, items: next });
                setItems(next);
              }}
              externalFilter={itemsFilter}
              highlightBarcode={scanBarcode}
              onHighlightHandled={(found, code) => {
                setScanBarcode(null);
                if (!found) flashMessage(`שגיאה: הברקוד ${code} לא נמצא בפריטי הדגם`, 4000);
              }}
            />
          ),
          rentals: (
            <ModernDressRentalsTab dressId={id} active={activeTab === 'rentals'} />
          ),
          history: (
            <ModernDressInfoTab dress={dress} items={items} active={activeTab === 'history'} />
          )
        }}
      />

      {showReasonModal && (
        <ModernInactiveReasonModal
          dress={dress}
          onClose={() => setShowReasonModal(false)}
          onSave={handleSaveInactive}
        />
      )}
    </>
  );
}
