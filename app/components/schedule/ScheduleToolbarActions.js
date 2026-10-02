'use client';

import { useCallback, useState } from 'react';
import PrintWizard from './print/PrintWizard';
import './print/ScheduleToolbarActions.css';

// כפתורי "הורדה" ו"הדפסה" של דף הלו״ז (לחצנים 63/64 ו-9/20 בתצוגה המאושרת תצוגות-עיצוב/לוז-יומי.html:
// .tools.lz-dtools > .xlbtn.xld / .xlbtn.xlp - לחצן עגול 36px, אייקון SVG מוטמע כמו בתצוגה, טולטיפ). שניהם
// פותחים את אשף ההדפסות/ההורדות (./print/PrintWizard.js) במצב המתאים.
// חוזה ההטמעה: <ScheduleToolbarActions date branch stageData /> - נקודת רינדור אחת ב-ScheduleDay.js
// (סרגל הכותרת, אחרי בורר התאריך). date = היום המוצג (YYYY-MM-DD), branch = סינון הסניף, stageData = תשובת
// /api/schedule (למונים באשף; יכול להיות null בזמן טעינה).
export default function ScheduleToolbarActions({ date, branch = '', stageData = null }) {
  const [wiz, setWiz] = useState(null); // null | 'print' | 'download'
  const close = useCallback(() => setWiz(null), []);
  return (
    <div className="tools lz-dtools lz-ptools">
      <button type="button" className="xlbtn xld" aria-label="הורדה" title="הורדת דפים" data-tip="הורדת דפים" data-wiz="dl" onClick={() => setWiz('download')}>
        <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <g className="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3" /></g>
          <path d="M2.5 11.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" />
        </svg>
      </button>
      <button type="button" className="xlbtn xlp" aria-label="הדפסה" title="הדפסת דפים" data-tip="הדפסת דפים" data-wiz="print" onClick={() => setWiz('print')}>
        <svg className="prtic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#1e63c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path className="prt-top" d="M4.5 5.5V2h7v3.5" />
          <rect x="1.5" y="5.5" width="13" height="6" rx="1.6" />
          <g className="prt-sheet"><rect x="4.5" y="9" width="7" height="5.5" rx=".6" fill="#fff" /><path d="M6.3 11.2h3.4M6.3 12.9h2.2" strokeWidth="1" /></g>
        </svg>
      </button>
      {wiz ? <PrintWizard mode={wiz} date={date} branch={branch} stageData={stageData} onClose={close} /> : null}
    </div>
  );
}
