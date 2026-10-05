'use client';

// hook: מנוי לדוגם המשותף (lib/pollClient.js). מחזיר snapshot: { known, authFailed, rev, errorReports: { known, rev, unread, isProgrammer,
// isManager }, notifications: { known, rev, unread } }. המצב ההתחלתי הריק זהה בשרת ובדפדפן (בלי אי-התאמת hydration).
// enabled=false: לא מנויים (למשל אין עובד מחובר).
import { useEffect, useState } from 'react';
import { getPoller, EMPTY_SNAPSHOT } from './pollClient.js';

export function usePollSnapshot(enabled = true) {
  const [snap, setSnap] = useState(EMPTY_SNAPSHOT);
  useEffect(() => {
    if (!enabled) return undefined;
    const poller = getPoller();
    if (!poller) return undefined;
    return poller.subscribe(setSnap);
  }, [enabled]);
  return snap;
}
