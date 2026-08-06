'use client';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export default function NavigationArrows() {
  const router = useRouter();

  return (
    <div className="nav-arrows" style={{ display: 'flex', gap: '0.15rem', alignItems: 'center', marginLeft: '0.75rem' }}>
      <button data-element-name="כפתור_NavigationArrows_1"
        onClick={() => router.back()}
        className="icon-nav-link"
        title="אחורה"
      >
        <ChevronRight size={20} />
      </button>
      <button data-element-name="כפתור_NavigationArrows_2"
        onClick={() => router.forward()}
        className="icon-nav-link"
        title="קדימה"
      >
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}
