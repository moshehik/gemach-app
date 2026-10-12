'use client';

// BranchNotices - כל ההתראות והמארחים של ריבוי הסניפים, מותקן פעם אחת בכל מעטפת (AppShell / MenuA5Shell) ורק כשההגדרות דלוקות
// (app/layout.js מעביר cfg; null = לא מותקן בכלל, אפס עלות). docs/branches-plan.md, שלב ד.
//   - BranchReturnAlertHost: חלון ההתראה בסריקת החזרה (כשאחת מהתראות ההחזרה / הרזרבה דלוקה)
//   - QuickTransferHost: החלונית הצפה של ההקלדה המהירה, נפתחת ע"י openQuickTransfer() (ריבוי סניפים)
//   - MyBranchPrompt: פעם אחת בכל מחשב - "באיזה סניף המחשב הזה?" (localStorage + עוגייה gm_my_branch, לסריקות החזרה ולברירות מחדל)
//   - TransferBanner: הפס בראש הדף מתחת לשורת התפריט: פריטים להעביר / להחזיר לסניף אחר, לפי הגדרות "מתי" ו"מה" (A5: NoticeBar; ישן: פס בתוך הדף)
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import '@/design-system/components.css';
import '../new-order/css/new-order-font.css';
import '../new-order/css/new-order.css';
import '../ai-widget/ai-dialogs.css';
import { DialogFrame } from '../new-order/NoDialogs';
import { MenuSprite } from '../menu/menuParts';
import { useNoticeBar } from '../menu/NoticeBar';
import { DlgBtn, DlgButtons, DlgHead } from '../order-card/OcUi';
import BranchReturnAlertHost from './BranchReturnAlertHost';
import QuickTransferHost, { openQuickTransfer } from './QuickTransferHost';
import { MY_BRANCH_STORAGE_KEY } from '@/lib/branches';
import { saveMyBranch } from './myBranch';
import { buildBannerRows } from '@/lib/branchNeeds';
import { onActiveInterval } from '@/lib/idleGuard';

export const TRANSFER_NOTICE_ID = 'branch-transfers';
const POLL_MS = 10 * 60 * 1000;

const safeGet = (store, k) => { try { return window[store].getItem(k) || ''; } catch { return ''; } };
const safeSet = (store, k, v) => { try { window[store].setItem(k, v); } catch { /* חסום - best effort */ } };

function TransferBanner({ cfg }) {
  const bar = useNoticeBar();
  const barRef = useRef(bar);
  useEffect(() => { barRef.current = bar; });
  const [legacyRows, setLegacyRows] = useState([]);
  const [hidden, setHidden] = useState(false);
  const legacySigRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/branches/needs?days=${Math.max(1, cfg.bannerDays)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.enabled) return;
        const rows = buildBannerRows({ transfers: data.transfers, pendingReturns: data.pendingReturns, scope: cfg.bannerScope, days: cfg.bannerDays });
        const sig = rows.map((r) => r.key).join('|');
        const dismissedSig = safeGet('sessionStorage', 'branchBannerDismissed');
        const b = barRef.current;
        if (!rows.length || dismissedSig === sig) {
          if (b) b.dismiss(TRANSFER_NOTICE_ID); else setLegacyRows([]);
          return;
        }
        const shown = rows.slice(0, 12);
        const more = rows.length - shown.length;
        const title = `יש ${rows.length} ${rows.length === 1 ? 'פריט' : 'פריטים'} להעביר או להחזיר לסניף אחר`;
        if (b) {
          b.add({
            id: TRANSFER_NOTICE_ID, kind: 'warning', title,
            detail: `לפי ההזמנות הקרובות${more > 0 ? ` (מוצגים ${shown.length})` : ''}`,
            rows: [
              ...shown.map((r) => ({ icon: r.icon, text: r.text, href: r.href })),
              { icon: 'scan', text: 'פתיחת העברה מהירה של ברקודים', href: '#', onClick: (e) => { e.preventDefault(); openQuickTransfer(); } },
            ],
            onClose: () => safeSet('sessionStorage', 'branchBannerDismissed', sig),
          });
        } else {
          setHidden(false);
          setLegacyRows(shown.map((r) => ({ ...r })).concat(more > 0 ? [{ key: 'more', icon: 'info', text: `ועוד ${more}`, href: null }] : []));
          legacySigRef.current = sig;
        }
      } catch { /* best-effort בלבד */ }
    };
    check();
    const stop = onActiveInterval(check, POLL_MS);
    return () => { cancelled = true; stop(); };
  }, [cfg.bannerDays, cfg.bannerScope]);

  if (bar || hidden || !legacyRows.length) return null;
  return (
    <div className="callout callout-warning" role="status" style={{ margin: '0 0 12px', flexDirection: 'column', gap: 6 }} data-testid="branch-transfer-strip">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <b>יש {legacyRows.length} פריטים להעביר או להחזיר לסניף אחר</b>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openQuickTransfer()}>העברה מהירה</button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="סגירה" onClick={() => { safeSet('sessionStorage', 'branchBannerDismissed', legacySigRef.current); setHidden(true); }}>סגירה</button>
        </span>
      </div>
      {legacyRows.map((r) => (r.href ? <Link key={r.key} href={r.href} style={{ color: 'inherit' }}>{r.text}</Link> : <span key={r.key}>{r.text}</span>))}
    </div>
  );
}

function MyBranchPrompt() {
  const [branches, setBranches] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (safeGet('localStorage', MY_BRANCH_STORAGE_KEY) || safeGet('sessionStorage', 'myBranchSkipped')) return undefined;
    let off = false;
    fetch('/api/branches', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (off || !j || !j.enabled) return;
      const names = (j.branches || []).filter((b) => b.active).map((b) => b.name);
      if (names.length >= 2) { setBranches(names); setOpen(true); }
    }).catch(() => {});
    return () => { off = true; };
  }, []);

  const choose = useCallback((n) => { saveMyBranch(n); setOpen(false); }, []);
  if (!open || !branches || typeof document === 'undefined') return null;
  const skip = () => { safeSet('sessionStorage', 'myBranchSkipped', '1'); setOpen(false); };
  return createPortal(
    <div className="gm-ds gm-no dlg-dark ai-dlg-root" dir="rtl">
      <MenuSprite />
      <DialogFrame layer={1} onBackdrop={skip}>
        <DlgHead id="mybranch-t" title="באיזה סניף נמצא המחשב הזה?" sub="נשמור את הבחירה במחשב הזה. היא משמשת להתראות על החזרות (לאיזה סניף להעביר) ולברירות המחדל. אפשר לשנות אותה בחלונית ההעברה המהירה." />
        <DlgButtons>
          {branches.map((n, i) => <DlgBtn key={n} kind={i === 0 ? 'primary' : 'plain'} icon="pin" onClick={() => choose(n)}>{n}</DlgBtn>)}
          <DlgBtn kind="ghost" icon="x" onClick={skip}>דלגו כרגע</DlgBtn>
        </DlgButtons>
      </DialogFrame>
    </div>,
    document.body,
  );
}

/** @param {{ cfg: { multi:boolean, bannerEnabled:boolean, bannerDays:number, bannerScope:string, returnAlert:boolean, reserveAlert:boolean }|null }} props */
export default function BranchNotices({ cfg }) {
  if (!cfg) return null;
  return (
    <>
      {cfg.returnAlert || cfg.reserveAlert ? <BranchReturnAlertHost /> : null}
      {cfg.multi ? <QuickTransferHost /> : null}
      {cfg.multi ? <MyBranchPrompt /> : null}
      {cfg.multi && cfg.bannerEnabled ? <TransferBanner cfg={cfg} /> : null}
    </>
  );
}
