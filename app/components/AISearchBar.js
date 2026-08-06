'use client';

import { useState } from 'react';
import { Search, Sparkles, X, BarChart3, Loader2 } from 'lucide-react';

export default function AISearchBar({ 
  placeholder, 
  value, 
  onChange, 
  onSearch, 
  onClear, 
  onAiSearch,
  onStatistics,
  loading 
}) {
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiInput, setAiInput] = useState('');

  const handleRegularSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(e);
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    if (onAiSearch) onAiSearch(aiInput);
  };

  const handleClear = () => {
    if (isAiMode) {
      setAiInput('');
    }
    if (onClear) onClear();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
      {!isAiMode ? (
        <form onSubmit={handleRegularSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input data-element-name="שדה_AISearchBar_1"
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              className="ai-search-input"
            />
            {value && (
              <button data-element-name="כפתור_AISearchBar_2" 
                type="button"
                onClick={handleClear}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0' }}
                title="נקה חיפוש"
              >
                <X data-element-name="רכיב_AISearchBar_3" size={18} />
              </button>
            )}
          </div>
          <button data-element-name="כפתור_AISearchBar_4" type="submit" className="ai-search-submit">
            חיפוש
          </button>
        </form>
      ) : (
        <form onSubmit={handleAiSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input data-element-name="שדה_AISearchBar_5"
              type="text"
              placeholder="בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              disabled={loading}
              className="ai-search-input-magic"
            />
            {aiInput && !loading && (
              <button data-element-name="כפתור_AISearchBar_6" 
                type="button"
                onClick={() => setAiInput('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0' }}
                title="נקה"
              >
                <X data-element-name="רכיב_AISearchBar_7" size={18} />
              </button>
            )}
            {loading && (
              <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ec4899' }}>
                <Loader2 data-element-name="רכיב_AISearchBar_8" size={18} className="animate-spin" />
              </div>
            )}
          </div>
          <button data-element-name="כפתור_AISearchBar_9"
            type="submit"
            disabled={loading}
            className="ai-search-submit-magic"
          >
            {loading ? 'מייצר שאילתה...' : 'חפש בחכמה'}
          </button>
        </form>
      )}

      {/* AI Toggle Button */}
      <button data-element-name="כפתור_AISearchBar_10"
        className="ai-feature-element ai-search-circle-btn"
        onClick={() => {
          if (!isAiMode) {
            setAiInput(value || '');
          } else {
            if (onChange) {
              onChange({ target: { value: aiInput || '' } });
            }
          }
          setIsAiMode(!isAiMode);
        }}
        style={isAiMode ? {
          background: '#fdf2f8',
          border: '2px solid #ec4899',
          color: '#ec4899',
          boxShadow: '0 0 10px rgba(236, 72, 153, 0.2)'
        } : undefined}
        title="חיפוש חכם (AI)"
      >
        <Sparkles data-element-name="רכיב_AISearchBar_11" size={20} />
      </button>

      {/* Statistics Toggle Button */}
      {onStatistics && (
        <button data-element-name="כפתור_AISearchBar_12"
          className="ai-feature-element ai-search-circle-btn"
          onClick={(e) => onStatistics(e)}
          style={{ color: '#10b981' }}
          title="שאלות סטטיסטיקה"
        >
          <BarChart3 data-element-name="רכיב_AISearchBar_13" size={20} />
        </button>
      )}
    </div>
  );
}
