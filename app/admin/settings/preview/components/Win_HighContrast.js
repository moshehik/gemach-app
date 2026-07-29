import React, { useState } from 'react';
import { Save, RefreshCw, Moon, Sun, Bell, Shield, User, Globe } from 'lucide-react';

export default function Win_HighContrast() {
  const [settings, setSettings] = useState({
    theme: 'dark',
    notifications: true,
    language: 'he',
    privacy: 'strict'
  });

  const handleSave = () => {
    console.log('Settings saved:', settings);
  };

  const handleReset = () => {
    setSettings({
      theme: 'dark',
      notifications: true,
      language: 'he',
      privacy: 'strict'
    });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-black text-white p-8 font-sans selection:bg-yellow-400 selection:text-black">
      <div className="max-w-4xl mx-auto border-4 border-white p-8 outline outline-4 outline-offset-4 outline-black ring-4 ring-white">
        <header className="mb-12 pb-6 border-b-4 border-white flex justify-between items-center">
          <div>
            <h1 className="text-5xl font-black tracking-widest mb-3 text-yellow-400">הגדרות מערכת</h1>
            <p className="text-xl font-bold tracking-wide">מצב ניגודיות גבוהה - נגישות</p>
          </div>
          <div className="p-4 border-4 border-yellow-400">
            <Shield className="w-16 h-16 text-yellow-400" strokeWidth={3} />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Section 1: Appearance */}
          <section className="border-4 border-white p-8 relative">
            <div className="absolute -top-5 right-6 bg-black px-4 font-black text-2xl border-x-4 border-white text-yellow-400">תצוגה</div>
            
            <div className="space-y-8 mt-4">
              <div>
                <label className="block text-xl font-bold mb-4">ערכת נושא</label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setSettings({...settings, theme: 'light'})}
                    className={`flex-1 p-4 border-4 font-bold text-lg flex items-center justify-center gap-3 transition-none focus:outline-none focus:ring-4 focus:ring-yellow-400 ${settings.theme === 'light' ? 'border-yellow-400 text-yellow-400 bg-black' : 'border-white text-white hover:border-yellow-400 hover:text-yellow-400'}`}
                  >
                    <Sun className="w-6 h-6" strokeWidth={3} /> בהיר
                  </button>
                  <button 
                    onClick={() => setSettings({...settings, theme: 'dark'})}
                    className={`flex-1 p-4 border-4 font-bold text-lg flex items-center justify-center gap-3 transition-none focus:outline-none focus:ring-4 focus:ring-yellow-400 ${settings.theme === 'dark' ? 'border-yellow-400 text-yellow-400 bg-black' : 'border-white text-white hover:border-yellow-400 hover:text-yellow-400'}`}
                  >
                    <Moon className="w-6 h-6" strokeWidth={3} /> כהה
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xl font-bold mb-4">שפת מערכת</label>
                <div className="relative">
                  <select 
                    value={settings.language}
                    onChange={(e) => setSettings({...settings, language: e.target.value})}
                    className="w-full bg-black text-white border-4 border-white p-4 pl-12 appearance-none text-xl font-bold focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 rounded-none cursor-pointer"
                  >
                    <option value="he">עברית (Hebrew)</option>
                    <option value="en">אנגלית (English)</option>
                  </select>
                  <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 pointer-events-none text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Preferences */}
          <section className="border-4 border-white p-8 relative">
            <div className="absolute -top-5 right-6 bg-black px-4 font-black text-2xl border-x-4 border-white text-yellow-400">העדפות</div>
            
            <div className="space-y-8 mt-4">
              <div>
                <label className="block text-xl font-bold mb-4">פרטיות ואבטחה</label>
                <div className="relative">
                  <select 
                    value={settings.privacy}
                    onChange={(e) => setSettings({...settings, privacy: e.target.value})}
                    className="w-full bg-black text-white border-4 border-white p-4 pl-12 appearance-none text-xl font-bold focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 rounded-none cursor-pointer"
                  >
                    <option value="strict">מחמיר (מומלץ)</option>
                    <option value="standard">רגיל</option>
                    <option value="custom">מותאם אישית</option>
                  </select>
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 pointer-events-none text-white" strokeWidth={2.5} />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 border-4 border-white hover:border-yellow-400 transition-none group focus-within:border-yellow-400 focus-within:ring-4 focus-within:ring-yellow-400">
                <div className="flex items-center gap-4">
                  <Bell className="w-10 h-10 group-hover:text-yellow-400" strokeWidth={2.5} />
                  <div>
                    <div className="text-xl font-bold group-hover:text-yellow-400">התראות מערכת</div>
                    <div className="text-base font-bold mt-1">קבל עדכונים על שינויים</div>
                  </div>
                </div>
                <button 
                  onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                  className="w-24 h-12 border-4 border-white p-1 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400"
                  aria-label="Toggle notifications"
                >
                  <div className={`h-full w-10 ${settings.notifications ? 'bg-yellow-400 float-left' : 'bg-white float-right'}`} />
                </button>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-14 pt-8 border-t-4 border-white flex justify-end gap-6">
          <button 
            onClick={handleReset}
            className="px-8 py-4 bg-black text-white border-4 border-white text-xl font-bold flex items-center gap-3 hover:border-yellow-400 hover:text-yellow-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 transition-none"
          >
            <RefreshCw className="w-8 h-8" strokeWidth={3} /> שחזר בררת מחדל
          </button>
          <button 
            onClick={handleSave}
            className="px-8 py-4 bg-white text-black border-4 border-white text-xl font-bold flex items-center gap-3 hover:bg-yellow-400 hover:border-yellow-400 focus:bg-yellow-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400 transition-none"
          >
            <Save className="w-8 h-8" strokeWidth={3} /> שמור שינויים
          </button>
        </footer>
      </div>
    </div>
  );
}
