// דף ההדפסה האמיתי (AttendancePrintDocument + attendancePrint.css + print.css של הלו״ז + ה-CSS הגלובלי) עם המטען המדומה של data.mjs.
// אותם פרמטרים כמו /attendance/print (type, ids, y, m, preview, wages) + role=mgr|emp. משמש גם את ה-iframe של התצוגה המקדימה.
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import '../../app/components/attendance/print/attendancePrint.css';
import '../../app/components/schedule/print/print.css';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AttendancePrintDocument } from '../../app/components/attendance/print/AttendancePrintSheets.js';
import { printPayload } from './data.mjs';

const sp = new URLSearchParams(location.search);
const role = sp.get('role') || (window.parent && window.parent !== window && /role=emp/.test(window.parent.location.search) ? 'emp' : 'mgr');
const payload = printPayload(sp, role, sp.get('scn') || '');
const preview = sp.get('preview') === '1';
function App() {
  useEffect(() => {
    document.body.classList.add('hide-global-nav', 'pp-print-mode');
    if (!preview) return undefined;
    const fit = () => { const p = document.querySelector('.pp-paper'); if (p) p.style.zoom = String(Math.min(1, (window.innerWidth - 16) / 810)); };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return <div data-print-ready="true"><AttendancePrintDocument payload={payload} preview={preview} /></div>;
}
createRoot(document.getElementById('root')).render(<App />);
