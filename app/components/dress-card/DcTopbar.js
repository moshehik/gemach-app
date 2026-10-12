'use client';

// DcTopbar - שורת הכותרת של כרטיס הדגם (העיצוב: .topbar > .back + .ttl(h1 "דגם #קוד שם") + #sbar + .tools + האייקון ישן/חדש).
// הכלים: ייצוא Excel · הורדת PDF · הדפסה (תפריט) · מחיקת דגם (בדגם מחוק: שחזור). הטולטיפים ב-data-tip (לא title). קוד הדגם והשם - מהמצב השמור.
import { useEffect, useRef, useState } from 'react';
import OcIcon, { XlGlyph } from '../order-card/OcIcon';
import PageVariantToggle from '../variant/PageVariantToggle';
import DcScanBar from './DcScanBar';
import { DcDeleteDialog, DcRestoreDialog } from './dialogs/DcSimpleDialogs';
import { PRINT_MENU, exportItemsXlsx, runDressDoc } from './dcPrint';
import { counts } from '@/lib/dressCardLogic';

function PrintMenu({ dc, ui }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if ((menuRef.current && menuRef.current.contains(e.target)) || (btnRef.current && btnRef.current.contains(e.target))) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); if (btnRef.current) btnRef.current.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const first = menuRef.current && menuRef.current.querySelector('[role="menuitem"]');
    if (first) first.focus({ preventScroll: true });
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const onMenuKey = (e) => {
    const els = menuRef.current ? Array.from(menuRef.current.querySelectorAll('[role="menuitem"]')) : [];
    if (!els.length) return;
    const i = els.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = els[(i + 1) % els.length];
    else if (e.key === 'ArrowUp') next = els[(i - 1 + els.length) % els.length];
    else if (e.key === 'Home') next = els[0];
    else if (e.key === 'End') next = els[els.length - 1];
    else if (e.key === 'Tab') { setOpen(false); return; }
    if (next) { e.preventDefault(); next.focus(); }
  };
  return (
    <>
      <button ref={btnRef} type="button" className="xlbtn xlp" data-guide-id="dc.tool-print" data-act="menu" aria-label="הדפסה" aria-haspopup="menu" aria-expanded={open} data-tip="הדפסה" onClick={() => setOpen((v) => !v)}>
        <XlGlyph kind="print" />
      </button>
      <div ref={menuRef} className={`menu${open ? ' open' : ''}`} id="pmenu" role="menu" aria-label="הדפסה" onKeyDown={onMenuKey}>
        {PRINT_MENU.map((m) => (
          <button key={m.act} type="button" role="menuitem" data-act={m.act} data-guide-id={`dc.pm-${m.act}`} onClick={() => { setOpen(false); runDressDoc({ dc, ui, kind: m.kind, which: m.which }); }}>
            <OcIcon name={m.icon} />{m.label}
          </button>
        ))}
      </div>
    </>
  );
}

export default function DcTopbar({ dc, ui }) {
  const ready = dc.status === 'ready' && !!dc.cur;
  const m = ready ? dc.saved.model : null;
  const deleted = ready && dc.cur.model.isDeleted;
  const askDelete = async () => {
    const ok = await ui.openDialog(DcDeleteDialog, { activeCount: counts(dc.saved.items).n });
    if (ok) await dc.deleteModel();
  };
  const askRestore = async () => {
    const ok = await ui.openDialog(DcRestoreDialog, {});
    if (ok) await dc.restoreModel();
  };
  return (
    <div className="topbar">
      <button type="button" className="back" data-guide-id="dc.back" data-act="exit" aria-label="חזרה לרשימת הדגמים" data-tip="חזרה לרשימת הדגמים" disabled={dc.saving} onClick={() => dc.exit()}>
        <OcIcon name="back" />
      </button>
      <div className="ttl">
        <h1><small>דגם</small><bdi id="ttlCode">{m ? `#${m.code}` : ''}</bdi>{m && dc.flags.useModelNames && m.name ? <span id="ttlName" className="dc-nm">{m.name}</span> : null}</h1>
        <span id="hdrChips" className="row wrap" />
      </div>
      {ready ? <DcScanBar dc={dc} ui={ui} /> : null}
      <div className="tools">
        {ready ? (
          <>
            <button type="button" className="xlbtn xlg" data-guide-id="dc.tool-excel" data-act="export-xl" aria-label="ייצוא ל-Excel" data-tip="ייצוא פריטי הדגם לקובץ Excel" onClick={() => exportItemsXlsx({ dc, ui })}><XlGlyph kind="excel" /></button>
            <button type="button" className="xlbtn xld" data-guide-id="dc.tool-pdf" data-act="export-dl" aria-label="הורדה" data-tip="הורדת כרטיס הדגם כקובץ PDF (באותו עיצוב כמו ההדפסה)" onClick={() => runDressDoc({ dc, ui, kind: 'download', which: 'card' })}><XlGlyph kind="download" /></button>
            <PrintMenu dc={dc} ui={ui} />
            {deleted
              ? <button type="button" className="xlbtn xld" data-guide-id="dc.tool-restore" data-act="restore" aria-label="שחזור דגם" data-tip="שחזור דגם" onClick={askRestore}><OcIcon name="refresh" /></button>
              : <button type="button" className="xlbtn xld" data-guide-id="dc.tool-delete" data-act="delete" aria-label="מחיקת דגם" data-tip="מחיקת דגם" onClick={askDelete}><XlGlyph kind="delete" /></button>}
          </>
        ) : null}
      </div>
      <PageVariantToggle screen="model_card" placement="header" systemTip />
    </div>
  );
}
