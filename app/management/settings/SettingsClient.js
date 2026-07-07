'use client';

import React, { useState, useEffect } from 'react';
import { Save, Check, Loader2, AlertCircle } from 'lucide-react';

export default function SettingsClient() {
  const [settings, setSettings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Local modifications before saving
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
      
      // Extract categories
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
    
    // Build payload: array of { key, value }
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
      
      // Update local state with saved values
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
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Filter settings by active tab
  const activeSettings = settings.filter(s => s.category === activeTab);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === cat 
                ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="p-6 md:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {saveMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 flex-shrink-0" />
            <p>{saveMessage}</p>
          </div>
        )}

        <div className="space-y-8">
          {activeTab === 'תצוגה' && (
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 py-4 border-b border-gray-50 last:border-0">
              <div className="flex-1 max-w-2xl">
                <label className="block text-base font-medium text-gray-900">
                  לוגו מערכת
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  העלה לוגו חדש למערכת (מומלץ בפורמט PNG עם רקע שקוף)
                </p>
              </div>
              <div className="sm:ml-6 flex-shrink-0 flex items-center gap-4">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  disabled={uploadingLogo}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
                {uploadingLogo && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
              </div>
            </div>
          )}
          {activeSettings.map(setting => {
            const currentValue = modified[setting.key] !== undefined ? modified[setting.key] : setting.value;
            const isBoolean = setting.type === 'boolean';
            const isNumber = setting.type === 'number';

            return (
              <div key={setting.key} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 py-4 border-b border-gray-50 last:border-0">
                <div className="flex-1 max-w-2xl">
                  <label htmlFor={setting.key} className="block text-base font-medium text-gray-900">
                    {setting.name}
                  </label>
                  {setting.notes && (
                    <p className="mt-1 text-sm text-gray-500">
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
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                        currentValue === 'true' ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          currentValue === 'true' ? '-translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <input
                      id={setting.key}
                      type={isNumber ? 'number' : 'text'}
                      value={currentValue || ''}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                      placeholder={setting.name}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 flex items-center justify-end border-t border-gray-200 gap-4">
        <span className="text-sm text-gray-500">
          {Object.keys(modified).length > 0 ? `ישנם ${Object.keys(modified).length} שינויים שלא נשמרו` : ''}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || Object.keys(modified).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          שמור שינויים
        </button>
      </div>
    </div>
  );
}
