import React, { useState } from 'react';
import { Save, Undo, Palette, Bell, Shield, Smartphone } from 'lucide-react';

export default function Win_Elevated() {
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    privacy: 'standard',
    language: 'he'
  });
  
  const [originalSettings, setOriginalSettings] = useState(settings);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = () => {
    setOriginalSettings(settings);
    // Add logic to save
  };

  const handleReset = () => {
    setSettings(originalSettings);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">הגדרות מערכת</h1>
          <div className="flex gap-3">
            <button 
              onClick={handleReset}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                hasChanges 
                  ? 'bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 shadow-md' 
                  : 'bg-slate-100 border-2 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Undo size={18} />
              ביטול שינויים
            </button>
            <button 
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                hasChanges 
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg' 
                  : 'bg-blue-300 text-white cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              שמור שינויים
            </button>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Appearance Card */}
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-200/60 p-6 transition-shadow hover:shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Palette size={24} />
              </div>
              <h2 className="text-xl font-medium text-slate-800">תצוגה ועיצוב</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ערכת נושא</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  value={settings.theme}
                  onChange={(e) => setSettings({...settings, theme: e.target.value})}
                >
                  <option value="light">בהיר</option>
                  <option value="dark">כהה</option>
                  <option value="system">מערכת</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications Card */}
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-200/60 p-6 transition-shadow hover:shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Bell size={24} />
              </div>
              <h2 className="text-xl font-medium text-slate-800">התראות</h2>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border-2 border-slate-100">
              <div>
                <h3 className="font-medium text-slate-800">התראות דחיפה</h3>
                <p className="text-sm text-slate-500">קבל התראות על פעילויות חדשות</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.notifications}
                  onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Privacy Card */}
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-200/60 p-6 transition-shadow hover:shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Shield size={24} />
              </div>
              <h2 className="text-xl font-medium text-slate-800">פרטיות ואבטחה</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">רמת פרטיות</label>
                <div className="grid grid-cols-3 gap-3">
                  {['low', 'standard', 'high'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSettings({...settings, privacy: level})}
                      className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        settings.privacy === level 
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {level === 'low' ? 'בסיסי' : level === 'standard' ? 'רגיל' : 'מחמיר'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Card */}
          <div className="bg-white rounded-xl shadow-md border-2 border-slate-200/60 p-6 transition-shadow hover:shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Smartphone size={24} />
              </div>
              <h2 className="text-xl font-medium text-slate-800">מכשירים מחוברים</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border-2 border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <div>
                    <p className="font-medium text-slate-700 text-sm">Windows PC</p>
                    <p className="text-xs text-slate-400">פעיל כעת</p>
                  </div>
                </div>
                <button className="text-sm text-slate-500 hover:text-red-500 transition-colors">נתק</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
