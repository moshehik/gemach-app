'use client';
import React, { useState, useEffect } from 'react';
import { Mail, Search, Copy, Download, X, Check, ExternalLink, RefreshCw, UserCheck, ChevronRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function FullEmailListModal({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSingle, setCopiedSingle] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/customers/emails')
        .then(res => res.json())
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            setEmails(res.data);
          }
        })
        .catch(err => console.error('Failed to load email list', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredEmails = emails.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.phone.includes(q) ||
      item.city.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmails = filteredEmails.slice(startIndex, startIndex + itemsPerPage);

  const handleCopyAll = () => {
    const emailListStr = filteredEmails.map(i => i.email).join(', ');
    navigator.clipboard.writeText(emailListStr);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 3000);
  };

  const handleCopySingle = (emailStr, id) => {
    navigator.clipboard.writeText(emailStr);
    setCopiedSingle(id);
    setTimeout(() => setCopiedSingle(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = ['שם לקוח', 'דואל', 'טלפון', 'עיר'];
    const rows = filteredEmails.map(i => [
      `"${i.name.replace(/"/g, '""')}"`,
      `"${i.email.replace(/"/g, '""')}"`,
      `"${i.phone.replace(/"/g, '""')}"`,
      `"${i.city.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customer_emails_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        direction: 'rtl'
      }}
    >
      <div 
        style={{
          background: 'var(--card-bg)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '1.5rem 2rem',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Mail size={26} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>
                רשימת מיילים מלאה של הלקוחות
              </h2>
              <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
                סה"כ {emails.length} כתובות דוא"ל פעילות במערכת
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          >
            <X size={22} />
          </button>
        </div>

        {/* Toolbar Section */}
        <div 
          style={{
            padding: '1.25rem 2rem',
            background: 'var(--element-bg)',
            borderBottom: '1px solid var(--element-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
            <Search 
              size={18} 
              style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
            />
            <input 
              type="text"
              placeholder="חיפוש לפי שם, אימייל, טלפון או עיר..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 2.8rem 0.65rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--element-border)',
                outline: 'none',
                fontSize: '0.95rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleCopyAll}
              disabled={filteredEmails.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: copiedAll ? '#16a34a' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '600',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              {copiedAll ? <Check size={18} /> : <Copy size={18} />}
              {copiedAll ? `הועתקו ${filteredEmails.length} מיילים!` : `העתק את כל המיילים (${filteredEmails.length})`}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredEmails.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                border: '1px solid var(--element-border)',
                borderRadius: '12px',
                fontWeight: '600',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--element-bg)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'var(--card-bg)'}
            >
              <Download size={18} color="#2563eb" />
              ייצא ל-CSV
            </button>
          </div>
        </div>

        {/* Content Body - Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: '#2563eb' }} />
              <div>טוען רשימת מיילים...</div>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              לא נמצאו מיילים התואמים לחיפוש.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--element-border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>#</th>
                  <th style={{ padding: '0.75rem 1rem' }}>שם לקוח</th>
                  <th style={{ padding: '0.75rem 1rem' }}>כתובת דוא"ל</th>
                  <th style={{ padding: '0.75rem 1rem' }}>טלפון</th>
                  <th style={{ padding: '0.75rem 1rem' }}>עיר</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmails.map((item, idx) => (
                  <tr 
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid var(--element-border)',
                      transition: 'background 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--element-bg)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{startIndex + idx + 1}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#2563eb', fontWeight: '500', direction: 'ltr', textAlign: 'right' }}>
                      {item.email}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.phone || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.city || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleCopySingle(item.email, item.id)}
                          title="העתק מייל"
                          style={{
                            background: copiedSingle === item.id ? '#f0fdf4' : 'var(--element-bg)',
                            color: copiedSingle === item.id ? '#16a34a' : 'var(--text-muted)',
                            border: '1px solid var(--element-border)',
                            borderRadius: '8px',
                            padding: '0.4rem 0.6rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}
                        >
                          {copiedSingle === item.id ? <Check size={14} /> : <Copy size={14} />}
                          {copiedSingle === item.id ? 'הועתק!' : 'העתק'}
                        </button>
                        <Link 
                          href={`/customers/${item.id}`}
                          target="_blank"
                          title="פתח כרטיס לקוח"
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '8px',
                            padding: '0.4rem 0.6rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer - Pagination and Summary */}
        {!loading && filteredEmails.length > 0 && (
          <div 
            style={{
              padding: '1rem 2rem',
              background: 'var(--element-bg)',
              borderTop: '1px solid var(--element-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              מציג <strong>{startIndex + 1}</strong> עד <strong>{Math.min(startIndex + itemsPerPage, filteredEmails.length)}</strong> מתוך <strong>{filteredEmails.length}</strong> רשומות
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: currentPage === 1 ? 'var(--element-border)' : 'var(--card-bg)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                  border: '1px solid var(--element-border)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronRight size={18} />
              </button>
              
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', margin: '0 0.5rem' }}>
                עמוד {currentPage} מתוך {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: currentPage === totalPages ? 'var(--element-border)' : 'var(--card-bg)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                  border: '1px solid var(--element-border)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
