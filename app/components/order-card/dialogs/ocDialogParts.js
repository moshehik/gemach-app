'use client';

// ocDialogParts — רכיבי עזר משותפים לחלונות השמירה של W5 (D1/D2/D6/D7/R12/R48). אותו מבנה כמו העיצוב:
// crow (שורה עם אייקון בריבוע 38px, טקסט, סכום) ו-net (בלוק הסכום). רק רכיבי פלטה (.chg .c .ico .t .amt .net).

import OcIcon from '../OcIcon';
import { fmtMoney, fmtSignedMoney } from '../orderCardLogic';
import { emphasize, displayLine } from '../parts/ocRailLogic';

/** טקסט שינוי עם הדגשת הישות (<b>) כמו בעיצוב */
export const Emph = ({ text }) => emphasize(text).map((s, i) => (s.b ? <b key={i}>{s.t}</b> : s.t));

export const Money = ({ n, signed }) => <bdi dir="ltr">{signed ? fmtSignedMoney(n) : fmtMoney(n)}</bdi>;

/** crow בעיצוב: <div class="c"> [ico] <div class="t">…</div> [<div class="amt z">…</div>] */
export function Row({ icon, children, amt, tone = 'gray' }) {
  return (
    <div className="c">
      {icon ? <div className={`ico ${tone} oc-cico`}><OcIcon name={icon} size="sm" /></div> : null}
      <div className="t">{children}</div>
      {amt ? <div className="amt z">{amt}</div> : null}
    </div>
  );
}

/** שורת שינוי כמו ב-summaryDlg של העיצוב: צבע האייקון לפי הסכום (ירוק=זיכוי, ורוד=חיוב), פירוט מתחת, סכום רק כשיש יותר משינוי אחד עם סכום */
export function ChangeRow({ c: raw, showAmt }) {
  const c = { ...raw, ...displayLine(raw) };
  const tone = c.amt < 0 ? 'green' : c.amt > 0 ? 'rose' : 'gray';
  return (
    <div className="c">
      <div className={`ico ${tone} oc-cico`}><OcIcon name={c.icon || 'pencil'} size="sm" /></div>
      <div className="t"><Emph text={c.text} />{c.note ? <div className="faint sm">{c.note}</div> : null}</div>
      {c.amt && showAmt ? <div className={`amt ${c.amt > 0 ? 'p' : 'm'}`}><Money n={c.amt} signed /></div> : null}
    </div>
  );
}

/** בלוק הסכום (net): charge | credit | zero כמו בעיצוב */
export function NetBlock({ net }) {
  const n = Math.round((Number(net) || 0) * 100) / 100;
  if (n > 0) return <div className="net charge"><div><div className="sm">סה״כ לתשלום</div><div className="v"><Money n={n} /></div></div><OcIcon name="card" size="lg" /></div>;
  if (n < 0) return <div className="net credit"><div><div className="sm">זיכוי ללקוח</div><div className="v"><Money n={n} /></div></div><OcIcon name="undo" size="lg" /></div>;
  return <div className="net zero"><div><div className="sm">שינוי בסכום</div><div className="v"><bdi dir="ltr">₪0</bdi></div></div><OcIcon name="check" size="lg" /></div>;
}
