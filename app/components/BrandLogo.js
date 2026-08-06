"use client";

import { useState, useEffect } from 'react';
import versionData from '../version.json';

export default function BrandLogo() {
  const [logoUrl, setLogoUrl] = useState('/api/logo');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Check if we have a new timestamp in localStorage
    const ts = localStorage.getItem('logo_timestamp');
    if (ts) {
      setLogoUrl(`/api/logo?v=${ts}`);
    }
  }, []);

  // Listen for a custom event so the logo updates immediately when uploaded in the same window
  useEffect(() => {
    const handleLogoUpdate = (e) => {
      const ts = e.detail || Date.now();
      setLogoUrl(`/api/logo?v=${ts}`);
      setHasError(false); // Reset error state to try loading the new logo
    };
    window.addEventListener('logoUpdated', handleLogoUpdate);
    return () => window.removeEventListener('logoUpdated', handleLogoUpdate);
  }, []);

  // הגירסה עברה ל-tooltip על הלוגו: כשורת טקסט היא הגביהה את עמודת המותג
  // מעל שורת האייקונים (38px) ונקראה כטקסט דיבאג במעטפת מול לקוחות.
  const versionText = `גירסא ${versionData.version} | ${versionData.date}`;

  if (hasError) {
    return (
      <div className="navbar-brand" title={versionText} style={{ display: 'flex', alignItems: 'center', height: '38px', paddingRight: '1rem' }}>
        <div>גמ"ח נסיכה</div>
      </div>
    );
  }

  return (
    <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', height: '38px', paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: '1rem' }}>
      <img
        src={logoUrl}
        alt="לוגו"
        title={versionText}
        style={{ maxHeight: '38px', objectFit: 'contain' }}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
