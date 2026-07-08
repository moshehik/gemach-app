'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DatabaseManagement() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);

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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/admin" className="btn-secondary" style={{ textDecoration: 'none' }}>
          &larr; חזרה לניהול
        </Link>
        <h1 style={{ margin: 0 }}>ניהול מסד נתונים</h1>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>העלאת קובץ אקסס חדש</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          העלה קובץ Access (.accdb) חדש. המערכת תגבה את הנתונים הישנים לקובץ זיפ (ZIP) בתיקיית הגיבויים, 
          ותחל בתהליך ייבוא אוטומטי של הנתונים החדשים למערכת. התהליך עשוי לקחת מספר דקות.
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <input 
            type="file" 
            accept=".accdb" 
            onChange={handleFileChange} 
            disabled={uploading}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}
          />
        </div>

        <button 
          className="btn-primary" 
          onClick={handleUpload} 
          disabled={!file || uploading}
          style={{ width: '100%', padding: '0.75rem', fontSize: '1.1rem' }}
        >
          {uploading ? 'מעבד...' : 'התחל גיבוי וייבוא'}
        </button>

        {uploading && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{status}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
              <div 
                style={{ 
                  width: `${progress}%`, 
                  backgroundColor: 'var(--primary-color)', 
                  height: '100%',
                  transition: 'width 0.5s ease'
                }} 
              />
            </div>
          </div>
        )}

        {!uploading && status && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            borderRadius: '4px',
            backgroundColor: status.includes('שגיאה') ? '#fee2e2' : '#dcfce7',
            color: status.includes('שגיאה') ? '#991b1b' : '#166534'
          }}>
            {status}
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>גיבוי נתונים (Export)</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          הורד גיבוי מלא של כל הנתונים במסד למחשב שלך כקובץ JSON. מומלץ לבצע גיבוי זה לפני ביצוע שינויים גדולים.
        </p>

        <a 
          href="/api/admin/database/export" 
          download 
          className="btn-primary"
          style={{ width: '100%', padding: '0.75rem', fontSize: '1.1rem', display: 'block', textAlign: 'center', textDecoration: 'none' }}
        >
          הורד גיבוי מלא (JSON)
        </a>
      </div>
    </div>
  );
}
