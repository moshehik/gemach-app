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

  const toggleAiMode = () => {
    if (!isAiMode) {
      setAiInput(value || '');
    } else if (onChange) {
      onChange({ target: { value: aiInput || '' } });
    }
    setIsAiMode(!isAiMode);
  };

  /* כפתורי המצב (AI/סטטיסטיקה) — משותפים לשני המצבים, יושבים בתוך אותה גלולה */
  const modeButtons = (
    <>
      <span className="ai-search__sep" />
      <button data-element-name="כפתור_AISearchBar_10"
        type="button"
        className={`ai-feature-element ai-search__inline-btn${isAiMode ? ' is-active' : ''}`}
        onClick={toggleAiMode}
        title="חיפוש חכם (AI)"
      >
        <Sparkles data-element-name="רכיב_AISearchBar_11" size={17} />
      </button>
      {onStatistics && (
        <button data-element-name="כפתור_AISearchBar_12"
          type="button"
          className="ai-feature-element ai-search__inline-btn is-stats"
          onClick={(e) => onStatistics(e)}
          title="שאלות סטטיסטיקה"
        >
          <BarChart3 data-element-name="רכיב_AISearchBar_13" size={17} />
        </button>
      )}
    </>
  );

  if (isAiMode) {
    return (
      <form onSubmit={handleAiSubmit} className="ai-search is-magic">
        {loading
          ? <Loader2 className="ai-search__icon animate-spin" size={18} style={{ color: '#ec4899' }} />
          : <Sparkles className="ai-search__icon" size={18} style={{ color: '#ec4899' }} />}
        <input data-element-name="שדה_AISearchBar_5"
          type="text"
          className="ai-search__input"
          placeholder="בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')..."
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          disabled={loading}
        />
        {aiInput && !loading && (
          <button data-element-name="כפתור_AISearchBar_6"
            type="button"
            className="ai-search__inline-btn"
            onClick={() => setAiInput('')}
            title="נקה"
          >
            <X data-element-name="רכיב_AISearchBar_7" size={16} />
          </button>
        )}
        {modeButtons}
        <button data-element-name="כפתור_AISearchBar_9"
          type="submit"
          className="ai-search__go"
          disabled={loading}
        >
          {loading ? 'מייצר שאילתה...' : 'חפש בחכמה'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRegularSubmit} className="ai-search">
      <Search className="ai-search__icon" size={18} />
      <input data-element-name="שדה_AISearchBar_1"
        type="text"
        className="ai-search__input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      {value && (
        <button data-element-name="כפתור_AISearchBar_2"
          type="button"
          className="ai-search__inline-btn"
          onClick={handleClear}
          title="נקה חיפוש"
        >
          <X data-element-name="רכיב_AISearchBar_3" size={16} />
        </button>
      )}
      {modeButtons}
      <button data-element-name="כפתור_AISearchBar_4" type="submit" className="ai-search__go">
        חיפוש
      </button>
    </form>
  );
}
