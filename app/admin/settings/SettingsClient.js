'use client';

import React, { useState, useEffect } from 'react';
import { Save, Check, Loader2, AlertCircle, Sparkles, Upload } from 'lucide-react';

export default function SettingsClient() {
  const [settings, setSettings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [modified, setModified] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      
      setSettings(data);
      
      const cats = [...new Set(data.map(s => s.category).filter(Boolean))];
      if (!cats.includes('תצוגה')) {
        cats.unshift('תצוגה');
      }
      setCategories(cats);
      if (cats.length > 0 && !activeTab) {
        setActiveTab(cats[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, newValue) => {
    setModified(prev => ({ ...prev, [key]: newValue }));
  };

  const handleSave = async () => {
    if (Object.keys(modified).length === 0) return;
    
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    
    const payload = Object.entries(modified).map(([key, value]) => ({ key, value }));

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save settings');
      
      setSaveMessage('ההגדרות נשמרו בהצלחה!');
      setModified({});
      
      setSettings(prev => prev.map(s => {
        if (modified[s.key] !== undefined) {
          return { ...s, value: modified[s.key] };
        }
        return s;
      }));
      
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת הלוגו');
      
      setSaveMessage('הלוגו עודכן בהצלחה!');
      localStorage.setItem('logo_timestamp', data.timestamp);
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: data.timestamp }));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 animate-spin opacity-80"></div>
          <div className="absolute inset-2 rounded-full border-r-4 border-purple-500 animate-spin opacity-60" style={{ animationDuration: '1.5s' }}></div>
        </div>
      </div>
    );
  }

  const activeSettings = settings.filter(s => s.category === activeTab);
  const hasChanges = Object.keys(modified).length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative">
      {/* Background aesthetics */}
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl opacity-50 dark:bg-blue-900/20 transform translate-x-1/3 -translate-y-1/4"></div>
      <div className="absolute bottom-0 left-0 -z-10 w-96 h-96 bg-purple-100/40 rounded-full blur-3xl opacity-50 dark:bg-purple-900/20 transform -translate-x-1/3 translate-y-1/4"></div>

      {/* Header section */}
      <div className="sticky top-0 z-20 flex flex-col md:flex-row items-center justify-between gap-4 p-6 mb-8 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
              הגדרות מערכת
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">ניהול מתקדם של חוויית המשתמש והלוגיקה</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          {hasChanges && (
            <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200/50 animate-pulse">
              ישנם {Object.keys(modified).length} שינויים ממתינים
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`group relative overflow-hidden inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 shadow-lg
              ${hasChanges 
                ? 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-gray-900/25 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500 shadow-none'
              }`}
          >
            {hasChanges && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            )}
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className={`w-5 h-5 transition-transform duration-300 ${hasChanges ? 'group-hover:scale-110' : ''}`} />
            )}
            <span className="relative z-10">שמור שינויים</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      {saveMessage && (
        <div className="mb-6 p-4 bg-green-50/80 backdrop-blur-sm border border-green-200 text-green-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Check className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{saveMessage}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide sticky top-36">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`relative px-5 py-3.5 text-right font-medium whitespace-nowrap rounded-xl transition-all duration-300
                  ${activeTab === cat 
                    ? 'text-blue-700 bg-blue-50/80 dark:bg-blue-900/20 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
                  }`}
              >
                {activeTab === cat && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-blue-600 rounded-r-full dark:bg-blue-500"></div>
                )}
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 overflow-hidden transition-all duration-500">
            
            {activeTab === 'תצוגה' && (
              <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  <div className="flex-1 max-w-2xl">
                    <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100">
                      לוגו מערכת
                    </label>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      העלה לוגו חדש למערכת (מומלץ בפורמט PNG עם רקע שקוף). הלוגו יופיע בכותרת המערכת ובמסמכים המודפסים.
                    </p>
                  </div>
                  <div className="sm:ml-6 flex-shrink-0 flex items-center gap-4">
                    <label className="relative cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm group">
                      <Upload className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">בחר תמונה</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        disabled={uploadingLogo}
                        className="sr-only"
                      />
                    </label>
                    {uploadingLogo && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                  </div>
                </div>
              </div>
            )}

            {activeSettings.map(setting => {
              const currentValue = modified[setting.key] !== undefined ? modified[setting.key] : setting.value;
              const isBoolean = setting.type === 'boolean';
              const isNumber = setting.type === 'number';

              return (
                <div key={setting.key} className="group p-6 md:p-8 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-white/40 dark:hover:bg-gray-800/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="flex-1 max-w-2xl">
                      <label htmlFor={setting.key} className="block text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {setting.name}
                      </label>
                      {setting.notes && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                          {setting.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="sm:ml-6 flex-shrink-0">
                      {isBoolean ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentValue === 'true'}
                          onClick={() => handleChange(setting.key, currentValue === 'true' ? 'false' : 'true')}
                          className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            currentValue === 'true' 
                              ? 'bg-blue-600 shadow-inner' 
                              : 'bg-gray-200 dark:bg-gray-700 shadow-inner'
                          }`}
                          dir="ltr"
                        >
                          <span className="sr-only">Toggle {setting.name}</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out ${
                              currentValue === 'true' ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      ) : (
                        <div className="relative">
                          <input
                            id={setting.key}
                            type={isNumber ? 'number' : 'text'}
                            value={currentValue || ''}
                            onChange={(e) => handleChange(setting.key, e.target.value)}
                            className="block w-full sm:w-64 rounded-xl border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm py-2.5 px-4 transition-all"
                            placeholder={setting.name}
                          />
                          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
