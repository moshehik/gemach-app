import React, { useState, useEffect } from 'react';
import { 
  Save, 
  RotateCcw, 
  Bell, 
  Moon, 
  Globe, 
  Printer, 
  Database, 
  Store,
  CreditCard,
  Phone,
  Mail,
  Shield
} from 'lucide-react';

export default function Win_Grouped() {
  const [settings, setSettings] = useState({
    systemName: 'גמ"ח שמלות המרכזי',
    emailNotifications: true,
    smsNotifications: false,
    darkMode: false,
    language: 'he',
    currency: 'ILS',
    printerIP: '192.168.1.100',
    autoBackup: true,
    contactEmail: 'admin@gemach.co.il',
    contactPhone: '050-1234567',
  });

  const [originalSettings, setOriginalSettings] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(JSON.stringify(settings) !== JSON.stringify(originalSettings));
  }, [settings, originalSettings]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setOriginalSettings(settings);
    setIsDirty(false);
    // Add success toast here if needed
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setIsDirty(false);
  };

  const Section = ({ title, children }) => (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-gray-600 mb-3 px-1">{title}</h3>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );

  const SettingRow = ({ icon: Icon, title, description, control, isLast }) => (
    <div className={`flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-md bg-slate-50 text-slate-600 border border-slate-100">
          <Icon size={20} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {description && <span className="text-xs text-gray-500 mt-0.5">{description}</span>}
        </div>
      </div>
      <div className="mr-4">
        {control}
      </div>
    </div>
  );

  const Toggle = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const Input = ({ value, onChange, type = "text", placeholder }) => (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );

  const Select = ({ value, onChange, options }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full rounded-md border border-gray-300 py-1.5 pl-3 pr-8 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#f3f4f6] text-slate-900 pb-12 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">הגדרות מערכת</h1>
            <p className="text-sm text-gray-500 mt-1">ניהול והתאמה אישית של המערכת</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={!isDirty}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={16} />
              ביטול שינויים
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              שמירת הגדרות
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        <Section title="כללי">
          <SettingRow
            icon={Store}
            title="שם המערכת"
            description="השם שיופיע בכותרת האתר ובמסמכים מודפסים"
            control={<Input value={settings.systemName} onChange={(v) => handleChange('systemName', v)} />}
          />
          <SettingRow
            icon={Mail}
            title="דוא״ל ליצירת קשר"
            description="כתובת הדוא״ל לפניות ושירות לקוחות"
            control={<Input value={settings.contactEmail} type="email" onChange={(v) => handleChange('contactEmail', v)} />}
          />
          <SettingRow
            icon={Phone}
            title="טלפון"
            description="מספר הטלפון של הגמ״ח"
            control={<Input value={settings.contactPhone} onChange={(v) => handleChange('contactPhone', v)} />}
            isLast={true}
          />
        </Section>

        <Section title="תצוגה והתראות">
          <SettingRow
            icon={Moon}
            title="מצב לילה (Dark Mode)"
            description="תצוגה כהה להקלה על העיניים"
            control={<Toggle checked={settings.darkMode} onChange={(v) => handleChange('darkMode', v)} />}
          />
          <SettingRow
            icon={Bell}
            title="התראות במייל"
            description="קבלת עדכונים על הזמנות חדשות לדוא״ל"
            control={<Toggle checked={settings.emailNotifications} onChange={(v) => handleChange('emailNotifications', v)} />}
          />
          <SettingRow
            icon={Shield}
            title="התראות SMS"
            description="שליחת הודעות טקסט ללקוחות"
            control={<Toggle checked={settings.smsNotifications} onChange={(v) => handleChange('smsNotifications', v)} />}
          />
          <SettingRow
            icon={Globe}
            title="שפת ממשק"
            description="בחר את השפה המועדפת עליך"
            control={
              <Select 
                value={settings.language} 
                onChange={(v) => handleChange('language', v)} 
                options={[{value: 'he', label: 'עברית'}, {value: 'en', label: 'English'}]}
              />
            }
            isLast={true}
          />
        </Section>

        <Section title="הגדרות מתקדמות">
          <SettingRow
            icon={CreditCard}
            title="מטבע ברירת מחדל"
            description="המטבע בו יוצגו המחירים במערכת"
            control={
              <Select 
                value={settings.currency} 
                onChange={(v) => handleChange('currency', v)} 
                options={[{value: 'ILS', label: 'ש״ח (₪)'}, {value: 'USD', label: 'דולר ($)'}]}
              />
            }
          />
          <SettingRow
            icon={Printer}
            title="כתובת מדפסת (IP)"
            description="כתובת הרשת של מדפסת הקבלות"
            control={<Input value={settings.printerIP} onChange={(v) => handleChange('printerIP', v)} />}
          />
          <SettingRow
            icon={Database}
            title="גיבוי אוטומטי"
            description="ביצוע גיבוי יומי של בסיס הנתונים לענן"
            control={<Toggle checked={settings.autoBackup} onChange={(v) => handleChange('autoBackup', v)} />}
            isLast={true}
          />
        </Section>
      </div>
    </div>
  );
}
