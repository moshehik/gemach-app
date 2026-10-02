// app/components/schedule/print/Code39.js — ברקוד Code 39 כ-SVG ב-React (מידות במ"מ, כמו בעיצוב).
// הקידוד עצמו ב-lib/schedule/print/barcode.js (טהור, נבדק ב-scripts/schedule-print-tests/barcode.test.mjs).
// שימוש: <Code39 code="DOT-40113" height={6} unit={0.19} />  (ברקוד שורה)
//         <Code39 code="ALL-PRP-261014" height={8.5} unit={0.2} />  (ברקוד כותרת)
// עם label: הקוד כתוב מתחת (כמו rowbc()/sh-bc בעיצוב) - כדי שגם בלי סורק אפשר להקליד אותו.
import { code39Bars } from '@/lib/schedule/print/barcode';

export default function Code39({ code, height = 8, unit = 0.2, label = true, note = null, className = '' }) {
  if (!code) return null;
  let enc;
  try { enc = code39Bars(code, unit); } catch { return <span className="pp-bc-bad">{String(code)}</span>; }
  const svg = (
    <svg
      className="pp-bcsvg"
      data-code={enc.text}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${enc.width} ${height}`}
      width={`${enc.width}mm`}
      height={`${height}mm`}
      fill="#000"
      shapeRendering="crispEdges"
      role="img"
      aria-label={'ברקוד ' + enc.text}
    >
      {enc.bars.map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height={height} />)}
    </svg>
  );
  if (!label) return svg;
  return (
    <span className={'pp-bc' + (className ? ' ' + className : '')}>
      {svg}
      <small>{enc.text}{note ? <i> · {note}</i> : null}</small>
    </span>
  );
}
