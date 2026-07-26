'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, UserMinus, Plus } from 'lucide-react';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('active'); // active, inactive, all
  const [isAiModeActive, setIsAiModeActive] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);

  useEffect(() => {
    // If AI mode is active, we don't fetch all automatically, AI handles the data
    if (!isAiModeActive) {
      fetch(`/api/employees?all=true`)
        .then(res => res.json())
        .then(data => {
          setEmployees(data);
          setLoading(false);
        });
    }
  }, [isAiModeActive]);

  const handleAiSearch = async (query) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'employees' })
      });
      const result = await res.json();
      if (res.ok) {
        setEmployees(result.data || []);
        setIsAiModeActive(true);
      } else {
        alert(result.error || 'שגיאה בחיפוש החכם');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    if (filterStatus === 'active' && !e.isActive) return false;
    if (filterStatus === 'inactive' && e.isActive) return false;
    
    if (isAiModeActive) return true; // AI already filtered the data

    const term = search.toLowerCase();
    const fullName = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    return fullName.includes(term) || (e.phone1 && e.phone1.includes(term)) || String(e.id).includes(term) || String(e.legacyId || '').includes(term);
  });

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      {showStatistics && <StatisticsModal isOpen={!!showStatistics} onClose={() => setShowStatistics(false)} pageContext="employees" position={typeof showStatistics === 'object' ? showStatistics : null} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>ניהול עובדים ונוכחות</h1>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* Status Filter Banner */}
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--element-bg)', padding: '0.2rem', borderRadius: '8px' }}>
            <button onClick={() => { setFilterStatus('active'); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'active' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'active' ? '#10b981' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="עובדים פעילים">
              <UserCheck size={20} />
              <span style={{ fontWeight: filterStatus === 'active' ? 'bold' : 'normal' }}>פעילים</span>
            </button>
            <button onClick={() => { setFilterStatus('inactive'); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'inactive' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'inactive' ? '#ef4444' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="לא פעילים">
              <UserMinus size={20} />
              <span style={{ fontWeight: filterStatus === 'inactive' ? 'bold' : 'normal' }}>לא פעילים</span>
            </button>
            <button onClick={() => { setFilterStatus('all'); }} style={{ padding: '0.4rem', border: 'none', background: filterStatus === 'all' ? 'var(--card-bg)' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: filterStatus === 'all' ? '#3b82f6' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }} title="הצג הכל">
              <Users size={20} />
              <span style={{ fontWeight: filterStatus === 'all' ? 'bold' : 'normal' }}>הכל</span>
            </button>
          </div>
          <button 
            onClick={() => router.push('/employees/new')} 
            className="btn btn-primary" 
            style={{ borderRadius: '24px', padding: '0.75rem 1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={20} />
            עובד חדש
          </button>
        </div>
      </div>
      
      {/* Search Field */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', maxWidth: '600px' }}>
        <AISearchBar 
          placeholder="חיפוש עובד (שם, טלפון, קוד)..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={(e) => { e.preventDefault(); setSearch(searchInput); setIsAiModeActive(false); }}
          onClear={() => { setSearchInput(''); setSearch(''); setIsAiModeActive(false); }}
          onAiSearch={handleAiSearch}
          onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
          loading={aiLoading}
        />
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
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
                <tr key={employee.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => router.push(`/employees/${employee.id}`)} onMouseEnter={e => e.currentTarget.style.background = 'var(--element-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1rem' }}>{employee.legacyId || employee.id.substring(0, 5)}</td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{employee.firstName} {employee.lastName}</td>
                  <td style={{ padding: '1rem' }}>{employee.department ? employee.department.name : (employee.roleId || 'עובד')}</td>
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
