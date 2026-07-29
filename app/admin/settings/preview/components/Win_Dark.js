import React, { useState } from 'react';
import { 
  Settings, 
  Palette, 
  Bell, 
  Shield, 
  Smartphone, 
  Database,
  ChevronLeft,
  Moon,
  Sun,
  Globe,
  Lock,
  Save,
  RotateCcw,
  CheckCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export default function Win_Dark() {
  const [activeTab, setActiveTab] = useState('general');

  // Dummy settings state
  const [settings, setSettings] = useState({
    theme: 'dark',
    notifications: true,
    language: 'he',
    autoBackup: false,
    privacyMode: 'strict',
  });
  
  const [originalSettings, setOriginalSettings] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const tabs = [
    { id: 'general', label: 'כללי', icon: Settings },
    { id: 'appearance', label: 'התאמה אישית', icon: Palette },
    { id: 'notifications', label: 'התראות', icon: Bell },
    { id: 'privacy', label: 'פרטיות ואבטחה', icon: Shield },
    { id: 'system', label: 'מערכת', icon: Smartphone },
    { id: 'backup', label: 'גיבוי ושחזור', icon: Database },
  ];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setOriginalSettings({ ...settings });
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  const handleReset = () => {
    setSettings({ ...originalSettings });
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const SettingRow = ({ icon: Icon, label, description, control, onClick }) => (
    <div 
      className="flex items-center justify-between p-4 mb-2 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-transparent hover:border-slate-700/80 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded flex items-center justify-center bg-slate-700/40 text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
          <Icon size={20} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-100">{label}</h3>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {control}
        {!control && <ChevronLeft size={16} className="text-slate-500" />}
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto p-6 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">הגדרות</h1>
            <p className="text-sm text-slate-400 mt-1">נהל את הגדרות המערכת והעדפות המשתמש</p>
          </div>
          
          <div className="flex items-center gap-3">
            {hasChanges && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RotateCcw size={16} />
                ביטול שינויים
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded transition-all duration-200 ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <Save size={16} />
              )}
              {saveSuccess ? 'נשמר בהצלחה' : 'שמירת שינויים'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 gap-8 overflow-hidden">
          {/* Sidebar */}
          <div className="w-72 flex flex-col gap-1 overflow-y-auto pr-2 pb-8 custom-scrollbar">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 text-right w-full
                    ${isActive 
                      ? 'bg-slate-800/80 text-white' 
                      : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-blue-500 rounded-l-full" />
                  )}
                  <tab.icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto pl-2 pb-8 custom-scrollbar relative">
            {/* Mica effect background for content area */}
            <div className="absolute inset-0 bg-slate-800/20 backdrop-blur-3xl rounded-xl border border-slate-700/50 pointer-events-none" />
            
            <div className="relative z-10 p-8">
              {activeTab === 'general' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <section>
                    <h2 className="text-lg font-medium text-white mb-4">הגדרות שפה ואזור</h2>
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 shadow-sm">
                      <SettingRow 
                        icon={Globe}
                        label="שפת המערכת"
                        description="בחר את השפה המועדפת לתצוגה"
                        control={
                          <select 
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors"
                            value={settings.language}
                            onChange={(e) => updateSetting('language', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="he">עברית</option>
                            <option value="en">English</option>
                          </select>
                        }
                      />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <section>
                    <h2 className="text-lg font-medium text-white mb-4">ערכת נושא</h2>
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 shadow-sm">
                      <SettingRow 
                        icon={Moon}
                        label="מצב תצוגה"
                        description="בחר בין מצב בהיר למצב כהה"
                        control={
                          <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-md border border-slate-700">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateSetting('theme', 'light'); }}
                              className={`p-1.5 rounded transition-colors ${settings.theme === 'light' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                              <Sun size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateSetting('theme', 'dark'); }}
                              className={`p-1.5 rounded transition-colors ${settings.theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                              <Moon size={16} />
                            </button>
                          </div>
                        }
                      />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <section>
                    <h2 className="text-lg font-medium text-white mb-4">התראות מערכת</h2>
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 shadow-sm">
                      <SettingRow 
                        icon={Bell}
                        label="התראות קופצות"
                        description="הצג התראות על מסך המחשב"
                        onClick={() => updateSetting('notifications', !settings.notifications)}
                        control={
                          <button className={`transition-colors ${settings.notifications ? 'text-blue-500' : 'text-slate-500'}`}>
                            {settings.notifications ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          </button>
                        }
                      />
                    </div>
                  </section>
                </div>
              )}
              
              {activeTab === 'privacy' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <section>
                    <h2 className="text-lg font-medium text-white mb-4">אבטחה ופרטיות</h2>
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 shadow-sm">
                      <SettingRow 
                        icon={Lock}
                        label="רמת פרטיות"
                        description="הגדר את רמת שיתוף הנתונים עם שרתי המערכת"
                        control={
                          <select 
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors"
                            value={settings.privacyMode}
                            onChange={(e) => updateSetting('privacyMode', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="strict">מחמיר (מומלץ)</option>
                            <option value="balanced">מאוזן</option>
                            <option value="basic">בסיסי</option>
                          </select>
                        }
                      />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'backup' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <section>
                    <h2 className="text-lg font-medium text-white mb-4">גיבוי נתונים</h2>
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 shadow-sm">
                      <SettingRow 
                        icon={Database}
                        label="גיבוי אוטומטי בענן"
                        description="שמור עותק של הנתונים שלך בשרת מאובטח"
                        onClick={() => updateSetting('autoBackup', !settings.autoBackup)}
                        control={
                          <button className={`transition-colors ${settings.autoBackup ? 'text-blue-500' : 'text-slate-500'}`}>
                            {settings.autoBackup ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          </button>
                        }
                      />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <section>
                    <h2 className="text-lg font-medium text-white mb-4">אודות המערכת</h2>
                    <div className="space-y-1 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 shadow-sm">
                      <SettingRow 
                        icon={Smartphone}
                        label="גרסת מערכת"
                        description="1.0.0 (Build 2404)"
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}} />
    </div>
  );
}
