// מסך הניהול הראשי האמיתי (AdminHubPage + admin-hub.css + כל ה-CSS הגלובלי של האתר) בלי שרת, בלי DB.
// ?role=0 (הנהלה ראשית, ברירת מחדל) | 2 (מתכנת) | anon (אורח כשההתחברות לא חובה) — רשימת הכלים מחושבת כמו ב-app/admin/page.js
// (visibleToolIds על תוצאות השערים; כאן השערים מדומים לפי התפקיד עם accessForRole).
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminHubPage from '../../app/components/admin-hub/AdminHubPage.js';
import { visibleToolIds, accessForRole } from '../../lib/adminHub.js';

const sp = new URLSearchParams(location.search);
const role = sp.get('role') || '0';
const access = role === 'anon' ? accessForRole(null, { logged: false, requireLogin: false }) : accessForRole(Number(role));
window.__toolIds = visibleToolIds(access);
createRoot(document.getElementById('root')).render(<AdminHubPage toolIds={window.__toolIds} userKey={role === 'anon' ? null : 'emp-' + role} />);
