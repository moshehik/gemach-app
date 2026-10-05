// מסך הניהול הראשי האמיתי (AdminHubPage + admin-hub.css + כל ה-CSS הגלובלי של האתר) בלי שרת, בלי DB.
// ?role=0 (הנהלה ראשית, ברירת מחדל) | 2 (מתכנת) | anon (אורח כשההתחברות לא חובה); ?ned=off = nedarim_plus_enabled 'false'.
// הכלים מחושבים כמו ב-app/admin/page.js (selectHub על תוצאות השערים; כאן השערים מדומים לפי התפקיד עם accessForRole).
// הקטלוג מיובא כאן רק כ"שרת" מדומה — הרכיב עצמו מקבל רק את הכלים המותרים.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminHubPage from '../../app/components/admin-hub/AdminHubPage.js';
import { selectHub, accessForRole } from '../../lib/adminHubCatalog.js';

const sp = new URLSearchParams(location.search);
const role = sp.get('role') || '0';
const access = role === 'anon' ? accessForRole(null, { logged: false, requireLogin: false }) : accessForRole(Number(role));
const hub = selectHub(access, { nedarimEnabled: sp.get('ned') !== 'off' });
createRoot(document.getElementById('root')).render(<AdminHubPage tools={hub.tools} categories={hub.categories} userKey={role === 'anon' ? null : 'emp-' + role} />);
