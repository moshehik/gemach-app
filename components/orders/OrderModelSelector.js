'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function OrderModelSelector({ value, onChange, placeholder = 'בחר דגם...' }) {
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
          key={m.id}
          onClick={() => handleSelect(m)}
          style={{
            padding: '0.6rem 0.8rem',
            cursor: 'pointer',
            borderBottom: '1px solid #f1f5f9',
            textAlign: 'right',
            color: '#1e293b',
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
          {m.name} {m.barcodePrefix ? <span style={{ color: '#64748b', fontSize: '0.9em' }}>(קוד: {m.barcodePrefix})</span> : ''}
        </div>
      ))}
    </div>
  );

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
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            textAlign: 'right',
            backgroundColor: 'white'
          }}
        />
        {isLoading && (
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid #e2e8f0', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
      
      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
