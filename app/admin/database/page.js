'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import UploadZone from '../../components/UploadZone';

export default function DatabaseManagement() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    let interval;
    if (uploading) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/admin/database/status');
          if (res.ok) {
            const data = await res.json();
            setStatus(data.message || 'בטעינה...');
            setProgress(data.progress || 0);
            if (data.status === 'completed' || data.status === 'error') {
              setUploading(false);
              clearInterval(interval);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [uploading]);

  const handleFileChange = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleSyncOffline = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/admin/database/sync-offline', { method: 'POST' });
      const data = await res.json();
      setSyncMessage(data.message || data.error || 'הסתיים.');
    } catch (error) {
      setSyncMessage('שגיאה בחיבור לשרת.');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('מעלה קובץ...');
    setProgress(5);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/database/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        setStatus('שגיאה בהעלאת הקובץ');
        setUploading(false);
      }
    } catch (error) {
      setStatus('שגיאה בחיבור לשרת');
      setUploading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1><svg className="icon"><use href="#i-database" /></svg> ניהול מסד נתונים</h1>
          <p className="page-desc">ייבוא, גיבוי וסנכרון נתונים</p>
        </div>
        <div className="page-actions">
          <Link href="/admin" className="btn btn-secondary">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזרה לניהול
          </Link>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        <div className="card-title-row" style={{ marginBottom: '4px' }}>
          <svg className="icon"><use href="#i-upload" /></svg>
          <h2 style={{ fontSize: '15px', margin: 0 }}>העלאת קובץ אקסס חדש</h2>
        </div>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px', fontSize: '12.5px', maxWidth: '640px' }}>
          העלה קובץ Access (.accdb) חדש. המערכת תגבה את הנתונים הישנים לקובץ זיפ (ZIP) בתיקיית הגיבויים,
          ותחל בתהליך ייבוא אוטומטי של הנתונים החדשים למערכת. התהליך עשוי לקחת מספר דקות.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <UploadZone
            id="database-access-file"
            accept=".accdb"
            onFileSelect={handleFileChange}
            file={file}
            onRemove={handleRemoveFile}
            disabled={uploading}
            label="גרור/י קובץ לכאן או לחצ/י לבחירה"
            hint="קובץ Access (.accdb) בלבד"
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          <svg className="icon"><use href="#i-upload" /></svg>
          {uploading ? 'מעבד...' : 'התחל גיבוי וייבוא'}
        </button>

        {uploading && (
          <div style={{ marginTop: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '6px' }}>
              <span>{status}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-solid)', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}

        {!uploading && status && (
          <div className={`callout ${status.includes('שגיאה') ? 'callout-danger' : 'callout-success'}`} style={{ marginTop: '18px' }}>
            <svg className="icon"><use href={status.includes('שגיאה') ? '#i-x-circle' : '#i-check-circle'} /></svg>
            <span>{status}</span>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        <div className="card-title-row" style={{ marginBottom: '4px' }}>
          <svg className="icon"><use href="#i-download" /></svg>
          <h2 style={{ fontSize: '15px', margin: 0 }}>גיבוי נתונים (Export)</h2>
        </div>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px', fontSize: '12.5px', maxWidth: '640px' }}>
          הורד גיבוי מלא של כל הנתונים במסד למחשב שלך כקובץ JSON. מומלץ לבצע גיבוי זה לפני ביצוע שינויים גדולים.
        </p>

        <a
          href="/api/admin/database/export"
          download
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          <svg className="icon"><use href="#i-download" /></svg>
          הורד גיבוי מלא (JSON)
        </a>
      </div>

      <div className="card card-pad">
        <div className="card-title-row" style={{ marginBottom: '4px' }}>
          <svg className="icon"><use href="#i-refresh" /></svg>
          <h2 style={{ fontSize: '15px', margin: 0 }}>סנכרון נתוני אופליין</h2>
        </div>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px', fontSize: '12.5px', maxWidth: '640px' }}>
          אם המערכת עבדה במצב אופליין (ללא אינטרנט) והנתונים נשמרו זמנית במחשב המקומי,
          לחיצה כאן תעביר את הנתונים שנוצרו במצב אופליין לענן. הסנכרון קורה גם אוטומטית
          בכל הפעלה מחדש של השרת כשהחיבור לאינטרנט חוזר - הכפתור מיועד למקרה שהחיבור
          חזר בלי להפעיל מחדש את השרת.
        </p>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={handleSyncOffline}
          disabled={syncing}
        >
          <svg className="icon"><use href="#i-refresh" /></svg>
          {syncing ? 'מסנכרן...' : 'סנכרן נתוני אופליין עכשיו'}
        </button>

        {syncMessage && (
          <div className={`callout ${syncMessage.includes('שגיאה') ? 'callout-danger' : 'callout-success'}`} style={{ marginTop: '18px' }}>
            <svg className="icon"><use href={syncMessage.includes('שגיאה') ? '#i-x-circle' : '#i-check-circle'} /></svg>
            <span>{syncMessage}</span>
          </div>
        )}
      </div>
    </>
  );
}
