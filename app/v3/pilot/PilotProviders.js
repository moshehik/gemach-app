'use client';
// app/v3/pilot/PilotProviders.js — עטיפת ספריית v3 לנתיבי הפיילוט (/v3-pilot/*) בלבד.
// LayersProvider ו-OrgConfigProvider מורכבים כאן ולא ב-app/layout.js, כדי שהפיילוט יהיה תוספתי לחלוטין
// ולא ישנה אף עמוד חי (MASTER-PLAN: הרכבה ב-layout.js תיעשה רק כשמפעילים v3 בפועל — ראו REVIEW-LOG).
// נמצא ב-layout (לא ב-page) כדי שה-NoticeBar ישרוד ניווט בין לקוחות (§ד.7).
import { LayersProvider } from '@/app/v3/overlays';
import { OrgConfigProvider } from '@/app/v3/config';
import { V3Page } from '@/app/v3/ui/components';

export default function PilotProviders({ children }) {
  return (
    <LayersProvider>
      <OrgConfigProvider>
        <V3Page>{children}</V3Page>
      </OrgConfigProvider>
    </LayersProvider>
  );
}
