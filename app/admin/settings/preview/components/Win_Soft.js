import React, { useState } from 'react';
import { 
  Settings, Save, X, RotateCcw, Bell, Shield, Palette, 
  Smartphone, Monitor, Moon, Sun 
} from 'lucide-react';

export default function Win_Soft() {
  const [settings, setSettings] = useState({
    systemName: 'גמ"ח שמלות',
    theme: 'light',
    notifications: true,
    language: 'he',
    autoSave: true
  });
  const [originalSettings, setOriginalSettings] = useState({ ...settings });

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = () => {
    setOriginalSettings({ ...settings });
    // Add logic here to actually save the settings to a backend or local storage
  };

  const handleCancel = () => {
    setSettings({ ...originalSettings });
  };

  const handleRestore = () => {
    const defaults = {
      systemName: 'גמ"ח שמלות',
      theme: 'light',
      notifications: true,
      language: 'he',
      autoSave: true
    };
    setSettings(defaults);
    setOriginalSettings(defaults);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-sky-50/40 p-6 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-sky-100/50 flex flex-wrap gap-4 justify-between items-center bg-white/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-100/70 rounded-3xl text-sky-600 shadow-sm border border-white">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-700">הגדרות מערכת</h1>
              <p className="text-sm text-slate-500">ניהול תצורה והעדפות</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleRestore}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 bg-white/80 hover:bg-white border border-slate-200/60 rounded-3xl transition-all shadow-sm hover:shadow"
            >
              <RotateCcw className="w-4 h-4" />
              שחזר ברירת מחדל
            </button>
            {hasChanges && (
              <button 
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-3xl transition-all shadow-sm hover:shadow"
              >
                <X className="w-4 h-4" />
                בטל שינויים
              </button>
            )}
            <button 
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-3xl transition-all shadow-sm border ${
                hasChanges 
                  ? 'bg-sky-500 hover:bg-sky-600 text-white border-sky-400/50 shadow-sky-200 hover:shadow-md' 
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              שמור שינויים
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Sidebar / Tabs (Vertical) */}
          <div className="md:col-span-3 space-y-3">
            <button className="w-full flex items-center gap-3 px-4 py-3.5 bg-white shadow-sm border border-white text-sky-600 rounded-3xl font-medium transition-all relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-sky-400 rounded-l-3xl"></div>
              <Monitor className="w-5 h-5" />
              כללי
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-500 hover:bg-white/60 hover:text-slate-700 hover:shadow-sm hover:border hover:border-white/50 rounded-3xl font-medium transition-all border border-transparent">
              <Palette className="w-5 h-5" />
              תצוגה
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-500 hover:bg-white/60 hover:text-slate-700 hover:shadow-sm hover:border hover:border-white/50 rounded-3xl font-medium transition-all border border-transparent">
              <Bell className="w-5 h-5" />
              התראות
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-500 hover:bg-white/60 hover:text-slate-700 hover:shadow-sm hover:border hover:border-white/50 rounded-3xl font-medium transition-all border border-transparent">
              <Shield className="w-5 h-5" />
              אבטחה
            </button>
          </div>

          {/* Main Form Area */}
          <div className="md:col-span-9 space-y-8">
            
            {/* Section 1 */}
            <div className="bg-white/40 border border-white/60 rounded-3xl p-7 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-sky-500" />
                הגדרות כלליות
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">שם המערכת</label>
                  <input 
                    type="text" 
                    value={settings.systemName}
                    onChange={(e) => setSettings({...settings, systemName: e.target.value})}
                    className="w-full max-w-md px-4 py-3 bg-white border border-slate-200/70 rounded-3xl focus:ring-4 focus:ring-sky-100 focus:border-sky-300 outline-none transition-all shadow-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">שפת ממשק</label>
                  <select 
                    value={settings.language}
                    onChange={(e) => setSettings({...settings, language: e.target.value})}
                    className="w-full max-w-md px-4 py-3 bg-white border border-slate-200/70 rounded-3xl focus:ring-4 focus:ring-sky-100 focus:border-sky-300 outline-none transition-all shadow-sm appearance-none"
                    style={{ backgroundPosition: 'left 1rem center' }}
                  >
                    <option value="he">עברית</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="bg-white/40 border border-white/60 rounded-3xl p-7 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
                <Palette className="w-5 h-5 text-sky-500" />
                תצוגה ועיצוב
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-3">ערכת נושא</label>
                  <div className="flex gap-4 max-w-2xl">
                    <button 
                      onClick={() => setSettings({...settings, theme: 'light'})}
                      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all shadow-sm ${
                        settings.theme === 'light' 
                          ? 'border-sky-400 bg-sky-50/80 text-sky-700' 
                          : 'border-white bg-white hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <Sun className="w-7 h-7" />
                      <span className="font-medium text-sm">בהיר</span>
                    </button>
                    <button 
                      onClick={() => setSettings({...settings, theme: 'dark'})}
                      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all shadow-sm ${
                        settings.theme === 'dark' 
                          ? 'border-sky-400 bg-sky-50/80 text-sky-700' 
                          : 'border-white bg-white hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <Moon className="w-7 h-7" />
                      <span className="font-medium text-sm">כהה</span>
                    </button>
                    <button 
                      onClick={() => setSettings({...settings, theme: 'system'})}
                      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all shadow-sm ${
                        settings.theme === 'system' 
                          ? 'border-sky-400 bg-sky-50/80 text-sky-700' 
                          : 'border-white bg-white hover:border-slate-200 text-slate-500'
                      }`}
                    >
                      <Smartphone className="w-7 h-7" />
                      <span className="font-medium text-sm">לפי המערכת</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3 - Switches */}
            <div className="bg-white/40 border border-white/60 rounded-3xl p-7 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5 text-sky-500" />
                העדפות נוספות
              </h2>
              
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center justify-between p-4 bg-white/70 rounded-3xl border border-white shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-medium text-slate-700">התראות מערכת</h3>
                    <p className="text-sm text-slate-500 mt-1">קבל עדכונים על פעולות במערכת</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                    className={`relative inline-flex h-8 w-14 items-center rounded-3xl transition-colors border shadow-inner ${
                      settings.notifications ? 'bg-sky-400 border-sky-500' : 'bg-slate-200 border-slate-300'
                    }`}
                  >
                    <span 
                      className={`inline-block h-6 w-6 transform rounded-3xl bg-white shadow-sm transition-transform ${
                        settings.notifications ? '-translate-x-7' : '-translate-x-1'
                      }`} 
                    />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/70 rounded-3xl border border-white shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-medium text-slate-700">שמירה אוטומטית</h3>
                    <p className="text-sm text-slate-500 mt-1">שמור שינויים בטפסים באופן אוטומטי</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, autoSave: !settings.autoSave})}
                    className={`relative inline-flex h-8 w-14 items-center rounded-3xl transition-colors border shadow-inner ${
                      settings.autoSave ? 'bg-sky-400 border-sky-500' : 'bg-slate-200 border-slate-300'
                    }`}
                  >
                    <span 
                      className={`inline-block h-6 w-6 transform rounded-3xl bg-white shadow-sm transition-transform ${
                        settings.autoSave ? '-translate-x-7' : '-translate-x-1'
                      }`} 
                    />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
