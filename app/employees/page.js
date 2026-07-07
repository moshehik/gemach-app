'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/employees?all=true')
      .then(res => res.json())
      .then(data => {
        setEmployees(data);
        setLoading(false);
      });
  }, []);

  const filteredEmployees = employees.filter(e => {
    const term = search.toLowerCase();
    const fullName = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    return fullName.includes(term) || (e.phone1 && e.phone1.includes(term)) || String(e.id).includes(term);
  });

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול עובדים ונוכחות</h1>
        <button 
          onClick={() => router.push('/employees/new')} 
          className="btn btn-primary" 
          style={{ borderRadius: '24px', padding: '0.75rem 1.5rem', fontWeight: 'bold' }}
        >
          + עובד חדש
        </button>
      </div>
      
      {/* Search Field */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="חיפוש עובד (שם, טלפון, קוד)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ 
            width: '100%', 
            maxWidth: '400px', 
            padding: '0.75rem 1rem', 
            borderRadius: '24px', 
            border: '1px solid #ddd',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
            outline: 'none',
            fontSize: '1rem'
          }}
        />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>
        ) : (
          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>קוד עובד</th>
                <th style={{ padding: '1rem' }}>שם מלא</th>
                <th style={{ padding: '1rem' }}>תפקיד</th>
                <th style={{ padding: '1rem' }}>טלפון</th>
                <th style={{ padding: '1rem' }}>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => router.push(`/employees/${employee.id}`)} onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1rem' }}>{employee.id}</td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{employee.firstName} {employee.lastName}</td>
                  <td style={{ padding: '1rem' }}>{employee.roleId || 'עובד'}</td>
                  <td style={{ padding: '1rem' }}>{employee.phone1 || '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.3rem 0.8rem', 
                      borderRadius: '20px', 
                      fontSize: '0.85rem',
                      background: employee.isActive ? 'rgba(76, 175, 80, 0.1)' : 'rgba(158, 158, 158, 0.1)',
                      color: employee.isActive ? '#2e7d32' : '#616161'
                    }}>
                      {employee.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>לא נמצאו עובדים התואמים את החיפוש.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
