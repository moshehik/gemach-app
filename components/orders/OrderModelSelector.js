'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchSharedJson, TTL } from '../../lib/apiCache';

export default function OrderModelSelector({ value, onChange, placeholder = 'בחר דגם...', inputId }) {
  const [query, setQuery] = useState('');
  const [models, setModels] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const hasSelection = Boolean(value?.name);
  // Elegant fix: when dropdown is open and input still shows the selected value's name,
  // treat search as empty to fetch full list instead of filtered one.
  const effectiveQuery = isOpen && value?.name && query === value.name ? '' : query;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && wrapperRef.current.contains(event.target)) {
        return;
      }
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position for portal dropdown
  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true); // true = capture phase to catch scroll events from any scrollable parent
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Fetch models when effective query changes (debounced 300ms via fetchSharedJson)
  useEffect(() => {
    let cancelled = false;
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        // מטמון משותף — אותם חיפושי דגמים חוזרים על עצמם שוב ושוב בזמן קליטת הזמנה
        const data = await fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(effectiveQuery)}`, { ttl: TTL.REFERENCE });
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        console.error('Failed to fetch models', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchModels, 300);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [effectiveQuery]);

  // Sync text if value changes from outside (e.g., reset)
  useEffect(() => {
    if (value && value.name !== undefined) {
      setQuery(value.name);
    } else if (!value || !value.name) {
      setQuery('');
    }
  }, [value?.name]);

  const handleSelect = (model) => {
    setQuery(model.name);
    onChange(model);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setQuery('');
    setIsOpen(true);
    // spec: call onChange(null or empty) — null is the canonical "no selection" signal
    // (parents like advFilters already handle `m ? m.name : ''`; others treat null as cleared)
    onChange(null);
    // focus input elegantly after clear
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const dropdownContent = isOpen && models.length > 0 && (
    <div
      ref={dropdownRef}
      className="combobox-results"
      style={{
        // Positioned via a portal against a JS-measured viewport rect
        // (getBoundingClientRect() is always left/top-based, regardless of
        // page direction), so this uses physical left/top intentionally
        // instead of logical inset-inline properties.
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999999,
        maxHeight: '250px',
        overflowY: 'auto'
      }}
    >
      {models.map((m) => (
        <div
          data-agy-id="order_model_selector_dropdown_item"
          key={m.id}
          className="combobox-option"
          onClick={() => handleSelect(m)}
        >
          <svg className="icon"><use href="#i-tag" /></svg>
          <span>{m.name}</span>
          {m.barcodePrefix && <span className="meta">קוד: {m.barcodePrefix}</span>}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div className="input-icon-wrap" style={{ position: 'relative' }}>
        {isLoading ? (
          <span className="spinner" style={{ position: 'absolute', insetInlineStart: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', borderWidth: '2px' }} />
        ) : (
          <svg className="icon"><use href="#i-search" /></svg>
        )}
        <input
          ref={inputRef}
          id={inputId}
          data-agy-id="order_model_selector_input"
          className="input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{ height: '42px', paddingInlineEnd: hasSelection ? '38px' : undefined }}
        />
        {hasSelection && (
          <button
            type="button"
            aria-label="נקה בחירה"
            title="נקה בחירה"
            data-agy-id="order_model_selector_clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="model-clear-btn"
            style={{
              position: 'absolute',
              insetInlineEnd: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1px solid transparent',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
              lineHeight: 1,
              padding: 0,
              zIndex: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        .model-clear-btn:hover {
          background: #fee2e2 !important;
          color: #dc2626 !important;
          border-color: #fecaca !important;
          transform: translateY(-50%) scale(1.08) !important;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.18) !important;
        }
        .model-clear-btn:active {
          transform: translateY(-50%) scale(0.92) !important;
          box-shadow: none !important;
        }
        .model-clear-btn:focus-visible {
          outline: 2px solid #fca5a5;
          outline-offset: 2px;
        }
      `}</style>

      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
