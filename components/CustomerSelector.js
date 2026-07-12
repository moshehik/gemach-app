'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function CustomerSelector({ value, onChange, placeholder = 'חיפוש ובחירת לקוח...', error = false }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  // Fetch customers when query changes
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}&limit=50`);
        const data = await res.json();
        setCustomers(data.data || []);
      } catch (err) {
        console.error('Failed to fetch customers', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Only search if user types or opens dropdown
    if (isOpen || query) {
        const timeoutId = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timeoutId);
    }
  }, [query, isOpen]);

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

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
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
      
      {isOpen && customers.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          left: 0,
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--element-border)',
          borderRadius: '12px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
          zIndex: 100,
          maxHeight: '250px',
          overflowY: 'auto',
          marginTop: '0.5rem'
        }}>
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
         <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            left: 0,
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--element-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            zIndex: 100,
            padding: '1rem',
            textAlign: 'center',
            color: 'var(--text-main)',
            marginTop: '0.5rem'
          }}>
            לא נמצאו לקוחות.
          </div>
      )}
    </div>
  );
}
