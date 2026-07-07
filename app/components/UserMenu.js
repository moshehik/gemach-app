'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserMenu() {
  const router = useRouter();
  
  const handleLogout = async () => {
    // Call api to remove cookie
    await fetch('/api/logout', { method: 'POST' });
    router.refresh();
  };

  return (
    <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button 
        onClick={handleLogout} 
        style={{ 
          background: 'transparent', 
          border: '1px solid var(--primary-color)', 
          color: 'var(--primary-color)', 
          padding: '0.3rem 0.8rem', 
          borderRadius: '20px', 
          cursor: 'pointer', 
          fontSize: '0.9rem' 
        }}
      >
        התנתק / החלף משתמש
      </button>
    </div>
  );
}
