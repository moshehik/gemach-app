'use client';

// OcPrintMenu — לחצן "הדפסה / מייל" בשורת הכותרת + התפריט הצף שלו (slot PrintMenu). העיצוב: .tools > .xlbtn.xlp + div.menu#pmenu.
// שורות (R6): הדפסת סיכום ללקוח · הדפסת דף השכרה · דף הכנה למחסן (A3 = PP-07 של הלו״ז, גרסה ב׳, להזמנה זו) · דף משלוח (A4 = PP-12, רק עם
// משלוח הלוך כש-enable_deliveries) · שליחה במייל · מייל השכרה. שער התקנון (R7): בלחיצה על הלחצן כשהלקוח לא חתם נפתח "האם הלקוח חתם על התקנון?";
// "כן, חתם" שומר את החתימה (oc.toggleSignature) ופותח את התפריט - בדיוק כמו הישן (OrderPrintMenu :64-71).
// הדפסה = לשונית חדשה; הדפים רושמים ORDER_PRINTED בעצמם (/print/order ודפי הלו״ז עם orderId) - הכרטיס לא רושם הדפסה (חוזה W0 §1.5).
// דפי הלו״ז דורשים page:schedule (ו-PP-12 גם page:deliveries): השורות מוצגות רק כשהשרת אישר (GET /api/schedule/print?format=access, פעם אחת בדף) - לא ידוע/תקלה = מוסתרות, בלי קישור שבור;
// עובדת עם page:orders בלבד לא רואה אותן (REQUESTS-W7 #8). השרת אוכף בכל מקרה. מייל: parts/OcMailSheet.js (+ "כתובת מייל חסרה": parts/OcMissingEmail.js).
import { useEffect, useRef, useState } from 'react';
import OcIcon, { XlGlyph } from '../OcIcon';
import { needsRegulationsGate, printMenuItems, printTargetUrl } from './ocDocsLogic';
import { useScheduleAccess } from './ocScheduleAccess';
import { openMailSheet } from './OcMailSheet';

export default function OcPrintMenu({ oc, ui }) {
  const [open, setOpen] = useState(false);
  const access = useScheduleAccess();
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if ((menuRef.current && menuRef.current.contains(e.target)) || (btnRef.current && btnRef.current.contains(e.target))) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current && btnRef.current.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // מצב השרת האחרון - הדפים מודפסים מהשרת, לא ממה שבעריכה
  const order = (oc.snapshot && oc.snapshot.order) || oc.order;
  const items = printMenuItems({ order, settings: oc.settings, access });
  const orderId = oc.order && oc.order.orderId;

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    if (needsRegulationsGate(oc.order)) {
      const signed = await ui.confirm({ title: 'חתימה על תקנון', sub: 'האם הלקוח חתם על התקנון?', okText: 'כן, חתם', cancelText: 'לא (ביטול)', icon: 'check' });
      if (!signed) return;
      const saved = await oc.toggleSignature({ confirmed: true });
      if (!saved) return;
    }
    setOpen(true);
  };

  const pick = (item) => {
    setOpen(false);
    if (item.kind === 'print') {
      const url = printTargetUrl(item, orderId);
      if (url) window.open(url, '_blank');
      return;
    }
    openMailSheet({ oc, ui, mode: 'doc', type: item.target });
  };

  return (
    <>
      <button ref={btnRef} type="button" className="xlbtn xlp" data-act="menu" aria-label="הדפסה ומייל" data-tip="הדפסה / מייל" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <XlGlyph kind="print" />
      </button>
      <div ref={menuRef} className={`menu${open ? ' open' : ''}`} id="pmenu" role="menu" aria-label="הדפסה ומייל">
        {items.map((it) => (
          <button key={it.key} type="button" role="menuitem" data-act={`pm-${it.key}`} onClick={() => pick(it)}>
            <OcIcon name={it.icon} />{it.label}
          </button>
        ))}
      </div>
    </>
  );
}
