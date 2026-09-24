'use client';

// ערכת עזר משותפת לשלושת עמודי הרשימות (/orders, /rentals, /refunds) — v3.
// שכבת תצוגה בלבד: מחליפה alert / customConfirm / prompt בחלוניות v3 עם אותו זרימת await,
// ומספקת כפתור-איקון עם ריבוע צף (Tip) — בלי לגעת בלוגיקה של העמודים.

import { useCallback, useRef, useState } from 'react';
import { Btn, Dialog, Field, IconBtn, Tip } from '@/app/v3/ui/components';

/**
 * useListDialogs — מחזיר { confirm, notify, prompt, dialogs }.
 *  - confirm(message, {title, confirmLabel, cancelLabel, danger, icon}) => Promise<boolean>
 *  - notify(message, {title, icon})                                     => Promise<void>   (מחליף alert)
 *  - prompt(message, {title, label, defaultValue, confirmLabel})        => Promise<string|null>  (null = ביטול, '' = אישור ריק)
 *  - dialogs: אלמנט לרנדר פעם אחת בעמוד.
 */
export function useListDialogs() {
  const [dlg, setDlg] = useState(null);
  const [text, setText] = useState('');
  const pending = useRef(null);

  const settle = useCallback((value) => {
    const p = pending.current;
    pending.current = null;
    setDlg(null);
    if (p) p.resolve(value);
  }, []);

  const open = useCallback((cfg) => new Promise((resolve) => {
    if (pending.current) pending.current.resolve(pending.current.cancelValue);
    pending.current = { resolve, cancelValue: cfg.cancelValue };
    setText(cfg.defaultValue || '');
    setDlg(cfg);
  }), []);

  const confirm = useCallback((message, o = {}) => open({ kind: 'confirm', message, cancelValue: false, ...o }), [open]);
  const notify = useCallback((message, o = {}) => open({ kind: 'alert', message, cancelValue: undefined, ...o }), [open]);
  const prompt = useCallback((message, o = {}) => open({ kind: 'prompt', message, cancelValue: null, ...o }), [open]);

  let dialogs = null;
  if (dlg) {
    const body = <span style={{ whiteSpace: 'pre-line' }}>{dlg.message}</span>;
    if (dlg.kind === 'confirm') {
      dialogs = (
        <Dialog
          open
          variant="confirm"
          icon={dlg.icon || (dlg.danger ? 'trash' : 'alert-circle')}
          title={dlg.title || 'לאשר?'}
          sub={body}
          onClose={() => settle(false)}
          actions={(
            <>
              <Btn variant={dlg.danger ? 'danger' : 'primary'} data-autofocus onClick={() => settle(true)}>{dlg.confirmLabel || 'אישור'}</Btn>
              <Btn variant="quiet" onClick={() => settle(false)}>{dlg.cancelLabel || 'ביטול'}</Btn>
            </>
          )}
        />
      );
    } else if (dlg.kind === 'alert') {
      dialogs = (
        <Dialog
          open
          variant="confirm"
          icon={dlg.icon || 'info'}
          title={dlg.title || 'הודעה'}
          sub={body}
          onClose={() => settle(undefined)}
          actions={<Btn variant="primary" data-autofocus onClick={() => settle(undefined)}>הבנתי</Btn>}
        />
      );
    } else {
      dialogs = (
        <Dialog
          open
          variant="form"
          icon={dlg.icon || 'edit'}
          title={dlg.title || 'הזנת פרטים'}
          sub={body}
          onClose={() => settle(null)}
          actions={(
            <>
              <Btn variant="primary" onClick={() => settle(text)}>{dlg.confirmLabel || 'אישור'}</Btn>
              <Btn variant="quiet" onClick={() => settle(null)}>ביטול</Btn>
            </>
          )}
        >
          <Field
            label={dlg.label || 'ערך'}
            value={text}
            data-autofocus=""
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); settle(text); } }}
          />
        </Dialog>
      );
    }
  }

  return { confirm, notify, prompt, dialogs };
}

/** כפתור-איקון עם תווית נגישה וריבוע צף (Tip). ה-onClick נשאר של הכפתור. */
export function IconAction({ label, tip, ...props }) {
  return (
    <Tip content={tip || label}>
      <span className="v3-cluster" tabIndex={-1}>
        <IconBtn label={label} {...props} />
      </span>
    </Tip>
  );
}
