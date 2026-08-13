'use client';

import React, { useState, useEffect, useRef } from 'react';
import FullEmailListModal from '@/components/FullEmailListModal';
import NeonUsageCard from './NeonUsageCard';
import { cacheNamespace, invalidateSettings } from '@/app/lib/pageCache';
import { NUMBER_FIELD_LIMITS, validateNumericSetting } from '@/app/lib/settingsValidation';
import { SECRET_SETTING_KEYS, SECRET_MASK, SECRET_SETTING_LINKS } from '@/app/lib/secretSettingKeys';

const CATEGORY_ICONS = {
  'מיילים': 'i-mail',
  'תצוגה': 'i-grid',
  'מסד נתונים': 'i-database',
  'הזמנות': 'i-bag',
  'מאגר': 'i-database',
  'כללי': 'i-settings',
  'כותרות': 'i-tag',
  'תשלומים': 'i-card',
  'יומן': 'i-calendar',
  'הדפסה': 'i-printer',
  'בינה מלאכותית': 'i-star',
  'לא בשימוש': 'i-info',
  'default': 'i-grid'
};

const HEBREW_NAMES = {
  email_link_a: 'קישור פריסה א\' (ראשי)',
  email_link_b: 'קישור פריסה ב\' (משני)',
  email_routing_strategy: 'אסטרטגיית ניתוב מיילים',
  gmach_name: 'שם הגמ"ח / המערכת',
  gmach_subtitle: 'כותרת משנה לגמ"ח',
  gmach_address: 'כתובת הגמ"ח',
  gmach_phone: 'טלפון הגמ"ח',
  require_login: 'חובת התחברות למערכת',
  item_locations: 'מיקומי פריטים במלאי',
  barcodePrefixLength: 'אורך קידומת ברקוד',
  inventory_include_warehouse: 'ספירת מלאי מחסן',
  main_email: 'כתובת אימייל ראשית',

  mandatory_fields: 'שדות חובה במילוי פרטי הזמנה',
  allow_alterations: 'מעקב ואפשרות תיקונים',
  enable_alterations: 'הפעל אפשרות תיקונים במערכת',
  max_items_per_order: 'כמות פריטים מקסימלית להזמנה',
  allow_free_exchange: 'אפשר החלפת דגם ללא עלות',
  cancel_order_permission: 'הרשאת ביטול הזמנה',
  reserve_permission: 'הרשאת אישור שמלות רזרבה',
  allow_date_change: 'אפשר שינוי טווח תאריכי השכרה',
  BUFFER_DAYS: 'ימי מרווח ביטחון בין השכרות',

  has_variations: 'ניהול וריאציות ודגמים משניים',
  has_underskirts: 'ניהול פריטי עזר ותחתיות',
  barcode_length: 'אורך תווים תקין לברקוד',
  useModelNames: 'הצגת שמות דגמים במערכת',
  useFileNamesForImages: 'טעינת תמונות לפי שם קובץ',

  hide_ai_features: 'הפעל בינה מלאכותית (AI)',
  enable_ai_specific_employees: 'תצוגת AI לעובדים מורשים בלבד',
  hide_dress_images: 'הצג תמונות דגמים במערכת',
  hide_gregorian_calendar: 'אפשר תאריך לועזי ביומן',
  hide_internal_messaging: 'הפעל מערכת הודעות פנימית',
  hide_error_reporting: 'הפעל מערכת דיווחי שגיאות',

  items_name_plural: 'שם פריטים ברבים',
  items_name_singular: 'שם פריט ביחיד',

  refund_per_item: 'חישוב החזר לפי פריט בנפרד',
  registration_fee: 'גביית דמי רישום מראש',
  nedarim_plus_enabled: 'סליקת אשראי בנדרים פלוס',
  nedarim_plus_terminal: 'קוד מוסד נדרים פלוס',
  NEDARIM_MOSAD: 'קוד מוסד נדרים פלוס',
  ENABLE_SET_DISCOUNTS: 'הפעל מבצע סטים וזיכויים',
  REFUND_PERCENTAGE: 'אחוז החזר כספי בביטול',
  REFUND_DAYS: 'ימי זכאות להחזר ממועד האירוע',
  NO_REFUND_DAYS_BEFORE_EVENT: 'ימים ללא החזר לפני אירוע',
  REFUND_DAYS_FROM_ORDER: 'ימי החזר מיום ביצוע ההזמנה',
  REFUND_REPAIRS: 'החזר על עלויות תיקונים',
  CANCELLATION_CREDIT_MINUTES: 'דקות לניצול זיכוי דמי ביטול על פריט חלופי',
  ALLOWED_PAYMENT_METHODS: 'אפשרויות תשלום מורשות',

  calendar_filtering: 'סינון ואירועים עבריים ביומן',
  inventory_skip_weekends: 'דלג על סוף שבוע בחישוב מלאי',
  inventory_buffer_days: 'ימי מרווח ביטחון בין השכרות',

  print_rental_box1: 'הערות השכרה - תיבה 1 (עליונה)',
  print_rental_box2: 'הערות השכרה - תיבה 2 (אמצעית)',
  print_rental_footer: 'הערות השכרה - טקסט תחתון ותקנון'
};

const HEBREW_NOTES = {
  email_link_a: 'הקישור הראשי לשליחת מיילים מהמערכת (Script URL)',
  email_link_b: 'הקישור המשני (מומלץ עבור דיווחי שגיאות או גיבוי)',
  email_routing_strategy: 'קבע איזה קישור ישמש כברירת מחדל ואם להפריד שליחות.',
  gmach_name: 'שם המערכת שיופיע בראש העמוד, במסמכים ובחשבוניות.',
  gmach_subtitle: 'כותרת משנה המופיעה מתחת לשם הגמ"ח בדף הראשי ובתדפיסים.',
  gmach_address: 'כתובת הגמ"ח שתופיע בראש המסמכים והתדפיסים.',
  gmach_phone: 'מספר הטלפון של הגמ"ח שיופיע בראש המסמכים והתדפיסים.',
  require_login: 'משתמשים יצטרכו להזין קוד עובד וסיסמה בכניסה למערכת.',
  item_locations: 'רשימת מיקומים פיזיים בגמ"ח (לדוגמה: מדף א, קומה 2, מחסן אחורי) מופרדים בפסיקים.',
  barcodePrefixLength: 'מספר הספרות הראשונות בברקוד המגדירות את קידומת זיהוי סוג הפריט.',
  inventory_include_warehouse: 'הצג וספור במלאי גם פריטים הנמצאים במחסן או ברזרבה.',
  main_email: 'כתובת האימייל הראשית של הגמ"ח ליצירת קשר והודעות.',

  mandatory_fields: 'סמן בתיבת הבחירה (צ\'קבוקס) את השדות מתוך פרטי לקוח שיהיו חובה בעת מילוי הזמנה.',
  allow_alterations: 'מעקב ואפשרות ניהול תיקונים והתאמות אישיות לשמלות.',
  enable_alterations: 'הצגת אפשרויות לניהול תיקונים בכרטיסי ההזמנה.',
  max_items_per_order: 'הגבלת הכמות המרבית של פריטים שניתן לשבץ בהזמנה אחת.',
  allow_free_exchange: 'אפשרות להחלפת דגם שמלה ללא גביית דמי טיפול נוספים.',
  cancel_order_permission: 'הגדרת הרשאות הנדרשות לצורך ביטול הזמנה במערכת (בחירת מחלקות מורשות).',
  reserve_permission: 'הגדרת הרשאות הנדרשות לאישור שמלות רזרבה (בחירת מחלקות מורשות).',
  allow_date_change: 'מאפשר למשתמש לשנות את טווח תאריכי ההשכרה של ההזמנה.',
  BUFFER_DAYS: 'מספר ימים לפני ואחרי תאריך אירוע שבהם השמלה נחשבת תפוסה במלאי.',

  has_variations: 'אפשרות לנהל פריטי משנה (כגון: ווסט, חליפה) תחת אותו דגם.',
  has_underskirts: 'אפשרות לשילוב פריטי עזר כגון תחתיות יחד עם השמלות.',
  barcode_length: 'מספר התווים התקני לברקוד במאגר השמלות.',
  useModelNames: 'הצגת שם הדגם לצד המזהה הקטלוגי בטפסים ובחיפושים.',
  useFileNamesForImages: 'טעינה אוטומטית של תמונות לפי שם הקובץ מהשרת.',

  hide_ai_features: 'הצגה או הסתרה של תכונות ה-AI, הצאט ושורת החיפוש החכמה.',
  enable_ai_specific_employees: 'אם מופעל, גישה ל-AI תינתן רק לעובדים שצוינו במפורש.',
  hide_dress_images: 'מסתיר תמונות דגמים במסכי הניהול ובכרטיסי הדגמים.',
  hide_gregorian_calendar: 'הסתרת תאריכים לועזיים והתמקדות בלוח העברי.',
  hide_internal_messaging: 'הסתרה או הפעלה של פעמון ההתראות והודעות בין עובדים.',
  hide_error_reporting: 'הסתרה או הפעלה של אפשרות דיווח שגיאות מהמערכת (כפתור גלגל הצלה).',

  items_name_plural: 'הכיתוב שיופיע בכל הטבלאות (למשל: שמלות / חליפות / פריטים).',
  items_name_singular: 'הכיתוב ביחיד (למשל: שמלה / חליפה / פריט).',

  refund_per_item: 'חישוב החזר דמי ביטול בנפרד עבור כל פריט בהזמנה.',
  registration_fee: 'האם לגבות דמי רישום מראש בעת פתיחת הזמנה.',
  nedarim_plus_enabled: 'הפעלת אפשרות סליקת אשראי דרך מערכת נדרים פלוס.',
  nedarim_plus_terminal: 'קוד המוסד המזהה במערכת נדרים פלוס עבור חיוב אשראי.',
  NEDARIM_MOSAD: 'קוד המוסד המזהה במערכת נדרים פלוס עבור חיוב אשראי.',
  ENABLE_SET_DISCOUNTS: 'מתן זיכוי/הנחה אוטומטית על פריטים נלווים בהזמנת סט.',
  REFUND_PERCENTAGE: 'אחוז החזר כספי מסך העסקה בעת ביטול הזמנה.',
  REFUND_DAYS: 'מספר ימים מרבי ממועד האירוע שבהם ניתן לבקש החזר.',
  NO_REFUND_DAYS_BEFORE_EVENT: 'מספר ימים לפני האירוע שמתחתיו לא יינתן החזר כספי.',
  REFUND_DAYS_FROM_ORDER: 'מספר ימים מביצוע ההזמנה שבהם זכאים להחזר מלא.',
  REFUND_REPAIRS: 'כולל עלויות תיקונים בחישוב ההחזר הכספי בביטול.',
  CANCELLATION_CREDIT_MINUTES: 'מספר הדקות לאחר ביטול פריט שבהן דמי הביטול ניתנים לניצול כזיכוי על פריט אחר שנוסף לאותה הזמנה. אם ההזמנה עדיין נערכת ונשמרת רק אחרי שהזמן הזה חלף, הזיכוי עדיין תקף - כי הזמן נספר החל משמירת הביטול בפועל.',
  ALLOWED_PAYMENT_METHODS: 'רשימת אמצעי תשלום מורשים (מופרדים בפסיק, למשל: מזומן,אשראי,העברה).',

  calendar_filtering: 'סינון תצוגת יומן לפי חודשים ומועדים עבריים.',
  inventory_skip_weekends: 'האם לדלג על ימי שישי-שבת בחישוב ימי מרווח ביטחון.',
  inventory_buffer_days: 'מספר ימים לפני ואחרי אירוע שבהם השמלה חסומה במלאי.',

  print_rental_box1: 'טקסט הערות שיופיע בתיבה העליונה בכרטיס השכרה מודפס.',
  print_rental_box2: 'טקסט הערות שיופיע בתיבה האמצעית בכרטיס השכרה מודפס.',
  print_rental_footer: 'טקסט תקנון וחתימה בתחתית כרטיס השכרה מודפס.'
};

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

// מטמון SWR משותף — ראה app/lib/pageCache.js
const settingsCache = cacheNamespace('settings-page');
const deptsCache = cacheNamespace('departments');

export default function SettingsClient() {
  const [settings, setSettings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [modified, setModified] = useState({});

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

      const cats = [...new Set(data.map(s => s.category).filter(Boolean))];
      if (!cats.includes('תצוגה')) {
        cats.unshift('תצוגה');
      }
      if (!cats.includes('מסד נתונים')) {
        cats.push('מסד נתונים');
      }

      settingsCache.set('settings', { settings: data, cats });

      setSettings(data);
      setCategories(cats);
      if (cats.length > 0 && !activeTab) {
        setActiveTab(cats[0]);
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
      if (data.cats.length > 0 && !activeTab) setActiveTab(data.cats[0]);
      setLoading(false);
    }
    // SWR Cache Hit for Departments
    if (deptsCache.has('depts')) {
      setDepartments(deptsCache.get('depts'));
    }

    fetchSettings(settingsCache.has('settings'));
    fetchDepartments(deptsCache.has('depts'));
  }, []);

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
      // כשאף אחד עדיין לא מחובר) — נדרש אישור מנהל נקודתי, כמו בפעולות רגישות
      // אחרות במערכת (למשל שמירת הזמנה עם יתרת חוב).
      if (res.status === 401) {
        const authResult = await window.customAuthPrompt('שמירת ההגדרות דורשת הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
        if (!authResult || !authResult.pin) {
          setSaving(false);
          setSaveMessage('השמירה בוטלה: נדרש אישור מנהל.');
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

  const activeSettings = settings.filter(s => s.category === activeTab);
  const hasChanges = Object.keys(modified).length > 0;
  const hasValidationErrors = Object.entries(modified).some(
    ([key, value]) => validateNumericSetting(key, value) !== null
  );

  const currentIcon = CATEGORY_ICONS[activeTab] || CATEGORY_ICONS['default'];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>הגדרות מערכת</h1>
          <div className="page-desc">ניהול תצורת הגמ״ח, התאמה אישית והעדפות</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setIsEmailModalOpen(true)}>
            <svg className="icon"><use href="#i-mail" /></svg>
            רשימת מיילים מלאה
          </button>

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

          {activeTab === 'מסד נתונים' && <NeonUsageCard />}

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
            const isBooleanKey = [
              'require_login', 'enable_alterations', 'allow_alterations', 'allow_free_exchange',
              'allow_date_change', 'has_variations', 'has_underskirts', 'useModelNames',
              'useFileNamesForImages', 'hide_ai_features', 'enable_ai_specific_employees',
              'hide_dress_images', 'hide_gregorian_calendar', 'hide_internal_messaging',
              'hide_error_reporting', 'refund_per_item', 'registration_fee', 'nedarim_plus_enabled', 'ENABLE_SET_DISCOUNTS',
              'REFUND_REPAIRS', 'inventory_include_warehouse', 'inventory_skip_weekends',
              'calendar_filtering'
            ].includes(setting.key);
            const isBoolean = setting.type === 'boolean' || setting.type === 'checkbox' || rawValue === 'true' || rawValue === 'false' || isBooleanKey;
            const isNumberKey = [
              'max_items_per_order', 'barcodePrefixLength', 'BUFFER_DAYS',
              'barcode_length', 'REFUND_PERCENTAGE', 'REFUND_DAYS',
              'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_DAYS_FROM_ORDER',
              'full_refund_days', 'inventory_buffer_days', 'registration_fee',
              'CANCELLATION_CREDIT_MINUTES'
            ].includes(setting.key);
            const isNumber = setting.type === 'number' || isNumberKey;
            const numberLimit = NUMBER_FIELD_LIMITS[setting.key];
            const numberError = (isNumber && !isBoolean) ? validateNumericSetting(setting.key, rawValue) : null;

            const isHideSetting = setting.key.startsWith('hide_');

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
            const isSelectSetting = setting.type === 'select' || setting.key === 'email_routing_strategy';
            const isSecretSetting = SECRET_SETTING_KEYS.includes(setting.key);

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
              <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
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
                        placeholder={isNumber ? (numberLimit ? `מספר בין ${numberLimit.min} ל-${numberLimit.max}...` : 'הזן מספר בלבד...') : 'הקלד ערך...'}
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

      <FullEmailListModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </>
  );
}
