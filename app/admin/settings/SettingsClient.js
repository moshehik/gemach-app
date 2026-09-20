'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import NeonUsageCard from './NeonUsageCard';
import WebBackupModeToggle from './WebBackupModeToggle';
import { cacheNamespace, invalidateSettings } from '@/app/lib/pageCache';
import { NUMBER_FIELD_LIMITS, validateNumericSetting, validateSelectSetting } from '@/app/lib/settingsValidation';
import { SECRET_SETTING_KEYS, SECRET_MASK, SECRET_SETTING_LINKS } from '@/app/lib/secretSettingKeys';
import {
  SETTINGS_CATEGORY_ICONS,
  SETTINGS_HEBREW_NAMES,
  SETTINGS_HEBREW_NOTES,
  SETTINGS_ORDER,
  SETTINGS_BOOLEAN_KEYS,
  SETTINGS_NUMBER_KEYS,
  SETTINGS_SELECT_OPTIONS,
  SETTINGS_DEVELOPER_CATEGORIES,
  INVERTED_DISPLAY_KEYS,
} from '@/lib/settingsMetadata';

// אליאסים לשמות המקוריים - הנתונים עצמם עברו ל-lib/settingsMetadata.js (מקור
// אמת יחיד, משותף גם עם app/api/settings/guide/route.js לצורך עוזר ה-AI) כדי
// שלא ייווצר עותק שני שעלול לסטות ממנו (ר' סוכם ההגדרות org1/org2 ב-CLAUDE.md).
const CATEGORY_ICONS = SETTINGS_CATEGORY_ICONS;
const HEBREW_NAMES = SETTINGS_HEBREW_NAMES;
const HEBREW_NOTES = SETTINGS_HEBREW_NOTES;

const CUSTOMER_FIELDS = [
  { key: 'firstName', name: 'שם פרטי', alias: 'שם_פרטי' },
  { key: 'lastName', name: 'שם משפחה', alias: 'שם_משפחה' },
  { key: 'phone1', name: 'טלפון ראשי (נייד)', alias: 'טלפון_1' },
  { key: 'phone2', name: 'טלפון נוסף', alias: 'טלפון_2' },
  { key: 'city', name: 'עיר', alias: 'עיר' },
  { key: 'street', name: 'רחוב', alias: 'רחוב' },
  { key: 'houseNum', name: 'מספר בית', alias: 'מספר_בית' },
  { key: 'email', name: 'אימייל', alias: 'אימייל' },
  { key: 'notes', name: 'הערות לקוח', alias: 'הערות' },
  { key: 'officeNotes', name: 'נתוני משרד', alias: 'נתוני_משרד' },
  { key: 'bankName', name: 'שם בנק (לזיכוי)', alias: 'שם_בנק' },
  { key: 'bankBranch', name: 'סניף בנק', alias: 'סניף' },
  { key: 'bankAccount', name: 'חשבון בנק', alias: 'חשבון' }
];

function CustomerFieldsCheckboxPicker({ value, onChange, elementName }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const rawItems = (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const isSelected = (field) => {
    return rawItems.some(item =>
      item.toLowerCase() === field.key.toLowerCase() ||
      item === field.name ||
      item === field.alias
    );
  };

  const toggleField = (field) => {
    const selected = isSelected(field);
    let nextList;
    if (selected) {
      nextList = rawItems.filter(item =>
        item.toLowerCase() !== field.key.toLowerCase() &&
        item !== field.name &&
        item !== field.alias
      );
    } else {
      nextList = [...rawItems, field.alias || field.name];
    }
    onChange(nextList.join(', '));
  };

  const selectAll = () => {
    const allAliases = CUSTOMER_FIELDS.map(f => f.alias || f.name);
    onChange(allAliases.join(', '));
  };

  const clearAll = () => {
    onChange('');
  };

  const count = CUSTOMER_FIELDS.filter(f => isSelected(f)).length;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', gap: '8px' }}>
      <input
        type="text"
        className="input"
        style={{ flex: 1 }}
        value={value || ''}
        data-element-name={elementName || 'שדה_SettingsClient_21'}
        onChange={(e) => onChange(e.target.value)}
        placeholder="בחר שדות חובה או הקלד ערך..."
      />

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="icon"><use href="#i-check" /></svg>
        שדות חובה ({count})
      </button>

      {isOpen && (
        <div className="card" style={{ position: 'absolute', top: '105%', insetInlineEnd: 0, insetInlineStart: 0, zIndex: 100, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              בחירת שדות חובה
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                בחר הכל
              </button>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <button
                type="button"
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                נקה הכל
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {CUSTOMER_FIELDS.map(field => {
              const active = isSelected(field);

              return (
                <div
                  key={field.key}
                  onClick={() => toggleField(field)}
                  className="checkbox-row"
                  style={{
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    background: active ? 'var(--primary-tint)' : 'var(--surface-alt)',
                    border: active ? '1px solid var(--primary-tint-2)' : '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <input type="checkbox" checked={active} readOnly />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px', color: active ? 'var(--primary-solid)' : 'var(--text)' }}>
                      {field.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {field.alias}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentDropdownPicker({ value, onChange, departments, elementName }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // מקור האמת היחיד הוא טבלת Department (דרך /api/departments) - בלי רשימת
  // ברירת מחדל קשיחה בקוד. אם הרשימה ריקה/לא נטענה מציגים על כך הודעה מפורשת.
  const deptList = departments || [];

  const selectedList = (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const toggleDept = (deptName) => {
    let nextList;
    if (selectedList.includes(deptName)) {
      nextList = selectedList.filter(d => d !== deptName);
    } else {
      nextList = [...selectedList, deptName];
    }
    onChange(nextList.join(', '));
  };

  const selectAll = () => {
    const allNames = deptList.map(d => d.name);
    onChange(allNames.join(', '));
  };

  const clearAll = () => {
    onChange('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', gap: '8px' }}>
      <input
        type="text"
        className="input"
        style={{ flex: 1 }}
        value={value || ''}
        data-element-name={elementName || 'שדה_SettingsClient_21'}
        onChange={(e) => onChange(e.target.value)}
        placeholder="בחר מחלקות או הקלד ערך..."
      />

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="icon"><use href="#i-shield" /></svg>
        מחלקות ({selectedList.length})
      </button>

      {isOpen && (
        <div className="card" style={{ position: 'absolute', top: '105%', insetInlineEnd: 0, insetInlineStart: 0, zIndex: 100, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              בחירת מחלקות מורשות
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                בחר הכל
              </button>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <button
                type="button"
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                נקה הכל
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {deptList.length === 0 && (
              <div style={{ padding: '10px', fontSize: '12.5px', color: 'var(--text-3)', textAlign: 'center' }}>
                רשימת המחלקות לא נטענה או שאין מחלקות במערכת.
                <br />
                ניתן לנהל מחלקות במסך <a href="/admin/departments" style={{ color: 'var(--primary-solid)', fontWeight: 700 }}>ניהול מחלקות</a>.
              </div>
            )}
            {deptList.map(dept => {
              const isActive = selectedList.includes(dept.name);

              return (
                <div
                  key={dept.roleId ?? dept.name}
                  onClick={() => toggleDept(dept.name)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--primary-tint)' : 'var(--surface-alt)',
                    border: isActive ? '1px solid var(--primary-tint-2)' : '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px', color: isActive ? 'var(--primary-solid)' : 'var(--text)' }}>
                    {dept.name}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--primary-solid)' : 'var(--text-3)' }}>
                      {isActive ? 'מורשה' : 'חסום'}
                    </span>
                    <div className={isActive ? 'switch on' : 'switch'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// טאבים "שלי" (מתכנת בלבד) - תצורה טכנית של המערכת עצמה (מסד נתונים, אינטגרציית
// מיילים, מצב הסוכן האוטומטי) ולא מדיניות עסקית של הגמ"ח. מוצגים רק בדף הנפרד
// /admin/site-settings (mode="developer"), לא בהגדרות הכלליות של הנהלה ראשית.
// (הרשימה עצמה ב-lib/settingsMetadata.js - SETTINGS_DEVELOPER_CATEGORIES - כדי
// ש-getSettingsPagePath שם ידע להצביע לעמוד הנכון בקישורים ישירים.)
function filterCategoriesForMode(cats, mode) {
  return mode === 'developer'
    ? cats.filter(c => SETTINGS_DEVELOPER_CATEGORIES.includes(c))
    : cats.filter(c => !SETTINGS_DEVELOPER_CATEGORIES.includes(c));
}

// מטמון SWR משותף — ראה app/lib/pageCache.js
const deptsCache = cacheNamespace('departments');

export default function SettingsClient({ mode = 'general' }) {
  // מטמון נפרד לכל מצב, כדי שדף ההגדרות הכללי ודף הגדרות האתר (מתכנת) לא
  // ידרסו זה את רשימת הקטגוריות המסוננת של זה.
  const settingsCache = cacheNamespace(`settings-page-${mode}`);
  const [settings, setSettings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [modified, setModified] = useState({});

  // תמיכה בקישור ישיר להגדרה ספציפית - ?tab=<קטגוריה>&highlight=<key> - נפתח
  // מ-SettingQuickPanel.js ("פתח בעמוד ההגדרות המלא") וגם מכפתור [OPEN_SETTING:key]
  // בצ'אט ה-AI. פותח ישירות את הטאב הנכון וממקד/מהבהב את השורה המבוקשת.
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const highlightParam = searchParams.get('highlight');
  const [highlightedKey, setHighlightedKey] = useState(null);

  const fetchDepartments = async (isPrefetch = false) => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
        deptsCache.set('depts', data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchSettings = async (isPrefetch = false) => {
    try {
      if (!isPrefetch) setLoading(true);
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('שגיאה בטעינת ההגדרות');
      const data = await res.json();

      const rawCats = [...new Set(data.map(s => s.category).filter(Boolean))];
      if (!rawCats.includes('תצוגה')) {
        rawCats.unshift('תצוגה');
      }
      if (!rawCats.includes('מסד נתונים')) {
        rawCats.push('מסד נתונים');
      }
      const cats = filterCategoriesForMode(rawCats, mode);

      settingsCache.set('settings', { settings: data, cats });

      setSettings(data);
      setCategories(cats);
      if (cats.length > 0 && !activeTab) {
        setActiveTab(tabParam && cats.includes(tabParam) ? tabParam : cats[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // SWR Cache Hit for Settings
    if (settingsCache.has('settings')) {
      const data = settingsCache.get('settings');
      setSettings(data.settings);
      setCategories(data.cats);
      if (data.cats.length > 0 && !activeTab) {
        setActiveTab(tabParam && data.cats.includes(tabParam) ? tabParam : data.cats[0]);
      }
      setLoading(false);
    }
    // SWR Cache Hit for Departments
    if (deptsCache.has('depts')) {
      setDepartments(deptsCache.get('depts'));
    }

    fetchSettings(settingsCache.has('settings'));
    fetchDepartments(deptsCache.has('depts'));
  }, []);

  // ממקד ומהבהב את שורת ההגדרה שביקש ה-?highlight= (ר' למעלה) - רץ מחדש כש-activeTab
  // מתעדכן כדי לוודא שהשורה כבר קיימת ב-DOM (הטאב הנכון נבחר) לפני שמנסים לגלול אליה.
  useEffect(() => {
    if (!highlightParam || loading) return;
    const el = document.getElementById(`setting-row-${highlightParam}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedKey(highlightParam);
    const timer = setTimeout(() => setHighlightedKey(null), 2600);
    return () => clearTimeout(timer);
  }, [highlightParam, activeTab, loading]);

  const handleChange = (key, newValue) => {
    setModified(prev => {
      const next = { ...prev, [key]: newValue };
      if (key === 'BUFFER_DAYS') next['inventory_buffer_days'] = newValue;
      if (key === 'inventory_buffer_days') next['BUFFER_DAYS'] = newValue;
      if (key === 'NEDARIM_MOSAD') next['nedarim_plus_terminal'] = newValue;
      if (key === 'nedarim_plus_terminal') next['NEDARIM_MOSAD'] = newValue;
      return next;
    });
  };

  const handleSave = async () => {
    if (Object.keys(modified).length === 0) return;

    const invalidEntry = Object.entries(modified).find(([key, value]) => validateNumericSetting(key, value) !== null);
    if (invalidEntry) {
      setError(`${HEBREW_NAMES[invalidEntry[0]] || invalidEntry[0]}: ${validateNumericSetting(invalidEntry[0], invalidEntry[1])}`);
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setError(null);

    const payload = Object.entries(modified).map(([key, value]) => ({ key, value }));

    try {
      let res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });

      // אין עובד מחובר (למשל כשמנסים להפעיל את "חובת התחברות למערכת" בעצמה,
      // כשאף אחד עדיין לא מחובר) — נדרש אישור הנהלה ראשית/מתכנת נקודתי, כמו
      // בפעולות רגישות אחרות במערכת (למשל שמירת הזמנה עם יתרת חוב). ההגדרות
      // מוגבלות להנהלה ראשית/מתכנת בלבד - לא מנהל סניף רגיל (ר' app/api/settings/route.js).
      if (res.status === 401) {
        const authResult = await window.customAuthPrompt('שמירת ההגדרות דורשת הרשאת הנהלה ראשית/מתכנת. אנא בחר מנהל והזן סיסמה:', 'הנהלה ראשית');
        if (!authResult || !authResult.pin) {
          setSaving(false);
          setSaveMessage('השמירה בוטלה: נדרש אישור הנהלה ראשית/מתכנת.');
          return;
        }
        res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload, employeeId: authResult.employeeId, pin: authResult.pin })
        });
      }

      if (!res.ok) throw new Error('שגיאה בשמירת ההגדרות');

      // ההגדרות השתנו — מפנים גם את מטמון הדף הזה וגם את מטמון /api/settings
      // המשותף (getSettingsCached), כדי שדפים אחרים יקבלו ערכים עדכניים מיד.
      settingsCache.clear();
      invalidateSettings();

      setSaveMessage('ההגדרות נשמרו בהצלחה במערכת.');
      setModified({});

      setSettings(prev => prev.map(s => {
        if (modified[s.key] !== undefined) {
          return { ...s, value: modified[s.key] };
        }
        return s;
      }));

      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת הלוגו');

      setSaveMessage('הלוגו עודכן בהצלחה! מרענן תצוגה...');
      localStorage.setItem('logo_timestamp', data.timestamp);
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: data.timestamp }));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        טוען הגדרות...
      </div>
    );
  }

  // NEDARIM_MOSAD ו-nedarim_plus_terminal נשמרים בכוונה כשני מפתחות מסונכרנים תמיד
  // לאותו ערך (לתמיכה בקוד ישן שמחפש את השם הישן) - מציגים רק אחד מהם כדי שלא
  // ייראו כשני שדות כפולים באותו מסך.
  const tabOrder = SETTINGS_ORDER[activeTab];
  const activeSettings = settings
    .filter(s => s.category === activeTab && s.key !== 'NEDARIM_MOSAD')
    .sort((a, b) => {
      if (!tabOrder) return 0;
      const ia = tabOrder.indexOf(a.key);
      const ib = tabOrder.indexOf(b.key);
      return (ia === -1 ? tabOrder.length : ia) - (ib === -1 ? tabOrder.length : ib);
    });
  const hasChanges = Object.keys(modified).length > 0;
  const hasValidationErrors = Object.entries(modified).some(
    ([key, value]) => validateNumericSetting(key, value) !== null || validateSelectSetting(key, value) !== null
  );

  const currentIcon = CATEGORY_ICONS[activeTab] || CATEGORY_ICONS['default'];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{mode === 'developer' ? 'הגדרות אתר' : 'הגדרות מערכת'}</h1>
          <div className="page-desc">
            {mode === 'developer'
              ? 'תצורה טכנית למתכנת בלבד: מסד נתונים, מערכת ומיילים'
              : 'ניהול תצורת הגמ״ח, התאמה אישית והעדפות'}
          </div>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className={hasValidationErrors ? 'btn btn-danger-ghost' : 'btn btn-primary'}
            onClick={handleSave}
            disabled={saving || !hasChanges || hasValidationErrors}
            title={hasValidationErrors ? 'יש לתקן ערכים לא תקינים לפני השמירה' : undefined}
          >
            {saving ? (
              <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
            ) : (
              <svg className="icon"><use href="#i-check" /></svg>
            )}
            {saving ? 'שומר...' : hasValidationErrors ? 'יש לתקן שגיאות' : hasChanges ? 'שמור שינויים' : 'אין שינויים'}
          </button>
        </div>
      </div>

      {(error || saveMessage) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {error && (
            <div className="callout callout-danger">
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              {error}
            </div>
          )}
          {saveMessage && (
            <div className="callout callout-success">
              <svg className="icon"><use href="#i-check" /></svg>
              {saveMessage}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* Category sidebar */}
        <div className="card card-pad" style={{ width: '250px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '16px' }}>
          {categories.map((cat) => {
            const iconName = CATEGORY_ICONS[cat] || CATEGORY_ICONS['default'];
            const isActive = activeTab === cat;

            return (
              <button
                key={cat}
                type="button"
                className={isActive ? 'tab settings-cat active' : 'tab settings-cat'}
                style={{
                  marginInlineEnd: 0, width: '100%', textAlign: 'start',
                  appearance: 'none', WebkitAppearance: 'none', background: isActive ? undefined : 'none', font: 'inherit', borderTop: 'none'
                }}
                onClick={() => setActiveTab(cat)}
              >
                <svg className="icon"><use href={`#${iconName}`} /></svg>
                {cat}
              </button>
            );
          })}

          {/* עמוד הרשאות נפרד (/admin/permissions) - נגיש רק מכאן (מתכנת). דפי הגישה שם
              הם תיעוד כוונה בלבד (enforced:false ב-lib/permissionsMetadata.js) ואינם נאכפים. */}
          {mode === 'developer' && (
            <Link
              href="/admin/permissions"
              className="tab settings-cat"
              style={{ marginInlineEnd: 0, width: '100%', textAlign: 'start', textDecoration: 'none', borderTop: 'none' }}
            >
              <svg className="icon"><use href="#i-shield" /></svg>
              הרשאות
            </Link>
          )}
        </div>

        {/* Content pane */}
        <div className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', marginBottom: '4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
              <svg className="icon" style={{ width: '20px', height: '20px' }}><use href={`#${currentIcon}`} /></svg>
            </div>
            <div>
              <h2 style={{ fontSize: '17px', margin: 0 }}>{activeTab}</h2>
              <p className="hint" style={{ color: 'var(--text-3)', margin: '2px 0 0', fontSize: '12.5px' }}>ערוך את הגדרות המערכת בקטגוריה זו</p>
            </div>
          </div>

          {activeTab === 'מסד נתונים' && (
            <>
              <WebBackupModeToggle />
              <NeonUsageCard />
            </>
          )}

          {activeTab === 'תצוגה' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '14.5px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg className="icon" style={{ width: '16px', height: '16px', color: 'var(--text-3)' }}><use href="#i-image" /></svg>
                  לוגו ראשי של הגמ״ח
                </h3>
                <p className="hint" style={{ color: 'var(--text-3)', margin: 0, maxWidth: '450px', fontSize: '12.5px' }}>
                  העלה קובץ תמונה (PNG/JPG) שיופיע בראש עמודי המערכת וכן בהדפסות ומסמכים רשמיים.
                </p>
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: uploadingLogo ? 'not-allowed' : 'pointer' }}>
                  {uploadingLogo ? (
                    <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  ) : (
                    <svg className="icon"><use href="#i-upload" /></svg>
                  )}
                  {uploadingLogo ? 'מעלה...' : 'בחר תמונה'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          )}

          {activeSettings.map((setting) => {
            const rawValue = modified[setting.key] !== undefined ? modified[setting.key] : setting.value;
            // רשימות המפתחות עברו ל-lib/settingsMetadata.js (SETTINGS_BOOLEAN_KEYS/
            // SETTINGS_NUMBER_KEYS) - מקור אמת יחיד המשותף גם עם app/api/settings/guide.
            const isBooleanKey = SETTINGS_BOOLEAN_KEYS.includes(setting.key);
            const isBoolean = setting.type === 'boolean' || setting.type === 'checkbox' || rawValue === 'true' || rawValue === 'false' || isBooleanKey;
            const isNumberKey = SETTINGS_NUMBER_KEYS.includes(setting.key);
            const isNumber = setting.type === 'number' || isNumberKey;
            const numberLimit = NUMBER_FIELD_LIMITS[setting.key];
            const numberError = (isNumber && !isBoolean) ? validateNumericSetting(setting.key, rawValue) : null;

            const isHideSetting = INVERTED_DISPLAY_KEYS.includes(setting.key);

            // Determine current state of toggle shown to user
            const uiValue = isHideSetting
              ? (rawValue === 'true' ? 'false' : 'true')
              : rawValue;

            // Determine display name in Hebrew
            let displayName = HEBREW_NAMES[setting.key] || setting.name;
            if (!displayName || displayName === setting.key || /^[a-zA-Z0-9_\-\s]+$/.test(displayName) || displayName.includes('enable_ai_specific')) {
              displayName = HEBREW_NAMES[setting.key] || setting.key;
            }
            if (setting.key === 'hide_ai_features') displayName = 'הפעל בינה מלאכותית (AI)';
            else if (setting.key === 'enable_ai_specific_employees' || setting.name === 'enable_ai_specific_employees') displayName = 'תצוגת AI לעובדים מורשים בלבד';
            else if (setting.key === 'hide_dress_images') displayName = 'הצג תמונות דגמים במערכת';
            else if (setting.key === 'hide_gregorian_calendar') displayName = 'אפשר תאריך לועזי ביומן';
            else if (setting.key === 'hide_internal_messaging') displayName = 'הפעל מערכת הודעות פנימית';
            else if (setting.key === 'hide_error_reporting') displayName = 'הפעל מערכת דיווחי שגיאות';

            let notes = HEBREW_NOTES[setting.key] || setting.notes || '';
            if (!notes || /^[a-zA-Z0-9_\-\s]+$/.test(notes)) {
              notes = HEBREW_NOTES[setting.key] || '';
            }

            const handleToggle = () => {
              if (isHideSetting) {
                const nextDbValue = uiValue === 'true' ? 'true' : 'false';
                handleChange(setting.key, nextDbValue);
              } else {
                const nextDbValue = uiValue === 'true' ? 'false' : 'true';
                handleChange(setting.key, nextDbValue);
              }
            };

            const isMandatoryFieldsSetting = setting.key === 'mandatory_fields';
            const isSelectSetting = setting.type === 'select' || setting.key === 'email_routing_strategy' || setting.key === 'PAYMENT_APPROVAL_LEVEL' || !!SETTINGS_SELECT_OPTIONS[setting.key];
            const isSecretSetting = SECRET_SETTING_KEYS.includes(setting.key);
            // ערך מלא ISO שנכתב אוטומטית ע"י הסוכן (agent_fix_loop_last_activity) - שדה
            // תצוגה בלבד, לא לעריכה ידנית. מוצג בזמן ישראל, לא ה-UTC הגולמי מה-DB.
            const isTimestampSetting = setting.key === 'agent_fix_loop_last_activity';

            const isDepartmentSetting =
              setting.key.toLowerCase().includes('permission') ||
              setting.key.toLowerCase().includes('department') ||
              setting.key === 'cancel_order_permission' ||
              setting.key === 'reserve_permission' ||
              setting.key === 'enable_ai_specific_employees';

            // Helper to check if it needs a larger multiline textbox
            const isMultiline = !isBoolean && !isNumber && !isDepartmentSetting && !isMandatoryFieldsSetting && !isSelectSetting && !isSecretSetting && (
              setting.key.toLowerCase().includes('print') ||
              setting.key.toLowerCase().includes('box') ||
              setting.key.toLowerCase().includes('footer') ||
              setting.key.toLowerCase().includes('locations') ||
              setting.key.toLowerCase().includes('text') ||
              String(rawValue || '').includes('\n') ||
              String(rawValue || '').length > 40
            );

            return (
              <div
                key={setting.key}
                id={`setting-row-${setting.key}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px',
                  padding: '16px 10px', margin: '0 -10px', borderBottom: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: highlightedKey === setting.key ? 'var(--primary-tint)' : 'transparent',
                  transition: 'background 0.6s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '14.5px', margin: '0 0 4px' }}>{displayName}</h3>
                  {notes && (
                    <p className="hint" style={{ color: 'var(--text-3)', margin: 0, maxWidth: '480px', fontSize: '12.5px', lineHeight: 1.4 }}>
                      {notes}
                    </p>
                  )}
                </div>

                <div style={{ width: '320px', flex: '0 0 auto', display: 'flex', justifyContent: isBoolean ? 'flex-end' : undefined }}>
                  {isBoolean ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="hint" style={{ color: 'var(--text-3)' }}>
                        {uiValue === 'true' ? 'פעיל' : 'כבוי'}
                      </span>
                      <button
                        type="button"
                        className={uiValue === 'true' ? 'switch on' : 'switch'}
                        onClick={handleToggle}
                      />
                    </div>
                  ) : isMandatoryFieldsSetting ? (
                    <CustomerFieldsCheckboxPicker
                      value={rawValue || ''}
                      elementName="שדה_SettingsClient_21"
                      onChange={(val) => handleChange(setting.key, val)}
                    />
                  ) : isSelectSetting && setting.key === 'PAYMENT_APPROVAL_LEVEL' ? (
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={rawValue || 'כולם'}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                    >
                      <option value="כולם">כולם (ללא הגבלה - ברירת מחדל)</option>
                      <option value="עובד">עובד (זיהוי עצמי בסיסמה)</option>
                      <option value="מנהל">מנהל סניף / מתכנת</option>
                      <option value="מנהל סניף ומעלה">מנהל סניף ומעלה (כולל הנהלה ראשית)</option>
                    </select>
                  ) : isSelectSetting && setting.key === 'gap_size_price_rule' ? (
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={rawValue || 'none'}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                    >
                      {SETTINGS_SELECT_OPTIONS.gap_size_price_rule.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : isSelectSetting ? (
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={rawValue || 'all_a'}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                    >
                      <option value="all_a">שלח הכל מקישור א&apos; (ראשי)</option>
                      <option value="all_b">שלח הכל מקישור ב&apos; (משני)</option>
                      <option value="bugs_b_rest_a">דיווחי שגיאות מב&apos;, השאר מא&apos;</option>
                    </select>
                  ) : isDepartmentSetting ? (
                    <DepartmentDropdownPicker
                      value={rawValue || ''}
                      departments={departments}
                      elementName="שדה_SettingsClient_21"
                      onChange={(val) => handleChange(setting.key, val)}
                    />
                  ) : isSecretSetting ? (
                    <div style={{ width: '100%' }}>
                      <input
                        type="password"
                        className="input"
                        style={{ width: '100%' }}
                        value={rawValue || ''}
                        autoComplete="off"
                        onFocus={(e) => {
                          // ערך ממוסך שלא נגעו בו — מנקים כדי שההקלדה תתחיל מאפס
                          // ולא תשרשר תווים על גבי הסימון "מוגדר".
                          if (rawValue === SECRET_MASK) handleChange(setting.key, '');
                        }}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        placeholder={rawValue === SECRET_MASK ? 'מוגדר — לחץ כדי להחליף' : 'הדבק ערך חדש...'}
                      />
                      <p className="hint" style={{ margin: '4px 0 0', color: 'var(--text-3)' }}>
                        {SECRET_SETTING_LINKS[setting.key]?.prefix}{' '}
                        {SECRET_SETTING_LINKS[setting.key] && (
                          <a href={SECRET_SETTING_LINKS[setting.key].url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-solid)' }}>
                            {SECRET_SETTING_LINKS[setting.key].label}
                          </a>
                        )}
                        {' '}הערך נשמר מוצפן ולא מוצג שוב לאחר השמירה.
                      </p>
                    </div>
                  ) : isTimestampSetting ? (
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      value={rawValue
                        ? new Date(rawValue).toLocaleString('he-IL', {
                            timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })
                        : 'מעולם לא רץ'}
                      disabled
                      readOnly
                    />
                  ) : isMultiline ? (
                    <textarea
                      className="textarea"
                      style={{ width: '100%', minHeight: '110px' }}
                      value={rawValue || ''}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      placeholder="הקלד ערך..."
                    />
                  ) : (
                    <div style={{ width: '100%' }}>
                      <input
                        type={isNumber ? 'number' : 'text'}
                        className="input"
                        style={{ width: '100%', borderColor: numberError ? 'var(--danger)' : undefined }}
                        value={rawValue || ''}
                        min={isNumber ? numberLimit?.min : undefined}
                        max={isNumber ? numberLimit?.max : undefined}
                        step={isNumber ? (numberLimit?.allowDecimal ? '0.1' : '1') : undefined}
                        onChange={(e) => {
                          if (isNumber) {
                            const pattern = numberLimit?.allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
                            const cleaned = e.target.value.replace(pattern, '');
                            handleChange(setting.key, cleaned);
                          } else {
                            handleChange(setting.key, e.target.value);
                          }
                        }}
                        placeholder={isNumber ? (numberLimit ? `מספר בין ${numberLimit.min} ל-${numberLimit.max}${numberLimit.emptyHint ? ` (${numberLimit.emptyHint})` : ''}...` : 'הזן מספר בלבד...') : 'הקלד ערך...'}
                      />
                      {numberError && (
                        <p style={{ margin: '4px 0 0', color: 'var(--danger)', fontSize: '11.5px', fontWeight: 600 }}>{numberError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activeSettings.length === 0 && activeTab !== 'תצוגה' && activeTab !== 'מסד נתונים' && (
            <div className="empty-state">
              <svg className="icon"><use href="#i-info" /></svg>
              <p>אין הגדרות בקטגוריה זו</p>
            </div>
          )}

        </div>

      </div>
    </>
  );
}
