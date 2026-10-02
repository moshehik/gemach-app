// app/components/schedule/print/pages/ppCode.js — ברקוד שורה/מדבקה בדיוק כמו rowbc() בעיצוב: <svg> ואחריו <small> עם הקוד כתוב,
// כילדים ישירים של התא / של .bcw (בלי העטיפה .pp-bc של Code39 עם label - כך מרווחי התא והמדבקה זהים לעיצוב).
import Code39 from '../Code39';

export default function RowCode({ code, height = 6, unit = 0.19 }) {
  return (
    <>
      <Code39 code={code} height={height} unit={unit} label={false} />
      <small>{code}</small>
    </>
  );
}
