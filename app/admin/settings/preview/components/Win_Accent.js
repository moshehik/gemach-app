import React, { useState } from 'react';
import { 
  Settings, Bell, Palette, User, Shield, HardDrive, 
  Globe, Moon, Sun, Monitor, ChevronLeft,
  Search, Info
} from 'lucide-react';

export default function Win_Accent() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'he',
    notifications: true,
    autoBackup: false,
    fontSize: 'medium',
    emailAlerts: true
  });

  const tabs = [
    { id: 'general', label: 'מערכת', icon: Settings },
    { id: 'display', label: 'התאמה אישית', icon: Palette },
    { id: 'account', label: 'חשבונות', icon: User },
    { id: 'privacy', label: 'פרטיות ואבטחה', icon: Shield },
    { id: 'update', label: 'עדכונים', icon: Bell },
  ];

  const Toggle = ({ checked, onChange }) => (
    <button 
      onClick={onChange}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:ring-offset-2 ${checked ? 'bg-[#0078D4]' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? '-translate-x-6' : '-translate-x-1'}`} />
    </button>
  );

  return (
    <div dir="rtl" className="flex h-screen bg-[#F3F3F3] text-gray-900 font-sans">
      {/* Sidebar - Windows 11 style */}
      <div className="w-72 bg-[#F3F3F3] flex flex-col">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0078D4] to-blue-600 text-white flex items-center justify-center shadow-md">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">מנהל מערכת</h2>
              <p className="text-sm text-gray-600">admin@gemach.com</p>
            </div>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0078D4]" size={16} />
            <input 
              type="text" 
              placeholder="חפש הגדרות..." 
              className="w-full bg-white border-b-2 border-transparent focus:border-[#0078D4] rounded-md py-2 pr-10 pl-4 text-sm shadow-sm focus:outline-none transition-colors placeholder-gray-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-lg transition-all text-sm relative group ${
                  isActive 
                    ? 'bg-white shadow-sm' 
                    : 'hover:bg-black/5'
                }`}
              >
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-[#0078D4] rounded-full" />
                )}
                <Icon size={18} className={`${isActive ? 'text-[#0078D4]' : 'text-gray-600 group-hover:text-[#0078D4]'} transition-colors`} />
                <span className={`font-medium ${isActive ? 'text-black' : 'text-gray-700'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white m-2 ml-4 rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-8 pb-4">
          <h1 className="text-3xl font-semibold text-[#0078D4] mb-2 flex items-center gap-3">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 pt-4">
          <div className="max-w-3xl space-y-6">
            
            {activeTab === 'general' && (
              <>
                <div className="bg-[#FBFBFB] rounded-xl border border-gray-200 p-1">
                  <div className="flex items-center justify-between p-4 hover:bg-black/5 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                        <Monitor size={20} className="text-[#0078D4]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">תצוגה</p>
                        <p className="text-sm text-gray-500">צגים, בהירות, תצוגת לילה, פרופיל צבע</p>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="text-gray-400" />
                  </div>
                  
                  <div className="h-px bg-gray-200 mx-4" />
                  
                  <div className="flex items-center justify-between p-4 hover:bg-black/5 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                        <Bell size={20} className="text-[#0078D4]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">התראות</p>
                        <p className="text-sm text-gray-500">התראות מאפליקציות, נא לא להפריע</p>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="text-gray-400" />
                  </div>
                </div>

                <div className="bg-[#FBFBFB] rounded-xl border border-gray-200 p-1">
                  <div className="flex items-center justify-between p-4 hover:bg-black/5 rounded-lg transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                        <HardDrive size={20} className="text-[#0078D4]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">גיבוי אוטומטי</p>
                        <p className="text-sm text-gray-500">גבה נתונים לענן</p>
                      </div>
                    </div>
                    <Toggle 
                      checked={settings.autoBackup}
                      onChange={() => setSettings({...settings, autoBackup: !settings.autoBackup})}
                    />
                  </div>
                  
                  <div className="h-px bg-gray-200 mx-4" />
                  
                  <div className="flex items-center justify-between p-4 hover:bg-black/5 rounded-lg transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                        <Globe size={20} className="text-[#0078D4]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">שפת המערכת</p>
                        <p className="text-sm text-gray-500">הגדרת השפה המועדפת</p>
                      </div>
                    </div>
                    <select 
                      className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#0078D4] focus:ring-1 focus:ring-[#0078D4] min-w-[120px] shadow-sm"
                      value={settings.language}
                      onChange={(e) => setSettings({...settings, language: e.target.value})}
                    >
                      <option value="he">עברית</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'display' && (
              <>
                <h3 className="text-lg font-medium text-[#0078D4] mb-3 px-1">בחר מצב</h3>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { id: 'light', icon: Sun, label: 'בהיר' },
                    { id: 'dark', icon: Moon, label: 'כהה' },
                    { id: 'system', icon: Monitor, label: 'מערכת' }
                  ].map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setSettings({...settings, theme: theme.id})}
                      className={`flex flex-col items-center gap-3 p-6 rounded-xl border transition-all ${
                        settings.theme === theme.id 
                          ? 'border-[#0078D4] bg-[#0078D4]/5 ring-1 ring-[#0078D4]' 
                          : 'border-gray-200 hover:border-gray-300 bg-[#FBFBFB]'
                      }`}
                    >
                      <theme.icon size={32} className={settings.theme === theme.id ? 'text-[#0078D4]' : 'text-gray-500'} />
                      <span className={`text-sm font-medium ${settings.theme === theme.id ? 'text-[#0078D4]' : 'text-gray-700'}`}>
                        {theme.label}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="bg-[#FBFBFB] rounded-xl border border-gray-200 p-1">
                  <div className="flex items-center justify-between p-4 hover:bg-black/5 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                        <Palette size={20} className="text-[#0078D4]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">צבעי הדגשה</p>
                        <p className="text-sm text-gray-500">התאם אישית את צבע המערכת</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {['#0078D4', '#E81123', '#0099BC', '#FF8C00', '#10893E'].map(color => (
                        <div key={color} className={`w-6 h-6 rounded-full cursor-pointer border-2 ${color === '#0078D4' ? 'border-gray-400 scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`} style={{backgroundColor: color}} />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Other tabs placeholder logic */}
            {!['general', 'display'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Info size={48} className="text-[#0078D4]/50 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">הגדרות {tabs.find(t => t.id === activeTab)?.label}</h3>
                <p className="text-gray-500 max-w-sm">
                  אזור זה נמצא כרגע בפיתוח ויכיל הגדרות נוספות התואמות לעיצוב חלונות 11 בהמשך.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
