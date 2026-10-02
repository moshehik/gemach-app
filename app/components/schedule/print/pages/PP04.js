// app/components/schedule/print/pages/PP04.js — תבנית "מדבקות תיקון" (דף 04): מדבקה לכל שמלה, 3 על 6 בעמוד.
// נתונים: lib/schedule/print/pages/PP-04.js. עיצוב: p04() בדפי-הדפסה-עיצוב.html (כותרת צרה - registry slim:true).

import RowCode from './ppCode';
import { StickerSheets } from './ppStickers';
import './pp0408.css';

export default function PP04({ meta, page }) {
  return (
    <StickerSheets
      meta={meta}
      page={page}
      render={(l) => (
        <div className="pp-lab" key={l.code}>
          <div className="l1"><span>בס״ד</span><span>אירוע {l.eventShort}</span></div>
          <div className="nm">{l.name}</div>
          <div className="md">{l.model} · מידה <b>{l.size}</b></div>
          <div className="fx">{l.fix}{l.det ? <>{' '}<i>{l.det}</i></> : null}</div>
          <div className="bcw"><RowCode code={l.code} height={8} /></div>
        </div>
      )}
    />
  );
}
