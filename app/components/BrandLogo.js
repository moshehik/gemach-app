"use client";

import { useState, useEffect } from 'react';
import packageJson from '../../package.json';

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

  const versionText = (
    <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px', lineHeight: '1' }}>
      גירסא {packageJson.version} | 09/07/2026 02:45
    </div>
  );

  if (hasError) {
    return (
      <div className="navbar-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '1rem' }}>
        <div>גמ"ח נסיכה</div>
        {versionText}
      </div>
    );
  }

  return (
    <div className="navbar-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0', paddingRight: '1rem' }}>
      <img 
        src={logoUrl} 
        alt="לוגו" 
        style={{ maxHeight: '40px', objectFit: 'contain' }}
        onError={() => setHasError(true)}
      />
      {versionText}
    </div>
  );
}
