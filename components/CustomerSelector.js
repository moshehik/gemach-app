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
  const inputRef = useRef(null);

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

  // Display string for the currently selected value (same format as handleSelect)
  const displayValue = value && value.firstName && value.lastName
    ? `${[value.firstName, value.lastName].filter(Boolean).join(' ')} ${value.phone1 ? `(${value.phone1})` : ''}`.trim()
    : value && value.firstName
      ? `${value.firstName} ${value.phone1 ? `(${value.phone1})` : ''}`.trim()
      : '';

  // When input still shows the selected customer's display string and dropdown is open,
  // treat search as empty to show full list instead of filtering to that single name.
  const debouncedQueryEffective = isOpen && displayValue && query === displayValue ? '' : debouncedQuery;

  // Fetch customers when debounced query changes
  useEffect(() => {
    const controller = new AbortController();

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(debouncedQueryEffective)}&limit=50`, {
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
    if (isOpen || debouncedQueryEffective) {
      fetchCustomers();
    }

    return () => controller.abort();
  }, [debouncedQueryEffective, isOpen]);

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

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery('');
    setIsOpen(true);
    onChange(null);
    // Return focus to input for immediate re-selection
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const dropdownBaseStyle = {
    position: 'fixed',
    top: dropdownPos.top,
    left: dropdownPos.left,
    width: dropdownPos.width,
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow-lg)',
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
                borderBottom: '1px solid var(--border)',
                textAlign: 'right',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--element-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {c.firstName} {c.lastName}
                {c.isBlocked && (
                  <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>לקוח חסום</span>
                )}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {c.phone1} {c.city ? ` | ${c.city}` : ''}
              </div>
              {(c.phone2 || c.email) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {[c.phone2, c.email].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {isOpen && !loading && debouncedQueryEffective && customers.length === 0 && (
        <div ref={dropdownRef} style={{ ...dropdownBaseStyle, padding: '1rem', textAlign: 'center', color: 'var(--text-main)' }}>
          לא נמצאו לקוחות.
        </div>
      )}
    </>
  );

  const hasSelection = Boolean(value && displayValue);

  return (
    <div data-agy-id="customer_selector_container" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        data-agy-id="customer_selector_input"
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '1.2rem',
          paddingLeft: hasSelection ? '3rem' : '1.2rem',
          borderRadius: '12px',
          border: `2px solid ${error ? 'var(--danger)' : 'var(--element-border)'}`,
          fontSize: '1.1rem',
          outline: 'none',
          transition: 'border-color 0.2s',
          textAlign: 'right',
          backgroundColor: 'var(--card-bg)'
        }}
        onMouseEnter={(e) => { if (!error) e.target.style.borderColor = 'var(--primary-color)' }}
        onMouseLeave={(e) => { if (!error) e.target.style.borderColor = 'var(--element-border)' }}
      />
      {hasSelection && (
        <button
          type="button"
          aria-label="נקה בחירה"
          title="נקה בחירה"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          style={{
            position: 'absolute',
            left: '0.6rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--element-bg)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: 0.9,
            zIndex: 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface)';
            e.currentTarget.style.color = 'var(--text-main)';
            e.currentTarget.style.borderColor = 'var(--element-border)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--element-bg)';
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {loading && isOpen && (
        <div style={{ position: 'absolute', left: hasSelection ? '3.2rem' : '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', pointerEvents: 'none', transition: 'left 0.2s ease' }}>טוען...</div>
      )}

      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
