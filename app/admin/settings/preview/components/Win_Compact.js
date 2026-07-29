import React, { useState } from 'react';
import { Save, RefreshCw, Settings, Bell, Palette, User, Database, Shield } from 'lucide-react';

export default function Win_Compact() {
  const [settings, setSettings] = useState({
    storeName: 'גמ"ח שמלות חסדי נעמי',
    phoneNumber: '050-1234567',
    address: 'רחוב חזון איש 10, בני ברק',
    email: 'info@gemach.co.il',
    theme: 'light',
    compactMode: true,
    notificationsEnabled: true,
    autoBackup: true,
    currency: 'ILS',
    maxRentDays: 14
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  const inputClass = "w-full p-1.5 text-xs bg-white border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all";
  const labelClass = "block text-[11px] font-medium text-gray-700 mb-0.5";
  const sectionClass = "bg-[#f9f9f9] rounded border border-gray-200 p-2 mb-2 shadow-sm";
  const sectionTitleClass = "text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5 pb-1 border-b border-gray-200";

  return (
    <div dir="rtl" className="min-h-screen bg-[#f3f3f3] text-gray-900 p-2 font-sans selection:bg-blue-200">
      <div className="max-w-4xl mx-auto bg-white rounded shadow-sm border border-gray-300 overflow-hidden flex flex-col h-[95vh]">
        
        {/* Header */}
        <div className="bg-[#f0f0f0] p-1.5 flex justify-between items-center border-b border-gray-300 shrink-0">
          <div className="flex items-center gap-1.5 px-1">
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <h1 className="text-xs font-bold text-gray-800">הגדרות מערכת (Win11 Compact)</h1>
          </div>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setSettings(settings)}
              className="px-2 py-1 text-[11px] bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>שחזר</span>
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-2 py-1 text-[11px] bg-[#005fb8] hover:bg-[#005fb8]/90 text-white rounded transition-colors flex items-center gap-1 disabled:opacity-70"
            >
              <Save className="w-3 h-3" />
              <span>{isSaving ? 'שומר...' : 'שמור'}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-1.5 flex flex-col md:flex-row gap-1.5 bg-white">
          
          {/* Sidebar */}
          <div className="w-full md:w-40 bg-[#f9f9f9] rounded border border-gray-200 p-1 shrink-0 flex flex-col gap-0.5">
            {[
              { id: 'general', icon: User, label: 'כללי' },
              { id: 'appearance', icon: Palette, label: 'תצוגה ועיצוב' },
              { id: 'notifications', icon: Bell, label: 'התראות' },
              { id: 'data', icon: Database, label: 'גיבוי ונתונים' },
              { id: 'security', icon: Shield, label: 'אבטחה' },
            ].map((item, idx) => (
              <button 
                key={item.id}
                className={`flex items-center gap-1.5 p-1 text-[11px] rounded text-right w-full ${idx === 0 ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600 border border-transparent'}`}
              >
                <item.icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Main Settings Area */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
            
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>
                <User className="w-3 h-3 text-gray-500" />
                <span>פרטי העסק</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>שם הגמ"ח</label>
                  <input type="text" name="storeName" value={settings.storeName} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>טלפון ליצירת קשר</label>
                  <input type="text" name="phoneNumber" value={settings.phoneNumber} onChange={handleChange} className={inputClass} dir="ltr" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>כתובת מלאה</label>
                  <input type="text" name="address" value={settings.address} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>כתובת דוא"ל</label>
                  <input type="email" name="email" value={settings.email} onChange={handleChange} className={inputClass} dir="ltr" />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>
                <Settings className="w-3 h-3 text-gray-500" />
                <span>הגדרות השכרה</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>מטבע ברירת מחדל</label>
                  <select name="currency" value={settings.currency} onChange={handleChange} className={inputClass}>
                    <option value="ILS">שקל חדש (₪)</option>
                    <option value="USD">דולר אמריקאי ($)</option>
                    <option value="EUR">אירו (€)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ימי השכרה מקסימליים</label>
                  <input type="number" name="maxRentDays" value={settings.maxRentDays} onChange={handleChange} className={inputClass} min="1" max="90" />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>
                <Palette className="w-3 h-3 text-gray-500" />
                <span>מראה והתנהגות</span>
              </h2>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between p-1 hover:bg-gray-100 rounded">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">מצב קומפקטי</span>
                    <span className="text-[10px] text-gray-500">הקטן ריווחים כדי להציג יותר מידע במסך</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="compactMode" checked={settings.compactMode} onChange={handleChange} className="sr-only peer" />
                    <div className="w-6 h-3.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[-100%] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#005fb8]"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-1 hover:bg-gray-100 rounded">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">ערכת נושא כהה</span>
                    <span className="text-[10px] text-gray-500">השתמש בצבעים כהים</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="theme" checked={settings.theme === 'dark'} onChange={(e) => setSettings({...settings, theme: e.target.checked ? 'dark' : 'light'})} className="sr-only peer" />
                    <div className="w-6 h-3.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[-100%] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#005fb8]"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>
                <Database className="w-3 h-3 text-gray-500" />
                <span>מערכת</span>
              </h2>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between p-1 hover:bg-gray-100 rounded">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">גיבוי אוטומטי</span>
                    <span className="text-[10px] text-gray-500">גבה את הנתונים כל יום בחצות</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="autoBackup" checked={settings.autoBackup} onChange={handleChange} className="sr-only peer" />
                    <div className="w-6 h-3.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[-100%] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#005fb8]"></div>
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
