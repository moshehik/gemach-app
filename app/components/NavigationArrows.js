'use client';
import { useRouter } from 'next/navigation';

export default function NavigationArrows() {
  const router = useRouter();

  return (
    <div className="nav-arrows" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '1rem' }}>
      <button 
        onClick={() => router.back()} 
        style={{ 
          background: 'transparent', 
          border: 'none', 
          fontSize: '1.5rem', 
          cursor: 'pointer', 
          color: 'var(--text-main)',
          padding: '0 5px'
        }}
        title="אחורה"
      >
        &#8594;
      </button>
      <button 
        onClick={() => router.forward()} 
        style={{ 
          background: 'transparent', 
          border: 'none', 
          fontSize: '1.5rem', 
          cursor: 'pointer', 
          color: 'var(--text-main)',
          padding: '0 5px'
        }}
        title="קדימה"
      >
        &#8592;
      </button>
    </div>
  );
}
