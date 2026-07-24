'use client';

import { WifiOff } from 'lucide-react';
import { useState } from 'react';

export default function OfflineIndicator() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="offline-indicator" title="מערכת אופליין פעילה" onClick={() => setIsVisible(false)}>
      <WifiOff size={20} />
      <span>אופליין</span>
    </div>
  );
}
