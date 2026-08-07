"use client";

import React, { useState } from 'react';
import UploadZone from '@/app/components/UploadZone';

export default function DatabaseManagementPage() {
  const [file, setFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState({ loading: false, error: null, success: null });

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setStatus({ loading: false, error: null, success: null });
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStatus({ loading: false, error: null, success: null });
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

    } catch (err) {
      setStatus({ loading: false, error: err.message, success: null });
    }
  };

  const isDisabled = status.loading || confirmText !== 'אני מאשר למחוק' || !file;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול נתוני מערכת</h1>
          <p className="page-desc">החלפת כל הנתונים במסד הנתונים הפעיל בקובץ JSON חדש</p>
        </div>
      </div>

      <div className="callout callout-danger" style={{ marginBottom: '20px' }}>
        <svg className="icon"><use href="#i-alert-tri" /></svg>
        <div>
          <strong style={{ display: 'block', marginBottom: '4px' }}>פעולה הרסנית (Destructive)</strong>
          <span>
            העלאת קובץ חדש <strong>מוחקת לחלוטין</strong> את כל הנתונים הקיימים במסד הנתונים הנוכחי ומחליפה אותם בנתונים מהקובץ.
            אנא ודא שאתה מעלה את הקובץ הנכון (בדוק אם אתה בסביבת הטסט או הפרודקשן).
          </span>
        </div>
      </div>

      <div className="card card-pad">
        <div className="field">
          <label htmlFor="mgmt-database-file-upload">1. בחר קובץ נתונים (JSON)</label>
          <UploadZone
            id="mgmt-database-file-upload"
            accept=".json"
            label="גרור/י קובץ לכאן או לחצ/י לבחירה"
            hint="קובץ JSON בלבד"
            file={file}
            onFileSelect={handleFileSelect}
            onRemove={handleRemoveFile}
            disabled={status.loading}
          />
        </div>

        <div className="field">
          <label htmlFor="mgmt-database-confirm">2. אישור מחיקה</label>
          <p className="hint" style={{ margin: '0 0 2px' }}>כדי לאשר את הפעולה, הקלד את המשפט: <strong>אני מאשר למחוק</strong></p>
          <input
            id="mgmt-database-confirm"
            type="text"
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="אני מאשר למחוק"
            disabled={status.loading}
          />
        </div>

        <button
          type="button"
          className="btn btn-danger btn-lg"
          style={{ width: '100%' }}
          onClick={handleUpload}
          disabled={isDisabled}
        >
          <svg className="icon"><use href="#i-trash" /></svg>
          {status.loading ? 'מבצע בדיקה ומעדכן נתונים...' : 'החלף נתונים עכשיו'}
        </button>

        {status.error && (
          <div className="callout callout-danger" style={{ marginTop: '16px' }}>
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            <span>{status.error}</span>
          </div>
        )}

        {status.success && (
          <div className="callout callout-success" style={{ marginTop: '16px' }}>
            <svg className="icon"><use href="#i-check-circle" /></svg>
            <span>{status.success}</span>
          </div>
        )}
      </div>
    </>
  );
}
