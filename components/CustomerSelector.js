'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useDebounce from '@/hooks/useDebounce';

export default function CustomerSelector({ value, onChange, placeholder = 'חיפוש ובחירת לקוח...', error = false }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside (the dropdown itself lives in a portal,
  // so it must be checked separately from the wrapper)
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && wrapperRef.current.contains(event.target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // הרשימה מרונדרת ב-portal עם מיקום fixed — כך היא לא נחתכת בתוך מודלים
  // וקונטיינרים עם overflow (הבעיה שהייתה בחלונית "החלפת לקוח").
  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true); // capture — גם גלילה של הורים פנימיים
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch customers when debounced query changes
  useEffect(() => {
    const controller = new AbortController();

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(debouncedQuery)}&limit=50`, {
          signal: controller.signal
        });
        const data = await res.json();
        if (!controller.signal.aborted) {
          setCustomers(data.data || []);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch customers', err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Only search if user types or opens dropdown
    if (isOpen || debouncedQuery) {
      fetchCustomers();
    }

    return () => controller.abort();
  }, [debouncedQuery, isOpen]);

  // Set initial text if value exists
  useEffect(() => {
    if (value && value.firstName && value.lastName && !query) {
      setQuery(`${value.firstName} ${value.lastName} ${value.phone1 ? `(${value.phone1})` : ''}`.trim());
    } else if (!value) {
      setQuery('');
    }
  }, [value]);

  const handleSelect = (customer) => {
    setQuery(`${[customer.firstName, customer.lastName].filter(Boolean).join(' ')} ${customer.phone1 ? `(${customer.phone1})` : ''}`.trim());
    onChange(customer);
    setIsOpen(false);
  };

  const dropdownBaseStyle = {
    position: 'fixed',
    top: dropdownPos.top,
    left: dropdownPos.left,
    width: dropdownPos.width,
    backgroundColor: 'var(--card-bg, white)',
    border: '1px solid var(--element-border, #e2e8f0)',
    borderRadius: '12px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
    zIndex: 999999,
    direction: 'rtl'
  };

  const dropdownContent = (
    <>
      {isOpen && customers.length > 0 && (
        <div ref={dropdownRef} style={{ ...dropdownBaseStyle, maxHeight: '250px', overflowY: 'auto' }}>
          {customers.map((c) => (
            <div
              key={c.id}
              onClick={() => handleSelect(c)}
              style={{
                padding: '0.8rem 1rem',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                textAlign: 'right',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--element-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ fontWeight: 'bold' }}>{c.firstName} {c.lastName}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {c.phone1} {c.city ? ` | ${c.city}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      {isOpen && !loading && query && customers.length === 0 && (
        <div ref={dropdownRef} style={{ ...dropdownBaseStyle, padding: '1rem', textAlign: 'center', color: 'var(--text-main)' }}>
          לא נמצאו לקוחות.
        </div>
      )}
    </>
  );

  return (
    <div data-agy-id="customer_selector_container" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        data-agy-id="customer_selector_input"
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
          padding: '1.2rem',
          borderRadius: '12px',
          border: `2px solid ${error ? '#d32f2f' : 'var(--element-border)'}`,
          fontSize: '1.1rem',
          outline: 'none',
          transition: 'border-color 0.2s',
          textAlign: 'right',
          backgroundColor: 'var(--card-bg)'
        }}
        onMouseEnter={(e) => { if (!error) e.target.style.borderColor = 'var(--primary-color)' }}
        onMouseLeave={(e) => { if (!error) e.target.style.borderColor = '#e0e0e0' }}
      />
      {loading && isOpen && (
        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>טוען...</div>
      )}

      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
