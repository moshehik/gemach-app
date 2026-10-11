'use client';

// הרייל "הדגם החדש" של אשף "דגם חדש" (A5): אריחי סיכום (קוד / שם / קטגוריה / פריטים / מידות / מיקומים), "פריטים להוספה" (הסל) ולחצני "יצירת הדגם" / "בטל הכול" -
// markup כמו renderRail() בעיצוב המאושר (model-new.js), מתחת ל-1024px גיליון תחתון (.rail.open). בתוך <aside class="rail" id="rail"> של ModelNewA5.
import { useEffect, useRef } from 'react';
import { Ic } from './MnUi';
import { locCount, locIcon, buildBarcode, plural } from './modelNewLogic';

function Chip({ cls, icon, txt, k, label, no, ctl }) {
  return (
    <button type="button" className={`gl ${cls}${no ? ' no sig' : ''}`} data-act="to-step" data-k={k} aria-label={label} data-tip={label} onClick={() => ctl.go(k)}>
      <Ic n={icon} /><span className="gv">{txt}</span>
    </button>
  );
}

export default function MnRail({ ctl }) {
  const { S } = ctl;
  const d = S.d;
  const n = S.items.length;
  const rootRef = useRef(null);
  const prevCount = useRef(null);
  // אנימציית "bump" לספירה שעלתה (כמו העיצוב: class זמני על הלחצן, בלי state)
  useEffect(() => {
    const el = rootRef.current && rootRef.current.querySelector('.cart-t');
    if (el) { el.classList.remove('bump'); if (prevCount.current !== null && n > prevCount.current) { void el.offsetWidth; el.classList.add('bump'); } }
    prevCount.current = n;
  }, [n]);
  const sz = ctl.sizes.length;
  const createTip = ctl.step1Ok && ctl.head !== false ? '' : (ctl.head === false ? 'יצירת דגם שמורה להנהלה ראשית' : `יש להשלים: ${ctl.missing.join(', ')}`);
  const list = n ? S.items.map((it) => (
    <div className="cl" data-key={it.key} key={it.key}>
      <div className="cl-i"><Ic n="dress" /></div>
      <div className="cl-t"><span><bdi>{buildBarcode(ctl.code, it.size, it.serial)}</bdi></span><small>מידה {it.size} · {it.loc}</small></div>
      <button type="button" className="cl-u" data-rm={it.key} aria-label="הסרת פריט" data-tip="הסרת פריט" onClick={() => ctl.removeItem(it.key)}><Ic n="trash" c="sm" /></button>
    </div>
  )) : <div className="cart-empty"><Ic n="box" c="lg" /><span>אין פריטים</span></div>;
  return (
    <div className="rcard cart" ref={rootRef}>
      <div className="sec-h"><Ic n="list" c="sm" /><span>הדגם החדש</span></div>
      <div className="glance">
        <Chip ctl={ctl} cls="code" icon="hash" txt={ctl.code ? <bdi>#{ctl.code}</bdi> : 'קוד'} k={1} label="קוד הדגם — לחיצה לעריכה" no={!ctl.code || !!ctl.codeErr} />
        {ctl.useModelNames ? <Chip ctl={ctl} cls="nm" icon="tag" txt={d.name.trim() ? d.name.trim() : 'שם'} k={1} label="שם הדגם — לחיצה לעריכה" no={!ctl.nameOk} /> : null}
        <Chip ctl={ctl} cls="cat" icon="card" txt={d.cat ? d.cat : 'קטגוריה'} k={1} label="קטגוריית מחיר — לחיצה לעריכה" no={!ctl.catOk} />
        <Chip ctl={ctl} cls="items-c" icon="box" txt={plural(n, 'פריט אחד', 'פריטים', '0 פריטים')} k={3} label="פריטים במלאי הראשוני" />
        <Chip ctl={ctl} cls="szs" icon="dress" txt={plural(sz, 'מידה אחת', 'מידות', '0 מידות')} k={3} label="מידות במלאי הראשוני" />
        {ctl.locations.map((l) => { const c = locCount(S.items, l); return <Chip key={l} ctl={ctl} cls={`loc${c ? '' : ' mn0'}`} icon={locIcon(l)} txt={`${c} ${l}`} k={3} label={`פריטים ב${l}`} />; })}
      </div>
      <div className="cart-h">
        <button type="button" className="cart-t" data-act="cart-toggle" aria-expanded={S.cartOpen ? 'true' : 'false'} onClick={() => ctl.upd((p) => ({ cartOpen: !p.cartOpen }))}>
          <Ic n="cart" c="sm" /><b>פריטים להוספה</b><span className="badge">{n}</span><span className="cart-sum" /><Ic n="chev" c="sm" />
        </button>
      </div>
      <div className="cart-body"><div className="cart-list">{list}</div></div>
      {S.saved ? null : (
        <div className="cart-actions">
          <span className="tipw" data-tip={createTip || undefined} style={{ display: 'block' }}>
            <button type="button" className="btn primary lg block" data-act="create" disabled={!ctl.canCreate} onClick={ctl.create}><Ic n="check" />יצירת הדגם</button>
          </span>
          {ctl.dirty ? <button type="button" className="btn ghost block sec" data-act="discard" onClick={ctl.discard}><Ic n="undo" c="sm" />בטל הכול</button> : null}
        </div>
      )}
    </div>
  );
}
