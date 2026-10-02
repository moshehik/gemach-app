'use client';

// חריצי כלי ההדפסה / ההורדה / ה-XL של דף הלו״ז - המראה והמיקום בדיוק כמו בעיצוב המאושר (תצוגות-עיצוב/לוז-יומי.html,
// שורות 1630 ו-1999: שלושה לחצני xlbtn בכותרת העמוד ובכל כותרת שלב, לחצן 8/62 XL, 63/64 הורדה, 9/20 הדפסה מהפלטה).
//
// חוזה לסוכן אשף ההדפסה (ממלא את ה-props, לא נוגע ב-markup):
//   <PageTools    onExport={fn} onDownload={fn} onPrint={fn} onSettings={fn} canExport canSettings />
//   <SectionTools stageKey="prep" onExport={fn} onDownload={fn} onPrint={fn} canExport />
//   כל handler מקבל ({ stageKey|null, mode: 'xl'|'dl'|'print' }). לחצן בלי handler מרונדר כבוי (disabled) - לא מוסתר -
//   כדי שהמיקום והמראה יהיו כמו בעיצוב גם לפני שהאשף מחובר. canExport=false (עובדת, החלטה JDG-04) מסתיר את XL.
//   לחצן ההגדרות (S07, גלגל שיניים) מוצג רק כש-onSettings קיים - אין לו עדיין בעלים.
// הטולטיפים (data-tip) הם הטקסטים של העיצוב. ה-SVG-ים הפנימיים (xlic / dlic / prtic) הועתקו מהעיצוב כמות שהם.

import ScheduleIcon from './ScheduleIcon';

const TIP = { xl: 'ייצוא לאקסל (XL)', dl: 'הורדת דפים', print: 'הדפסת דפים', settings: 'הגדרות תהליכים' };
const LABEL = { xl: 'ייצוא ל-Excel', dl: 'הורדה', print: 'הדפסה' };

function XlIcon() {
  return (
    <svg className="xlic" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="3" fill="#107C41" />
      <path d="M5 4.5l6 7M11 4.5l-6 7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function DlIcon() {
  return (
    <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <g className="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3" /></g>
      <path d="M2.5 11.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg className="prtic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#1e63c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path className="prt-top" d="M4.5 5.5V2h7v3.5" />
      <rect x="1.5" y="5.5" width="13" height="6" rx="1.6" />
      <g className="prt-sheet"><rect x="4.5" y="9" width="7" height="5.5" rx=".6" fill="#fff" /><path d="M6.3 11.2h3.4M6.3 12.9h2.2" strokeWidth="1" /></g>
    </svg>
  );
}

function WizButton({ mode, stageKey, onClick }) {
  const cls = mode === 'xl' ? 'xlbtn xlg' : mode === 'dl' ? 'xlbtn xld' : 'xlbtn xlp';
  return (
    <button
      type="button"
      className={cls}
      data-wiz={mode}
      data-k={stageKey || undefined}
      aria-label={LABEL[mode]}
      data-tip={TIP[mode]}
      disabled={!onClick}
      onClick={onClick ? () => onClick({ stageKey: stageKey || null, mode }) : undefined}
    >
      {mode === 'xl' ? <XlIcon /> : mode === 'dl' ? <DlIcon /> : <PrintIcon />}
    </button>
  );
}

export function PageTools({ onExport, onDownload, onPrint, onSettings, canExport = true, canSettings = true }) {
  return (
    <div className="tools lz-dtools">
      {canExport ? <WizButton mode="xl" onClick={onExport} /> : null}
      <WizButton mode="dl" onClick={onDownload} />
      <WizButton mode="print" onClick={onPrint} />
      {canSettings && onSettings ? (
        <button type="button" className="ibtn" aria-label={TIP.settings} data-tip={TIP.settings} onClick={onSettings}>
          <ScheduleIcon name="gear" className="ia-gear ia-h" />
        </button>
      ) : null}
    </div>
  );
}

export function SectionTools({ stageKey, onExport, onDownload, onPrint, canExport = true }) {
  return (
    <div className="tools lz-stools">
      {canExport ? <WizButton mode="xl" stageKey={stageKey} onClick={onExport} /> : null}
      <WizButton mode="dl" stageKey={stageKey} onClick={onDownload} />
      <WizButton mode="print" stageKey={stageKey} onClick={onPrint} />
    </div>
  );
}
