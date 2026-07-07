"use client";

import { useState } from 'react';

export default function LogoSettings() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('הלוגו הועלה בהצלחה!');
        
        // Update local storage so other components know to fetch the new logo
        localStorage.setItem('logo_timestamp', data.timestamp);
        
        // Dispatch event for components in the same window
        window.dispatchEvent(new CustomEvent('logoUpdated', { detail: data.timestamp }));
      } else {
        setMessage(data.error || 'שגיאה בהעלאת הלוגו');
      }
    } catch (err) {
      console.error(err);
      setMessage('שגיאת תקשורת');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="dress-card" style={{ padding: '2rem', marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>הגדרות תצוגה - העלאת לוגו למערכת</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => setFile(e.target.files[0])} 
          style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}
        />
        <button 
          className="btn btn-primary" 
          onClick={handleUpload} 
          disabled={!file || isUploading}
        >
          {isUploading ? 'מעלה...' : 'העלה לוגו'}
        </button>
      </div>
      {message && (
        <p style={{ marginTop: '1rem', color: message.includes('בהצלחה') ? 'var(--primary-color)' : '#e53935' }}>
          {message}
        </p>
      )}
    </div>
  );
}
