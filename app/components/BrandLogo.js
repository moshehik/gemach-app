"use client";

import { useState, useEffect } from 'react';

export default function BrandLogo() {
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Check if we have a new timestamp in localStorage
    const ts = localStorage.getItem('logo_timestamp');
    if (ts) {
      setLogoUrl(`/logo.png?v=${ts}`);
    }
  }, []);

  // Listen for a custom event so the logo updates immediately when uploaded in the same window
  useEffect(() => {
    const handleLogoUpdate = (e) => {
      const ts = e.detail || Date.now();
      setLogoUrl(`/logo.png?v=${ts}`);
      setHasError(false); // Reset error state to try loading the new logo
    };
    window.addEventListener('logoUpdated', handleLogoUpdate);
    return () => window.removeEventListener('logoUpdated', handleLogoUpdate);
  }, []);

  if (hasError) {
    return <div className="navbar-brand">גמ"ח נסיכה</div>;
  }

  return (
    <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', padding: '0', paddingRight: '1rem' }}>
      <img 
        src={logoUrl} 
        alt="לוגו" 
        style={{ maxHeight: '40px', objectFit: 'contain' }}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
