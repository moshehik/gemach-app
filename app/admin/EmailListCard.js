'use client';

import { useState } from 'react';
import FullEmailListModal from '@/components/FullEmailListModal';

export default function EmailListCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="list-card"
        style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '28px', gap: '14px', textAlign: 'start', width: '100%', font: 'inherit', cursor: 'pointer' }}
      >
        <div className="kpi-icon" style={{ width: '52px', height: '52px', background: 'var(--primary-tint)', color: 'var(--primary)' }}>
          <svg className="icon" style={{ width: '24px', height: '24px' }}><use href="#i-mail" /></svg>
        </div>
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>רשימת מיילים מלאה</h2>
          <p className="page-desc" style={{ marginTop: 0 }}>רשימת כתובות המייל של כל הלקוחות, להעתקה או ייצוא</p>
        </div>
      </button>

      <FullEmailListModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
