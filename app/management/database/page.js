"use client";

import React, { useState } from 'react';

export default function DatabaseManagementPage() {
  const [file, setFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState({ loading: false, error: null, success: null });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus({ loading: false, error: null, success: null });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus({ loading: false, error: 'אנא בחר קובץ להעלאה.', success: null });
      return;
    }
    
    if (confirmText !== 'אני מאשר למחוק') {
      setStatus({ loading: false, error: 'יש להקליד "אני מאשר למחוק" בתיבת האישור.', success: null });
      return;
    }

    setStatus({ loading: true, error: null, success: null });

    try {
      // קריאת הקובץ בצד הלקוח והפיכתו ל-JSON
      const fileText = await file.text();
      let jsonData;
      try {
        jsonData = JSON.parse(fileText);
      } catch (err) {
        throw new Error('הקובץ אינו בפורמט JSON תקין.');
      }

      // שליחה לשרת
      const res = await fetch('/api/dev/db-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      });

      const result = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'אירעה שגיאה לא ידועה.');
      }

      setStatus({ loading: false, error: null, success: 'הנתונים הוחלפו בהצלחה!' });
      setConfirmText('');
      setFile(null);
      // נאפס את הקלט
      document.getElementById('file-upload').value = '';

    } catch (err) {
      setStatus({ loading: false, error: err.message, success: null });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">ניהול נתוני מערכת</h1>
        
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="mr-3">
              <h3 className="text-sm font-medium text-red-800">פעולה הרסנית (Destructive)</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  העלאת קובץ חדש <strong>מוחקת לחלוטין</strong> את כל הנתונים הקיימים במסד הנתונים הנוכחי ומחליפה אותם בנתונים מהקובץ.
                  אנא ודא שאתה מעלה את הקובץ הנכון (בדוק אם אתה בסביבת הטסט או הפרודקשן).
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">1. בחר קובץ נתונים (JSON)</label>
            <input 
              id="file-upload"
              type="file" 
              accept=".json"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">2. אישור מחיקה</label>
            <p className="text-sm text-gray-500 mb-2">כדי לאשר את הפעולה, הקלד את המשפט: <strong>אני מאשר למחוק</strong></p>
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="אני מאשר למחוק"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-2 border"
            />
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleUpload}
              disabled={status.loading || confirmText !== 'אני מאשר למחוק' || !file}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {status.loading ? 'מבצע בדיקה ומעדכן נתונים...' : 'החלף נתונים עכשיו'}
            </button>
          </div>

          {status.error && (
            <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{status.error}</span>
            </div>
          )}
          
          {status.success && (
            <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{status.success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
