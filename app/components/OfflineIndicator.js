'use client';

import { Icon } from '@/app/v3/ui';
import { useState } from 'react';

export default function OfflineIndicator() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div data-element-name="לחיץ_OfflineIndicator_1" className="offline-indicator v3-offline" role="status" title="מערכת אופליין פעילה - לחיצה מסתירה" onClick={() => setIsVisible(false)}>
      <Icon name="wifi-off" data-element-name="רכיב_OfflineIndicator_2" />
      <span>אופליין</span>
    </div>
  );
}
