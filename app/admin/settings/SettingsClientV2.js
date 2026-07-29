'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Settings, Paintbrush, Building, Save, Upload, Check, 
  AlertCircle, Search, LayoutDashboard, Server, Activity, 
  Command, Printer, Database, X, Info
} from 'lucide-react';

const CATEGORY_ICONS = {
  'תצוגה': Paintbrush,
  'הזמנות': Building,
  'מאגר': Database,
  'כללי': LayoutDashboard,
  'כותרות': Command,
  'תשלומים': Activity,
  'יומן': Server,
  'הדפסות': Printer,
  'Default': Settings,
};

const CATEGORY_DESCRIPTIONS = {
  'תצוגה': 'התאמה אישית של מראה המערכת והלוגו.',
  'הזמנות': 'הגדרות לניהול תהליך ההזמנות ללקוחות.',
  'מאגר': 'הגדרות מאגר ומלאי פריטים.',
  'כללי': 'הגדרות תצורה בסיסיות של האפליקציה.',
  'כותרות': 'טקסטים קבועים למסמכים והדפסות.',
  'תשלומים': 'הגדרות סליקה, אחוזי מקדמה והחזרים.',
  'יומן': 'תצורת תצוגת יומן הפעילות והאירועים.',
  'הדפסות': 'הגדרות חומרה ותצורת המדפסת.',
};

export default function SettingsClientV2() {
  const [settings, setSettings] = useState([]);
  const [originalSettings, setOriginalSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('תצוגה');
  
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef(null);

  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  const categories = useMemo(() => {
    const cats = [...new Set(settings.map(s => s.category).filter(Boolean))];
    if (cats.length === 0) return ['כללי', 'תצוגה', 'הזמנות'];
    if (!cats.includes('תצוגה')) cats.unshift('תצוגה');
    return cats;
  }, [settings]);

  const filteredSettings = useMemo(() => {
    return settings.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = s.category === activeCategory;
      return searchQuery ? matchesSearch : matchesCategory;
    });
  }, [settings, searchQuery, activeCategory]);

  useEffect(() => {
    if (!searchQuery && !categories.includes(activeCategory) && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [searchQuery, categories, activeCategory]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('שגיאה בטעינת ההגדרות');
      const data = await res.json();
      
      const sortedData = data.sort((a, b) => a.name.localeCompare(b.name));
      
      setSettings(sortedData);
      setOriginalSettings(sortedData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('לא ניתן לטעון את ההגדרות. נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSettingChange = (key, newValue) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    try {
      setSaving(true);
      const payload = settings.filter(s => originalSettings.find(orig => orig.key === s.key)?.value !== s.value).map(s => ({ key: s.key, value: s.value }));
      
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error('שגיאה בשמירת ההגדרות');
      
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת ההגדרות. נסה שוב.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload-logo', { 
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('שגיאה בהעלאת התמונה');
      
      const data = await res.json();
      localStorage.setItem('logo_timestamp', data.timestamp);
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: data.timestamp }));
      alert('הלוגו עודכן בהצלחה!');
    } catch (err) {
      console.error('Logo upload error:', err);
      alert('שגיאה בהעלאת הלוגו.');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 font-bold text-lg">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]" dir="rtl">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg flex flex-col items-center max-w-md text-center border border-slate-200 dark:border-slate-700">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">תקלת התחברות</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium">{error}</p>
          <button onClick={fetchSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors w-full">
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-sans pb-32" dir="rtl">
      
      {/* --------------------------------------------------------- */}
      {/* HEADER & TABS NAVIGATION */}
      {/* --------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-40">
        
        {/* Top Header Row */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-2xl shadow-inner border border-blue-200 dark:border-blue-800">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">לוח הגדרות מערכת</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">ניהול תצורה, הרשאות ומראה כללי.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="חיפוש הגדרה..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-9 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl transition-all shadow-inner text-sm font-bold text-slate-700 dark:text-white"
                />
              </div>
            </div>
            
          </div>
        </div>

        {/* Action Bar (Only shows when changes exist) */}
        {hasChanges && (
          <div className="bg-blue-600 border-t border-blue-500 text-white shadow-md animate-in slide-in-from-top-2 duration-300">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-200" />
                <span className="font-bold text-sm sm:text-base">ישנם שינויים שממתינים לשמירה!</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={handleDiscard}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-5 py-2 text-sm font-bold bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  ביטול שינויים
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold bg-white text-blue-700 hover:bg-slate-100 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? 'שומר במערכת...' : 'שמור שינויים'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Navigation (Replaces the broken sidebar) */}
        {!searchQuery && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide pt-4">
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['Default'];
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border
                      ${isActive 
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-md' 
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- */}
      {/* MAIN CONTENT AREA */}
      {/* --------------------------------------------------------- */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Category Header */}
        {!searchQuery && (
          <div className="mb-8 pl-4 border-r-4 border-blue-500 pr-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{activeCategory}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">{CATEGORY_DESCRIPTIONS[activeCategory] || 'ניהול הגדרות לקטגוריה זו'}</p>
          </div>
        )}
        
        {/* Search Header */}
        {searchQuery && (
          <div className="mb-8 pl-4 border-r-4 border-amber-500 pr-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">חיפוש: "{searchQuery}"</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">נמצאו {filteredSettings.length} תוצאות</p>
          </div>
        )}

        {/* Empty State */}
        {filteredSettings.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-sm">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">לא נמצאו הגדרות</h3>
            <p className="text-slate-500 font-medium">נסה מילות מפתח אחרות.</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Logo Upload Card */}
            {activeCategory === 'תצוגה' && !searchQuery && !filteredSettings.find(s => s.key === 'app_logo') && (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">לוגו מערכת ראשי</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
                      העלה לוגו חדש למערכת. יופיע בכותרת המערכת ובמסמכים מודפסים.
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="w-full sm:w-auto flex justify-center items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-6 py-3 rounded-xl font-bold transition-colors border border-blue-100 dark:border-blue-800"
                    >
                      {logoUploading ? <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" /> : <Upload className="w-5 h-5" />}
                      <span>{logoUploading ? 'מעלה...' : 'בחר תמונה'}</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} />
                  </div>
                </div>
              </div>
            )}

            {/* Settings Cards List */}
            {filteredSettings.map((setting) => {
              const isModified = originalSettings.find(s => s.key === setting.key)?.value !== setting.value;
              const isBoolean = setting.type === 'boolean';
              const isNumber = setting.type === 'number';
              const currentValue = setting.value;

              if (setting.key === 'app_logo' && activeCategory === 'תצוגה' && !searchQuery) return null;

              return (
                <div key={setting.key} className="relative bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  
                  {isModified && (
                    <div className="absolute top-0 right-0 w-2 h-full bg-amber-400" />
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                    
                    {/* Setting Details */}
                    <div className="flex-1 w-full max-w-xl">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {setting.name}
                        </h3>
                      </div>
                      
                      {/* Subtitle / Notes rendered solidly, no more floaty tooltips! */}
                      {setting.notes && (
                        <div className="flex items-start gap-2 mt-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                          <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                            {setting.notes}
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-600">
                          {setting.key}
                        </span>
                      </div>
                    </div>

                    {/* Setting Input / Control */}
                    <div className="w-full sm:w-auto flex sm:justify-end items-center mt-2 sm:mt-0">
                      
                      {isBoolean ? (
                        /* Bulletproof React Button Toggle instead of CSS Hack */
                        <button
                          type="button"
                          onClick={() => handleSettingChange(setting.key, (currentValue === 'true' || currentValue === true) ? 'false' : 'true')}
                          className={`
                            relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
                            ${(currentValue === 'true' || currentValue === true) ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}
                          `}
                        >
                          <span className="sr-only">החלף {setting.name}</span>
                          <span
                            className={`
                              pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                              ${(currentValue === 'true' || currentValue === true) ? '-translate-x-6' : 'translate-x-0'}
                            `}
                          />
                        </button>
                      ) : (
                        <div className="w-full sm:w-72">
                          {(currentValue && currentValue.toString().length > 50) ? (
                            <textarea
                              value={currentValue || ''}
                              onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                              rows={3}
                              dir="auto"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y shadow-inner text-base"
                            />
                          ) : (
                            <input
                              type={isNumber ? 'number' : 'text'}
                              value={currentValue || ''}
                              onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                              dir="auto"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner text-base"
                            />
                          )}
                        </div>
                      )}
                      
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
