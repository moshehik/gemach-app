'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Save, Check, Loader2, AlertCircle, Info, 
  Palette, ShoppingBag, Database, Settings2, Type, 
  CreditCard, Calendar, Printer, LayoutGrid,
  MonitorSmartphone, Upload, Image as ImageIcon, Sparkles,
  ChevronDown, ChevronUp, ShieldCheck, CheckSquare, Mail
} from 'lucide-react';
import FullEmailListModal from '@/components/FullEmailListModal';

const categoryConfig = {
  'תצוגה': { icon: Palette },
  'הזמנות': { icon: ShoppingBag },
  'מאגר': { icon: Database },
  'כללי': { icon: Settings2 },
  'כותרות': { icon: Type },
  'תשלומים': { icon: CreditCard },
  'יומן': { icon: Calendar },
  'הדפסה': { icon: Printer },
  'בינה מלאכותית': { icon: Sparkles },
  'default': { icon: LayoutGrid }
};

const HEBREW_NAMES = {
  gmach_name: 'שם הגמ"ח / המערכת',
  gmach_subtitle: 'כותרת משנה לגמ"ח',
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
  ALLOWED_PAYMENT_METHODS: 'אפשרויות תשלום מורשות',

  calendar_filtering: 'סינון ואירועים עבריים ביומן',
  inventory_skip_weekends: 'דלג על סוף שבוע בחישוב מלאי',
  inventory_buffer_days: 'ימי מרווח ביטחון בין השכרות',

  print_rental_box1: 'הערות השכרה - תיבה 1 (עליונה)',
  print_rental_box2: 'הערות השכרה - תיבה 2 (אמצעית)',
  print_rental_footer: 'הערות השכרה - טקסט תחתון ותקנון'
};

const HEBREW_NOTES = {
  gmach_name: 'שם המערכת שיופיע בראש העמוד, במסמכים ובחשבוניות.',
  gmach_subtitle: 'כותרת משנה המופיעה מתחת לשם הגמ"ח בדף הראשי ובתדפיסים.',
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
  ALLOWED_PAYMENT_METHODS: 'רשימת אמצעי תשלום מורשים (מופרדים בפסיק, למשל: מזומן,אשראי,העברה).',

  calendar_filtering: 'סינון תצוגת יומן לפי חודשים ומועדים עבריים.',
  inventory_skip_weekends: 'האם לדלג על ימי שישי-שבת בחישוב ימי מרווח ביטחון.',
  inventory_buffer_days: 'מספר ימים לפני ואחרי אירוע שבהם השמלה חסומה במלאי.',

  print_rental_box1: 'טקסט הערות שיופיע בתיבה העליונה בכרטיס השכרה מודפס.',
  print_rental_box2: 'טקסט הערות שיופיע בתיבה האמצעית בכרטיס השכרה מודפס.',
  print_rental_footer: 'טקסט תקנון וחתימה בתחתית כרטיס השכרה מודפס.'
};

const DEFAULT_DEPARTMENTS = [
  { roleId: 0, name: 'הנהלה ראשית' },
  { roleId: 1, name: 'הנהלה' },
  { roleId: 2, name: 'מתכנת' },
  { roleId: 3, name: 'תופרת' },
  { roleId: 4, name: 'מזכירה' },
  { roleId: 6, name: 'מסך לקוחות' }
];

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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'white', border: '2px solid #cbd5e1', borderRadius: '12px',
          padding: '0.35rem 0.65rem', gap: '0.5rem', transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
          boxSizing: 'border-box', overflow: 'hidden'
        }}
      >
        <input 
          type="text"
          value={value || ''}
          data-element-name={elementName || "שדה_SettingsClient_21"}
          onChange={(e) => onChange(e.target.value)}
          placeholder="בחר שדות חובה או הקלד ערך..."
          style={{ 
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: '0.95rem', color: '#0f172a', fontWeight: '500', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            background: isOpen ? '#2563eb' : 'transparent', 
            border: 'none', 
            color: isOpen ? 'white' : '#2563eb', padding: '0.35rem 0.5rem', 
            borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
            transition: 'all 0.2s', flexShrink: 0
          }}
        >
          <CheckSquare size={15} color={isOpen ? 'white' : '#2563eb'} />
          <span>שדות חובה ({count})</span>
          {isOpen ? <ChevronUp size={15} color="white" /> : <ChevronDown size={15} color="#64748b" />}
        </button>
      </div>

      {isOpen && (
        <div 
          style={{ 
            position: 'absolute', top: '105%', right: 0, left: 0,
            background: 'white', border: '1px solid #cbd5e1', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12), 0 10px 10px -5px rgba(0,0,0,0.04)',
            zIndex: 100, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>
              בחירת שדות חובה
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                onClick={selectAll}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                בחר הכל
              </button>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <button 
                type="button" 
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                נקה הכל
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto' }}>
            {CUSTOMER_FIELDS.map(field => {
              const active = isSelected(field);

              return (
                <div 
                  key={field.key}
                  onClick={() => toggleField(field)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.55rem 0.75rem', borderRadius: '10px',
                    background: active ? '#eff6ff' : '#f8fafc',
                    border: active ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={active}
                    readOnly
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.88rem', color: active ? '#1e40af' : '#334155' }}>
                      {field.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
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

  const deptList = (departments && departments.length > 0) ? departments : DEFAULT_DEPARTMENTS;

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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'white', border: '2px solid #cbd5e1', borderRadius: '12px',
          padding: '0.35rem 0.65rem', gap: '0.5rem', transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
          boxSizing: 'border-box', overflow: 'hidden'
        }}
      >
        <input 
          type="text"
          value={value || ''}
          data-element-name={elementName || "שדה_SettingsClient_21"}
          onChange={(e) => onChange(e.target.value)}
          placeholder="בחר מחלקות או הקלד ערך..."
          style={{ 
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: '0.95rem', color: '#0f172a', fontWeight: '500', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            background: isOpen ? '#2563eb' : 'transparent', 
            border: 'none', 
            color: isOpen ? 'white' : '#2563eb', padding: '0.35rem 0.5rem', 
            borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
            transition: 'all 0.2s', flexShrink: 0
          }}
        >
          <ShieldCheck size={15} color={isOpen ? 'white' : '#2563eb'} />
          <span>מחלקות ({selectedList.length})</span>
          {isOpen ? <ChevronUp size={15} color="white" /> : <ChevronDown size={15} color="#64748b" />}
        </button>
      </div>

      {isOpen && (
        <div 
          style={{ 
            position: 'absolute', top: '105%', right: 0, left: 0,
            background: 'white', border: '1px solid #cbd5e1', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12), 0 10px 10px -5px rgba(0,0,0,0.04)',
            zIndex: 100, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>
              בחירת מחלקות מורשות
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                onClick={selectAll}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                בחר הכל
              </button>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <button 
                type="button" 
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                נקה הכל
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
            {deptList.map(dept => {
              const isActive = selectedList.includes(dept.name);

              return (
                <div 
                  key={dept.roleId ?? dept.name}
                  onClick={() => toggleDept(dept.name)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.75rem', borderRadius: '10px',
                    background: isActive ? '#eff6ff' : '#f8fafc',
                    border: isActive ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontWeight: '600', fontSize: '0.9rem', color: isActive ? '#1e40af' : '#334155' }}>
                    {dept.name}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: isActive ? '#2563eb' : '#94a3b8' }}>
                      {isActive ? 'מורשה' : 'חסום'}
                    </span>
                    <div 
                      style={{ 
                        position: 'relative', width: '44px', height: '24px', borderRadius: '999px',
                        background: isActive ? '#2563eb' : '#cbd5e1', transition: 'background-color 0.2s',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <div 
                        style={{ 
                          position: 'absolute', width: '18px', height: '18px', borderRadius: '50%',
                          background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          right: isActive ? '22px' : '3px', transition: 'right 0.2s'
                        }}
                      />
                    </div>
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

const settingsCache = new Map();
const deptsCache = new Map();

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
    
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    
    const payload = Object.entries(modified).map(([key, value]) => ({ key, value }));

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('שגיאה בשמירת ההגדרות');
      
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div data-element-name="רכיב_SettingsClient_1" style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '1.1rem' }}>טוען הגדרות...</p>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  const activeSettings = settings.filter(s => s.category === activeTab);
  const hasChanges = Object.keys(modified).length > 0;
  
  const currentConfig = categoryConfig[activeTab] || categoryConfig['default'];
  const CurrentIcon = currentConfig.icon;

  return (
    <div data-agy-id="settings-page-container" style={{ minHeight: '100vh', background: '#f1f5f9', padding: '2rem', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', 
              width: '56px', height: '56px', borderRadius: '16px', 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              color: 'white', boxShadow: '0 8px 16px -4px rgba(37,99,235,0.2)' 
            }}>
              <Settings size={28} data-element-name="רכיב_SettingsClient_2" />
            </div>
            <div>
              <h1 style={{ 
                margin: 0, fontSize: '2.25rem', fontWeight: '900', 
                background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                display: 'inline-block', letterSpacing: '-0.02em'
              }}>
                הגדרות מערכת
              </h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '1.1rem', fontWeight: '500' }}>
                ניהול תצורת הגמ״ח, התאמה אישית והעדפות
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              data-element-name="כפתור_רשימת_מיילים_מלאה"
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'white', color: '#1e3a8a', border: '1px solid #cbd5e1', padding: '0.75rem 1.25rem',
                borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#1e3a8a'; }}
            >
              <Mail size={18} color="#2563eb" />
              רשימת מיילים מלאה
            </button>

            <button 
              data-element-name="כפתור_SettingsClient_6"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '0.5rem', 
                background: hasChanges ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#cbd5e1', 
                color: hasChanges ? 'white' : '#94a3b8', border: 'none', padding: '0.75rem 1.5rem', 
                borderRadius: '12px', fontWeight: '600', fontSize: '1rem',
                cursor: hasChanges ? 'pointer' : 'not-allowed', 
                boxShadow: hasChanges ? '0 4px 6px -1px rgba(37, 99, 235, 0.3)' : 'none',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              {saving ? <Loader2 size={18} data-element-name="רכיב_SettingsClient_7" className="animate-spin" /> : <Save size={18} data-element-name="רכיב_SettingsClient_8" />}
              {saving ? 'שומר...' : hasChanges ? 'שמור שינויים' : 'אין שינויים'}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {(error || saveMessage) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {error && (
              <div style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem', borderRadius: '12px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} data-element-name="רכיב_SettingsClient_11" />
                {error}
              </div>
            )}
            {saveMessage && (
              <div style={{ background: '#f0fdf4', color: '#166534', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={20} data-element-name="רכיב_SettingsClient_12" />
                {saveMessage}
              </div>
            )}
          </div>
        )}

        {/* Main Content Area - Split Panel Grid */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', minHeight: '600px', background: 'transparent' }}>
          
          {/* Sidebar - Floating Card */}
          <div style={{ 
            width: '260px', 
            background: 'white', 
            borderRadius: '20px', 
            padding: '1.25rem 0.75rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.12), 0 10px 20px -10px rgba(0, 0, 0, 0.04)',
            height: 'fit-content',
            position: 'sticky',
            top: '120px'
          }}>
            {categories.map((cat) => {
              const conf = categoryConfig[cat] || categoryConfig['default'];
              const IconComp = conf.icon;
              const isActive = activeTab === cat;
              
              return (
                <button
                  key={cat}
                  data-element-name="כפתור_SettingsClient_3"
                  onClick={() => setActiveTab(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', width: '100%',
                    borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
                    background: isActive ? '#e0f2fe' : 'transparent',
                    color: isActive ? '#0369a1' : '#475569',
                    textAlign: 'right',
                    transition: 'all 0.2s'
                  }}
                >
                  <IconComp size={20} data-element-name="רכיב_SettingsClient_4" color={isActive ? '#0369a1' : '#64748b'} />
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Content Pane - Floating Card */}
          <div style={{ 
            flex: 1, 
            padding: '2.5rem', 
            background: 'white', 
            borderRadius: '20px', 
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: '#475569' }}>
                <CurrentIcon size={24} data-element-name="רכיב_SettingsClient_9" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>{activeTab}</h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>ערוך את הגדרות המערכת בקטגוריה זו</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              
              {activeTab === 'תצוגה' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ImageIcon size={18} color="#64748b" />
                      לוגו ראשי של הגמ״ח
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem', maxWidth: '450px' }}>
                      העלה קובץ תמונה (PNG/JPG) שיופיע בראש עמודי המערכת וכן בהדפסות ומסמכים רשמיים.
                    </p>
                  </div>
                  <div>
                    <label style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.5rem', 
                      background: 'white', border: '2px solid #e2e8f0', color: '#3b82f6', 
                      padding: '0.6rem 1.2rem', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                      {uploadingLogo ? <Loader2 size={16} data-element-name="רכיב_SettingsClient_16" className="animate-spin" /> : <Upload size={16} />}
                      {uploadingLogo ? 'מעלה...' : 'בחר תמונה'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        data-element-name="שדה_SettingsClient_15"
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
                  'refund_per_item', 'registration_fee', 'nedarim_plus_enabled', 'ENABLE_SET_DISCOUNTS',
                  'REFUND_REPAIRS', 'inventory_include_warehouse', 'inventory_skip_weekends',
                  'calendar_filtering'
                ].includes(setting.key);
                const isBoolean = setting.type === 'boolean' || setting.type === 'checkbox' || rawValue === 'true' || rawValue === 'false' || isBooleanKey;
                const isNumberKey = [
                  'max_items_per_order', 'barcodePrefixLength', 'BUFFER_DAYS',
                  'barcode_length', 'REFUND_PERCENTAGE', 'REFUND_DAYS',
                  'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_DAYS_FROM_ORDER',
                  'full_refund_days', 'inventory_buffer_days', 'registration_fee'
                ].includes(setting.key);
                const isNumber = setting.type === 'number' || isNumberKey;

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

                const isDepartmentSetting = 
                  setting.key.toLowerCase().includes('permission') ||
                  setting.key.toLowerCase().includes('department') ||
                  setting.key === 'cancel_order_permission' ||
                  setting.key === 'reserve_permission' ||
                  setting.key === 'enable_ai_specific_employees';

                // Helper to check if it needs a larger multiline textbox
                const isMultiline = !isBoolean && !isNumber && !isDepartmentSetting && !isMandatoryFieldsSetting && (
                  setting.key.toLowerCase().includes('print') ||
                  setting.key.toLowerCase().includes('box') ||
                  setting.key.toLowerCase().includes('footer') ||
                  setting.key.toLowerCase().includes('locations') ||
                  setting.key.toLowerCase().includes('text') ||
                  String(rawValue || '').includes('\n') ||
                  String(rawValue || '').length > 40
                );

                return (
                  <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1, paddingLeft: '2rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '700' }}>{displayName}</h3>
                      {notes && (
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.4' }}>
                          {notes}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '360px', flexShrink: 0 }}>
                      {isBoolean ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#64748b', width: '40px', textAlign: 'left' }}>
                            {uiValue === 'true' ? 'פעיל' : 'כבוי'}
                          </span>
                          <button
                            type="button"
                            data-element-name="כפתור_SettingsClient_19"
                            onClick={handleToggle}
                            style={{
                              position: 'relative', display: 'inline-flex', height: '28px', width: '52px', 
                              borderRadius: '999px', border: 'none', cursor: 'pointer', outline: 'none',
                              background: uiValue === 'true' ? '#2563eb' : '#cbd5e1',
                              transition: 'background-color 0.2s',
                              alignItems: 'center', boxSizing: 'border-box', overflow: 'hidden', padding: 0
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: '4px',
                                height: '20px', width: '20px', borderRadius: '50%',
                                background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transition: 'right 0.2s',
                                right: uiValue === 'true' ? '28px' : '4px'
                              }}
                            />
                          </button>
                        </div>
                      ) : isMandatoryFieldsSetting ? (
                        <CustomerFieldsCheckboxPicker
                          value={rawValue || ''}
                          elementName="שדה_SettingsClient_21"
                          onChange={(val) => handleChange(setting.key, val)}
                        />
                      ) : isDepartmentSetting ? (
                        <DepartmentDropdownPicker
                          value={rawValue || ''}
                          departments={departments}
                          elementName="שדה_SettingsClient_21"
                          onChange={(val) => handleChange(setting.key, val)}
                        />
                      ) : isMultiline ? (
                        <textarea
                          value={rawValue || ''}
                          data-element-name="שדה_SettingsClient_21"
                          onChange={(e) => handleChange(setting.key, e.target.value)}
                          style={{ 
                            width: '100%', padding: '0.65rem 1rem', borderRadius: '12px', 
                            border: '2px solid #cbd5e1', background: 'white', color: '#0f172a', 
                            fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s',
                            minHeight: '120px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'
                          }}
                          placeholder="הקלד ערך..."
                        />
                      ) : (
                        <input
                          type={isNumber ? 'number' : 'text'}
                          value={rawValue || ''}
                          data-element-name="שדה_SettingsClient_21"
                          onChange={(e) => {
                            if (isNumber) {
                              const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                              handleChange(setting.key, cleaned);
                            } else {
                              handleChange(setting.key, e.target.value);
                            }
                          }}
                          style={{ 
                            width: '100%', padding: '0.65rem 1rem', borderRadius: '12px', 
                            border: '2px solid #cbd5e1', background: 'white', color: '#0f172a', 
                            fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' 
                          }}
                          placeholder={isNumber ? 'הזן מספר בלבד...' : 'הקלד ערך...'}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {activeSettings.length === 0 && activeTab !== 'תצוגה' && (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                  <p style={{ fontSize: '1.1rem' }}>אין הגדרות בקטגוריה זו</p>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      <FullEmailListModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </div>
  );
}
