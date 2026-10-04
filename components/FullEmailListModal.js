'use client';
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

    const csvContent = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        style={{ maxWidth: '1000px', width: '100%', maxHeight: '90vh', margin: 0, display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-head">
          <div>
            <strong>
              <svg className="icon"><use href="#i-mail" /></svg>
              רשימת מיילים מלאה של הלקוחות
            </strong>
            <div style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '4px' }}>
              סה&quot;כ {emails.length} כתובות דוא&quot;ל פעילות במערכת
            </div>
          </div>

          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={onClose}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        {/* Toolbar Section */}
        <div
          style={{
            padding: '14px 22px',
            background: 'var(--surface-alt)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Search Box */}
          <div className="search-toolbar" style={{ flex: 1, minWidth: '280px' }}>
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              placeholder="חיפוש לפי שם, אימייל, טלפון או עיר..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleCopyAll}
              disabled={filteredEmails.length === 0}
              className="btn btn-primary btn-sm"
              style={copiedAll ? { background: 'var(--success-solid)', boxShadow: 'none' } : undefined}
            >
              <svg className="icon"><use href={copiedAll ? '#i-check' : '#i-link'} /></svg>
              {copiedAll ? `הועתקו ${filteredEmails.length} מיילים!` : `העתק את כל המיילים (${filteredEmails.length})`}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredEmails.length === 0}
              className="btn btn-secondary btn-sm"
            >
              <svg className="icon" style={{ color: 'var(--primary-solid)' }}><use href="#i-download" /></svg>
              ייצא ל-CSV
            </button>
          </div>
        </div>

        {/* Content Body - Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {loading ? (
            <div className="loading-inline"><span className="spinner" /> טוען רשימת מיילים...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-search" /></svg>
              <p>לא נמצאו מיילים התואמים לחיפוש.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שם לקוח</th>
                      <th>כתובת דוא&quot;ל</th>
                      <th>טלפון</th>
                      <th>עיר</th>
                      <th style={{ textAlign: 'center' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmails.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="cell-muted">{startIndex + idx + 1}</td>
                        <td className="cell-primary">{item.name}</td>
                        <td style={{ direction: 'ltr', textAlign: 'start', color: 'var(--primary-solid)', fontWeight: 500 }}>
                          {item.email}
                        </td>
                        <td>{item.phone || '-'}</td>
                        <td>{item.city || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleCopySingle(item.email, item.id)}
                              title="העתק מייל"
                              className="btn btn-sm btn-icon-only"
                              style={
                                copiedSingle === item.id
                                  ? { background: 'var(--success-tint)', color: 'var(--success)', border: '1px solid transparent' }
                                  : { background: 'var(--surface-alt)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                              }
                            >
                              <svg className="icon"><use href={copiedSingle === item.id ? '#i-check' : '#i-link'} /></svg>
                            </button>
                            <Link
                              href={`/customers/${item.id}`}
                              target="_blank"
                              title="פתח כרטיס לקוח"
                              className="btn btn-sm btn-icon-only"
                              style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)', border: '1px solid var(--primary-tint-2)' }}
                            >
                              <svg className="icon"><use href="#i-expand" /></svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Pagination and Summary */}
        {!loading && filteredEmails.length > 0 && (
          <div className="table-foot" style={{ position: 'static', borderRadius: 0 }}>
            <div>
              מציג <strong>{startIndex + 1}</strong> עד <strong>{Math.min(startIndex + itemsPerPage, filteredEmails.length)}</strong> מתוך <strong>{filteredEmails.length}</strong> רשומות
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary btn-icon-only btn-sm"
                title="עמוד קודם"
              >
                <svg className="icon"><use href="#i-chevron-end" /></svg>
              </button>

              <span style={{ fontWeight: 600, color: 'var(--text)', margin: '0 8px' }}>
                עמוד {currentPage} מתוך {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary btn-icon-only btn-sm"
                title="עמוד הבא"
              >
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
