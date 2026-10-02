// app/components/schedule/print/pages/PP08.js — תבנית "מדבקות שמלה" (דף 08): מדבקה לכל שמלה, 3 על 6 בעמוד.
// נתונים: lib/schedule/print/pages/PP-08.js. עיצוב: p08() בדפי-הדפסה-עיצוב.html (כותרת צרה - registry slim:true).
import { Flag } from '../PrintShell';
import RowCode from './ppCode';
import { StickerSheets } from './ppStickers';
import './pp0408.css';

export default function PP08({ meta, page }) {
  return (
    <StickerSheets
      meta={meta}
      page={page}
      render={(l) => (
        <div className="pp-lab" key={l.code}>
          <div className="row"><span className="big">#{l.orderId}</span><Flag filled={l.delivery}>{l.tag}</Flag></div>
          <div className="nm">{l.name}</div>
          <div className="md">{l.model} · מידה <b>{l.size}</b></div>
          <div className="md" style={{ fontSize: '9.5px', color: '#555' }}>
            אירוע {l.eventShort} · שמלה {l.n} מתוך {l.total}{l.hasRepair ? <> · <b>יש תיקון</b></> : null}
          </div>
          <div className="bcw"><RowCode code={l.code} height={8} /></div>
        </div>
      )}
    />
  );
}
