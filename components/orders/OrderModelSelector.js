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
    if (isOpen && wrapperRef.current) {
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

  // Fetch models when query changes
  useEffect(() => {
    let cancelled = false;
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        // מטמון משותף — אותם חיפושי דגמים חוזרים על עצמם שוב ושוב בזמן קליטת הזמנה
        const data = await fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(query)}`, { ttl: TTL.REFERENCE });
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        console.error('Failed to fetch models', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    
    const timeoutId = setTimeout(fetchModels, 300);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [query]);

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

  const dropdownContent = isOpen && models.length > 0 && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        backgroundColor: 'var(--card-bg, white)',
        border: '1px solid var(--element-border, #e2e8f0)',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 999999,
        maxHeight: '250px',
        overflowY: 'auto'
      }}
    >
      {models.map((m) => (
        <div
          data-agy-id="order_model_selector_dropdown_item"
          key={m.id}
          onClick={() => handleSelect(m)}
          style={{
            padding: '0.6rem 0.8rem',
            cursor: 'pointer',
            borderBottom: '1px solid var(--element-border)',
            textAlign: 'right',
            color: 'var(--text-main)',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.color = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#1e293b';
          }}
        >
          {m.name} {m.barcodePrefix ? <span style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>(קוד: {m.barcodePrefix})</span> : ''}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          data-agy-id="order_model_selector_input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: '42px',
            padding: '0.5rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid var(--element-border)',
            textAlign: 'right',
            backgroundColor: 'var(--card-bg)',
            boxSizing: 'border-box',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
        />
        {isLoading && (
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid var(--element-border)', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
      
      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
