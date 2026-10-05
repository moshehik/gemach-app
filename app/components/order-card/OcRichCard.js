'use client';

// OcRichCard - הכרטיס העשיר (#rt בדמו = .pl-rt בפלטה): .rr1 לכל שורה (אייקון + טקסט), חץ .ra, role=tooltip. משותף לציר העליון ולסרגל הסיכום (gold).
// מיקום: placeTip (parts/ocTipLogic.js) - 'above' לצמתי הציר, 'side' לשאר; מתהפך מתחת לתפריט העליון ([data-sticky-nav]). anchor = getBoundingClientRect של העוגן.
import { useLayoutEffect, useRef, useState } from 'react';
import OcIcon from './OcIcon';
import { placeTip } from './parts/ocTipLogic';

export const navBottomOf = () => {
  const nav = typeof document !== 'undefined' ? document.querySelector('[data-sticky-nav]') : null;
  return nav ? nav.getBoundingClientRect().bottom : 0;
};

export default function OcRichCard({ id, rows, anchor, mode = 'above', gold = false }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setPos(placeTip(anchor, el.offsetWidth, el.offsetHeight, { vw: document.documentElement.clientWidth, vh: window.innerHeight, navBottom: navBottomOf() }, mode));
  }, [anchor, rows, mode]);
  const arrow = pos ? (pos.side === 'r' || pos.side === 'l' ? { top: pos.arrowTop, left: '' } : { left: pos.arrowLeft, top: '' }) : undefined;
  return (
    <div ref={ref} id={id} className={`pl-rt${gold ? ' gold' : ''}${pos ? ' on' : ''}`} role="tooltip" data-side={pos ? pos.side : undefined} style={{ left: pos ? pos.x : 0, top: pos ? pos.y : 0 }}>
      {rows.map((r, i) => <div className="rr1" key={i}><OcIcon name={r.icon} size="sm" /><span>{r.text}</span></div>)}
      <i className="ra" style={arrow} />
    </div>
  );
}
