'use client';
import { useState, useEffect } from 'react';
import { Database, Link as LinkIcon, Copy, Check, Server, FlaskConical, ChevronDown } from 'lucide-react';

export default function DevEnvBanner() {
  const [mode, setMode] = useState('prod');
  const [urls, setUrls] = useState({ prod: '', test: '' });
  const [loading, setLoading] = useState(true);
  const [showLinks, setShowLinks] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    fetch('/api/dev/switch-env')
      .then(res => res.json())
      .then(data => {
        if (data.mode) setMode(data.mode);
        if (data.urls) setUrls(data.urls);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const changeMode = async (newMode) => {
    if (newMode === mode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dev/switch-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        setMode(newMode);
        window.location.reload(); 
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (process.env.NODE_ENV !== 'development' || loading) return null;

  const isTest = mode === 'test';
  const modeClass = isTest ? 'test-mode' : 'prod-mode';

  return (
    <div className="dev-env-container">
      {/* Links Panel */}
      <div className={`dev-env-links-panel ${showLinks ? 'visible' : 'hidden'}`}>
        <h3 className="dev-env-links-title">
          <Database size={14} style={{ color: '#9ca3af' }} />
          קישורי מסד נתונים
        </h3>
        
        <div className="dev-env-link-group">
          <div className="dev-env-link-header">
            <span className="dev-env-link-label prod">
              <Server size={12}/> PROD
            </span>
            <button 
              onClick={() => copyToClipboard(urls.prod, 'prod')}
              className="dev-env-copy-btn"
              title="העתק קישור"
            >
              {copied === 'prod' ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="dev-env-url-box">
            {urls.prod || 'Not configured'}
          </div>
        </div>

        <div className="dev-env-link-group" style={{ marginBottom: 0 }}>
          <div className="dev-env-link-header">
            <span className="dev-env-link-label test">
              <FlaskConical size={12}/> TEST
            </span>
            <button 
              onClick={() => copyToClipboard(urls.test, 'test')}
              className="dev-env-copy-btn"
              title="העתק קישור"
            >
              {copied === 'test' ? <Check size={14} style={{ color: '#fbbf24' }} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="dev-env-url-box">
            {urls.test || 'Not configured'}
          </div>
        </div>
      </div>

      {/* Main Widget Segmented Control */}
      <div className={`dev-env-widget ${modeClass}`}>
        <button
          onClick={() => setShowLinks(!showLinks)}
          className={`dev-env-toggle-links ${showLinks ? `active ${modeClass}` : ''}`}
          title="הצג קישורים"
        >
          {showLinks ? <ChevronDown size={16} /> : <LinkIcon size={14} />}
        </button>

        <div className={`dev-env-separator ${modeClass}`}></div>

        <div className="dev-env-segmented-control">
          <div className={`dev-env-pill ${mode}`}></div>
          
          <button 
            onClick={() => changeMode('prod')}
            disabled={loading}
            className={`dev-env-segment-btn ${mode === 'prod' ? 'active prod' : ''}`}
          >
            <Server size={12} /> Prod
          </button>
          
          <button 
            onClick={() => changeMode('test')}
            disabled={loading}
            className={`dev-env-segment-btn ${mode === 'test' ? 'active test' : ''}`}
          >
            <FlaskConical size={12} /> Test
          </button>
        </div>
      </div>
    </div>
  );
}
