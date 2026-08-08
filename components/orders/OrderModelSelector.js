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
      <div className="input-icon-wrap">
        {isLoading ? (
          <span className="spinner" style={{ position: 'absolute', insetInlineStart: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', borderWidth: '2px' }} />
        ) : (
          <svg className="icon"><use href="#i-search" /></svg>
        )}
        <input
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
          style={{ height: '42px' }}
        />
      </div>

      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
