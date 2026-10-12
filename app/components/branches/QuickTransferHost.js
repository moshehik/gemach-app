'use client';

// QuickTransferHost - מארח עצמאי לחלונית ההקלדה המהירה מחוץ לכרטיס הדגם (פס ההתראות, לו"ז, /admin/branches ועוד).
// פתיחה מכל מקום: openQuickTransfer() (אירוע window 'gm:open-quick-transfer'). מותקן פעם אחת במעטפת (BranchNotices.js),
// רק כש-multi_branch_enabled דלוק. אותו מראה כמו OverdueOrdersModal (חלונית #dlg כהה של הפלטה, בפורטל).
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import '@/design-system/components.css';
import '../new-order/css/new-order-font.css';
import '../new-order/css/new-order.css';
import '../ai-widget/ai-dialogs.css';
import { DialogFrame } from '../new-order/NoDialogs';
import { MenuSprite } from '../menu/menuParts';
import { DlgBtn, DlgButtons, DlgHead } from '../order-card/OcUi';
import { QuickTransferPanel } from './QuickTransferDialog';
import { MY_BRANCH_STORAGE_KEY, LEGACY_LAST_ORDER_BRANCH_KEY, pickDefaultBranch } from '@/lib/branches';

export const OPEN_QUICK_TRANSFER_EVENT = 'gm:open-quick-transfer';
export const openQuickTransfer = (detail) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_QUICK_TRANSFER_EVENT, { detail: detail || {} }));
};

const safeGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };

export default function QuickTransferHost() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null); // { branches: string[], defaultBranch }
  const [err, setErr] = useState('');

  const onOpen = useCallback(async () => {
    setOpen(true); setErr(''); setData(null);
    try {
      const res = await fetch('/api/branches', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.enabled) { setErr(j.error || 'ריבוי סניפים כבוי'); return; }
      const cfg = { branches: j.branches || [] };
      const names = cfg.branches.filter((b) => b.active).map((b) => b.name);
      setData({ branches: names, defaultBranch: pickDefaultBranch(cfg, safeGet(MY_BRANCH_STORAGE_KEY) || safeGet(LEGACY_LAST_ORDER_BRANCH_KEY)) });
    } catch { setErr('שגיאת תקשורת'); }
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_QUICK_TRANSFER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_QUICK_TRANSFER_EVENT, onOpen);
  }, [onOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const close = () => setOpen(false);
  const content = (
    <div className="gm-ds gm-no dlg-dark ai-dlg-root" dir="rtl">
      <MenuSprite />
      <DialogFrame layer={1} cls="ai-wide" onBackdrop={close}>
        <DlgHead id="qt-host-t" title="העברה מהירה של ברקודים" sub="סורקים רצף ברקודים ומעבירים את כולם בבת אחת" />
        {err ? <div className="empty" role="alert"><p>{err}</p></div> : null}
        {!err && !data ? <div className="empty" role="status"><span className="spin" /><p>טוען…</p></div> : null}
        {data ? <QuickTransferPanel branches={data.branches} defaultBranch={data.defaultBranch} /> : null}
        <DlgButtons style={{ marginTop: 16 }}>
          <DlgBtn kind="ghost" icon="x" onClick={close}>סגירה</DlgBtn>
        </DlgButtons>
      </DialogFrame>
    </div>
  );
  return createPortal(content, document.body);
}
