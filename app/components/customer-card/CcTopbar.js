'use client';

// שורת הכותרת (העיצוב: .topbar > .back + .ttl(h1 "לקוח" + שם) + .tools). הבעלים PG3: בכותרת רק "לקוח <שם>" וחץ החזרה - בלי
// אווטאר, בלי צ׳יפים, בלי "עודכן לאחרונה" (#hdrChips ריק). M3: החץ = "חזור" של הכרטיס הישן, עם שומר יציאה. הכלים: ייצוא ל-Excel,
// הורדת הכרטיס כקובץ, תפריט הדפסה (כרטיס לקוחה / דף חשבון / דף פרטי קשר) + "שליחה במייל" (M2 = "שליחת מייל" של הישן),
// מחיקת לקוחה. הטולטיפים ב-data-tip (לא title).

import { useEffect, useRef, useState } from 'react';
import CcIcon, { XlGlyph } from './CcIcon';
import { displayName } from './customerCardLogic';

export default function CcTopbar({ cc }) {
  const [menu, setMenu] = useState(false);
  const toolsRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const off = (e) => { if (toolsRef.current && !toolsRef.current.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [menu]);
  const ready = cc.status === 'ready';
  const pick = (fn) => () => { setMenu(false); fn(); };
  return (
    <div className="topbar">
      <button type="button" className="back" data-act="exit" aria-label="חזרה לרשימה" data-tip="חזרה לרשימה" onClick={() => cc.exit()}>
        <CcIcon name="back" />
      </button>
      <div className="ttl">
        <h1><small>לקוח</small><bdi id="ttlName">{ready ? displayName(cc.saved) : ''}</bdi></h1>
        <span id="hdrChips" className="row wrap" />
      </div>
      {ready ? (
        <div className="tools" ref={toolsRef}>
          <button type="button" className="xlbtn xlg" data-act="excel" aria-label="ייצוא ל-Excel" data-tip="ייצוא הלקוחה לקובץ Excel" onClick={cc.exportXlsx}><XlGlyph kind="excel" /></button>
          <button type="button" className="xlbtn xld" data-act="download" aria-label="הורדה" data-tip="הורדת כרטיס הלקוחה כקובץ" onClick={cc.downloadCard}><XlGlyph kind="download" /></button>
          <button type="button" className="xlbtn xlp" data-act="menu" aria-label="הדפסה ומייל" data-tip="הדפסה / מייל" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><XlGlyph kind="print" /></button>
          {!cc.readOnly ? <button type="button" className="xlbtn xld" data-act="delete" aria-label="מחיקת לקוחה" data-tip="מחיקת לקוחה" onClick={cc.deleteCustomer}><XlGlyph kind="delete" /></button> : null}
          <div className={`menu${menu ? ' open' : ''}`} id="pmenu" role="menu">
            <button type="button" role="menuitem" data-act="print-card" onClick={pick(() => cc.printDoc('card'))}><CcIcon name="print" />הדפסת כרטיס לקוחה</button>
            <button type="button" role="menuitem" data-act="print-account" onClick={pick(() => cc.printDoc('account'))}><CcIcon name="wallet" />דף חשבון</button>
            <button type="button" role="menuitem" data-act="print-contact" onClick={pick(() => cc.printDoc('contact'))}><CcIcon name="phone" />דף פרטי קשר</button>
            <button type="button" role="menuitem" data-act="mail-open" onClick={pick(cc.openMail)}><CcIcon name="mail" />שליחה במייל</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
