"use client";

import { useState, useEffect } from 'react';
import versionData from '../version.json';

export default function BrandLogo() {
  const [logoUrl, setLogoUrl] = useState('/api/logo');
  const [hasError, setHasError] = useState(false);
  const [versionText, setVersionText] = useState('');

  // מוגדר רק אחרי ה-mount כדי שלא ייווצר hydration mismatch כש-version.json
  // מתעדכן (בזמן dev) בין ה-render בשרת לבין טעינת ה-bundle בלקוח.
  useEffect(() => {
    setVersionText(`גירסא ${versionData.version} | ${versionData.date}`);
  }, []);

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

  // v3: הלוגו יושב על "אריח" בהיר בתוך הסרגל הכהה (הלוגו מועלה ע"י הגמ"ח ואין לדעת אם הוא כהה או בהיר).
  if (hasError) {
    return (
      <span className="v3-brand__logo v3-brand__logo--text" title={versionText}>
        <span className="v3-brand__name">גמ"ח שמלות</span>
      </span>
    );
  }

  return (
    <span className="v3-brand__logo">
      <img
        src={logoUrl}
        alt="לוגו"
        title={versionText}
        onError={() => setHasError(true)}
      />
    </span>
  );
}
