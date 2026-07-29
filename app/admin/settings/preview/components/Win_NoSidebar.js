"use client";

import React, { useState, useEffect } from 'react';
import { 
  Save, 
  RotateCcw, 
  Settings, 
  Palette, 
  Bell, 
  Database, 
  Shield, 
  Monitor,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Win_NoSidebar() {
  const [settings, setSettings] = useState({
    siteName: 'גמ"ח שמלות',
    contactEmail: 'contact@gemach.co.il',
    phoneNumber: '050-1234567',
    address: 'רחוב ירושלים 1, בני ברק',
    primaryColor: '#0078d4',
    language: 'he',
    notifications: true,
    autoBackup: false,
    maxItemsPerUser: 3,
    currency: 'ILS',
    theme: 'light'
  });

  const [originalSettings, setOriginalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    setOriginalSettings(settings);
    setIsSaving(false);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setSettings(originalSettings);
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'general', label: 'כללי', icon: Settings },
    { id: 'appearance', label: 'מראה', icon: Palette },
    { id: 'notifications', label: 'התראות', icon: Bell },
    { id: 'system', label: 'מערכת', icon: Database },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#f3f3f3] text-[#111] font-sans selection:bg-[#0078d4] selection:text-white pb-12">
      {/* Windows 11 Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0078d4]/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#0078d4]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">הגדרות מערכת</h1>
              <p className="text-sm text-gray-500">ניהול ותצורת המערכת</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start md:self-auto">
            {hasChanges && (
              <span className="text-sm text-amber-600 font-medium px-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                ישנם שינויים שלא נשמרו
              </span>
            )}
            
            <button
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-6 py-2 rounded bg-[#0078d4] hover:bg-[#006cbd] text-white flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saveStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'שומר...' : saveStatus === 'success' ? 'נשמר' : 'שמירה'}
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs - Windows Style */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pt-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap rounded-t-md ${
                    isActive 
                      ? 'text-[#0078d4] bg-gray-50/50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0078d4] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[400px]">
          {activeTab === 'general' && (
            <div className="p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-8 pb-4 border-b border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-md text-[#0078d4]">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">הגדרות כלליות</h2>
                  <p className="text-sm text-gray-500">פרטים בסיסיים על המערכת והארגון</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">שם האתר / הגמ"ח</label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={(e) => handleChange('siteName', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">דוא"ל ליצירת קשר</label>
                  <input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">מספר טלפון</label>
                  <input
                    type="tel"
                    value={settings.phoneNumber}
                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">כתובת</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">מטבע</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm"
                  >
                    <option value="ILS">שקל חדש (₪)</option>
                    <option value="USD">דולר אמריקאי ($)</option>
                    <option value="EUR">אירו (€)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">שפת ממשק</label>
                  <select
                    value={settings.language}
                    onChange={(e) => handleChange('language', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm"
                  >
                    <option value="he">עברית</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="mb-8 pb-4 border-b border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-md text-purple-600">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">מראה ועיצוב</h2>
                  <p className="text-sm text-gray-500">התאם אישית את הנראות של המערכת</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">צבע ראשי</label>
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded shadow-sm border border-gray-200"
                        style={{ backgroundColor: settings.primaryColor }}
                      />
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="w-full h-10 p-1 bg-white border border-gray-300 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">ערכת נושא</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleChange('theme', 'light')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded border text-sm transition-colors ${
                          settings.theme === 'light'
                            ? 'border-[#0078d4] bg-blue-50/50 text-[#0078d4]'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        בהיר
                      </button>
                      <button
                        onClick={() => handleChange('theme', 'dark')}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded border text-sm transition-colors ${
                          settings.theme === 'dark'
                            ? 'border-[#0078d4] bg-blue-50/50 text-[#0078d4]'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        כהה
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="mb-8 pb-4 border-b border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-md text-amber-600">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">התראות</h2>
                  <p className="text-sm text-gray-500">ניהול התראות והודעות מהמערכת</p>
                </div>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div className="flex items-start justify-between py-4 bg-gray-50 px-4 rounded-lg">
                  <div className="pl-4">
                    <label className="text-sm font-medium text-gray-900 block">התראות מערכת</label>
                    <span className="text-sm text-gray-500 mt-1 block">קבל התראות על אירועים חשובים במערכת (כגון: השאלות חדשות, איחורים בהחזרות)</span>
                  </div>
                  <div dir="ltr" className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.notifications}
                      onChange={(e) => handleChange('notifications', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0078d4]"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-8 pb-4 border-b border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-md text-emerald-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">מערכת ואבטחה</h2>
                  <p className="text-sm text-gray-500">הגדרות מתקדמות, גיבויים ומדיניות</p>
                </div>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div className="flex items-start justify-between py-4 bg-gray-50 px-4 rounded-lg">
                  <div className="pl-4">
                    <label className="text-sm font-medium text-gray-900 block">גיבוי אוטומטי</label>
                    <span className="text-sm text-gray-500 mt-1 block">בצע גיבוי יומי של כל בסיס הנתונים לענן. מומלץ מאוד לשמירה על המידע.</span>
                  </div>
                  <div dir="ltr" className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.autoBackup}
                      onChange={(e) => handleChange('autoBackup', e.target.checked)}
                    />
                     <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0078d4]"></div>
                  </div>
                </div>

                <div className="py-4">
                  <label className="text-sm font-medium text-gray-900 block mb-2">מקסימום פריטים להשאלה למשתמש</label>
                  <p className="text-sm text-gray-500 mb-3">הגבל את כמות הפריטים שמשתמש בודד יכול לשאול בו זמנית מהגמ"ח.</p>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.maxItemsPerUser}
                    onChange={(e) => handleChange('maxItemsPerUser', parseInt(e.target.value) || 1)}
                    className="w-32 px-3 py-2 bg-white border border-gray-300 rounded focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none transition-shadow text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
