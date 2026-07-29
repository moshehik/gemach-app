import React, { useState } from 'react';
import { 
  Settings, 
  Palette, 
  Globe, 
  Bell, 
  Shield, 
  Save, 
  RefreshCcw,
  Monitor,
  Search,
  User,
  Layout,
  Sliders
} from 'lucide-react';

export default function Win_Fluent() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    theme: 'system',
    language: 'he',
    notifications: true,
    autoBackup: true,
    fontSize: 'medium',
    compactMode: false
  });

  const [originalSettings, setOriginalSettings] = useState(settings);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setOriginalSettings(settings);
      setIsSaving(false);
    }, 800);
  };

  const handleReset = () => {
    setSettings(originalSettings);
  };

  const menuItems = [
    { id: 'general', label: 'כללי', icon: Settings },
    { id: 'appearance', label: 'התאמה אישית', icon: Palette },
    { id: 'display', label: 'תצוגה', icon: Monitor },
    { id: 'privacy', label: 'פרטיות ואבטחה', icon: Shield },
    { id: 'notifications', label: 'התראות', icon: Bell },
    { id: 'system', label: 'מערכת', icon: Sliders },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background decoration for Acrylic effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/20 blur-[120px]"></div>
      </div>

      <div className="flex h-screen overflow-hidden">
        
        {/* Sidebar - Fluent Acrylic Style */}
        <aside className="w-72 flex-shrink-0 flex flex-col bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-l border-white/20 dark:border-white/5 shadow-[2px_0_8px_rgba(0,0,0,0.05)] transition-all">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
                <Settings size={24} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">הגדרות</h1>
            </div>
            
            <div className="relative mb-6">
              <Search className="absolute right-3 top-2.5 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="חפש הגדרות..." 
                className="w-full bg-white/50 dark:bg-black/20 border border-white/40 dark:border-white/10 rounded-md py-2 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-md transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-hide">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === item.id 
                    ? 'bg-white/60 dark:bg-white/10 shadow-sm border border-white/50 dark:border-white/5 relative before:absolute before:right-0 before:top-2 before:bottom-2 before:w-1 before:bg-blue-500 before:rounded-l-full' 
                    : 'hover:bg-white/30 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <item.icon size={18} className={activeTab === item.id ? 'text-blue-600 dark:text-blue-400' : 'opacity-70'} />
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="p-4 mt-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/30 dark:border-white/5">
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                <User size={16} />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">מנהל מערכת</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">admin@gemach.com</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-transparent">
          <div className="max-w-4xl mx-auto p-8 md:p-12">
            
            <header className="mb-10 pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
              <h2 className="text-3xl font-semibold mb-2">
                {menuItems.find(i => i.id === activeTab)?.label}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                נהל את הגדרות ה{menuItems.find(i => i.id === activeTab)?.label} של המערכת.
              </p>
            </header>

            {/* Content Cards - Acrylic Style */}
            <div className="space-y-6">
              
              {activeTab === 'general' && (
                <>
                  <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-xl p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Globe size={20} className="text-blue-500" />
                      שפה ואזור
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">שפת מערכת</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">בחר את השפה הראשית של הממשק</p>
                        </div>
                        <select 
                          value={settings.language}
                          onChange={(e) => setSettings({...settings, language: e.target.value})}
                          className="bg-white/50 dark:bg-black/20 border border-white/40 dark:border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-md"
                        >
                          <option value="he">עברית (Hebrew)</option>
                          <option value="en">אנגלית (English)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-xl p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Save size={20} className="text-green-500" />
                      גיבוי ושמירה
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <div>
                          <p className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">גיבוי אוטומטי</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">גבה נתונים באופן אוטומטי כל יום</p>
                        </div>
                        <div className="relative inline-flex items-center">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={settings.autoBackup}
                            onChange={(e) => setSettings({...settings, autoBackup: e.target.checked})}
                          />
                          <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 rtl:peer-checked:after:-translate-x-[100%] shadow-inner"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'appearance' && (
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-xl p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Palette size={20} className="text-purple-500" />
                    ערכת נושא
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {['light', 'dark', 'system'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSettings({...settings, theme: t})}
                        className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                          settings.theme === t 
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md' 
                            : 'border-white/40 dark:border-white/10 bg-white/30 dark:bg-black/10 hover:bg-white/50 dark:hover:bg-black/20'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center ${
                          t === 'light' ? 'bg-slate-100 text-amber-500' : 
                          t === 'dark' ? 'bg-slate-800 text-blue-300' : 
                          'bg-gradient-to-tr from-slate-200 to-slate-700 text-white'
                        }`}>
                          <Layout size={24} />
                        </div>
                        <span className="text-sm font-medium">
                          {t === 'light' ? 'בהיר' : t === 'dark' ? 'כהה' : 'מערכת'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab !== 'general' && activeTab !== 'appearance') && (
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-xl p-12 text-center shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
                  <Settings size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4 animate-[spin_4s_linear_infinite]" />
                  <h3 className="text-xl font-medium mb-2">הגדרות בבנייה</h3>
                  <p className="text-slate-500">ההגדרות בקטגוריה זו עדיין בפיתוח.</p>
                </div>
              )}

            </div>
          </div>
        </main>

        {/* Action Bar - Floating Fluent style */}
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/40 dark:border-white/10 py-3 px-6 rounded-full shadow-lg transition-all duration-300 ${
          hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'
        }`}>
          <span className="text-sm font-medium whitespace-nowrap">ישנם שינויים שלא נשמרו</span>
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2"></div>
          <button 
            onClick={handleReset}
            disabled={isSaving}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={16} />
            בטל
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 text-sm font-medium px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <RefreshCcw size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}
