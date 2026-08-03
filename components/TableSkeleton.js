import React from 'react';

export default function TableSkeleton({ rows = 8, columns = 6 }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto', background: 'var(--card-bg)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
      <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--element-border)' }}>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={{ padding: '1rem' }}>
                <div className="skeleton-pulse skeleton-box" style={{ height: '20px', width: '70%', minWidth: '80px' }}></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: '1px solid var(--element-border)' }}>
              {Array.from({ length: columns }).map((_, cIdx) => (
                <td key={cIdx} style={{ padding: '1.25rem 1rem' }}>
                  <div className="skeleton-pulse skeleton-box" style={{ 
                    height: '24px', 
                    width: cIdx === 0 ? '40%' : cIdx === columns - 1 ? '90%' : '60%', 
                    minWidth: '50px' 
                  }}></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
