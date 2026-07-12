'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function OrderModelSelector({ value, onChange, placeholder = 'בחר דגם...' }) {
  const [query, setQuery] = useState('');
  const [models, setModels] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch models when query changes
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/inventory/models?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setModels(data.models || []);
      } catch (err) {
        console.error('Failed to fetch models', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    const timeoutId = setTimeout(fetchModels, 300);
    return () => clearTimeout(timeoutId);
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

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
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
            padding: '0.4rem',
            borderRadius: '4px',
            border: '1px solid var(--element-border)',
            textAlign: 'right'
          }}
        />
        {isLoading && (
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid #e2e8f0', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
      
      {isOpen && models.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          left: 0,
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--element-border)',
          borderRadius: '4px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 100,
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {models.map((m) => (
            <div
              key={m.id}
              onClick={() => handleSelect(m)}
              style={{
                padding: '0.5rem',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                textAlign: 'right'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--element-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {m.name} {m.barcodePrefix ? `(קוד: ${m.barcodePrefix})` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
