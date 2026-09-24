'use client';

// חלוניות v3 לכרטיס ההזמנה: תחליף ל-alert / confirm / prompt של הדפדפן, באותה זרימת await.
//   const { v3Alert, v3Confirm, v3Prompt, dialogs } = useV3Dialogs();
//   await v3Alert('...');           // ממתין עד לסגירה
//   if (!(await v3Confirm('...'))) return;
//   const val = await v3Prompt('...');   // מחרוזת או null
// v3Confirm(msg, { locked: true }) = אפשר לסגור רק דרך הכפתורים (בלי Esc / לחיצה על הרקע) - לבחירות הרסניות.
// חובה לרנדר את {dialogs} פעם אחת בעץ של הרכיב. חלוניות שמתבקשות בזו אחר זו נכנסות לתור.
import { useCallback, useEffect, useRef, useState } from 'react';
import '../../../app/v3/tokens.css';
import '../../../app/v3/components.css';
import { Dialog, Btn, Field, Tip } from '../../../app/v3/ui/components';

const EMPTY_ITEM = { type: '', icon: 'info', title: '', message: '', confirmLabel: '', cancelLabel: '' };
const multiline = (text) => <span style={{ whiteSpace: 'pre-line' }}>{text}</span>;

// כל החלוניות נשארות mounted תמיד (רק open משתנה): רכיב Dialog של v3 מצפה שהעוגן שלו כבר קיים
// כשנפתח - פתיחה ברינדור הראשון של הרכיב הייתה נכשלת ב-effect של לכידת הפוקוס.
function PromptDialog({ item, open, onDone }) {
  const [value, setValue] = useState('');
  const itemId = item?.id;
  useEffect(() => { setValue(item?.defaultValue || ''); }, [itemId]);
  const it = item || EMPTY_ITEM;
  return (
    <Dialog
      open={open} variant="form" icon={it.icon} title={it.title} sub={multiline(it.message)} onClose={() => onDone(null)}
      actions={(
        <>
          <Btn variant="primary" icon="check" onClick={() => onDone(value)}>{it.confirmLabel}</Btn>
          <Btn variant="quiet" onClick={() => onDone(null)}>{it.cancelLabel}</Btn>
        </>
      )}
    >
      <Field
        label={it.label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={it.placeholder}
        inputMode={it.inputMode}
        data-autofocus=""
        onKeyDown={(e) => { if (e.key === 'Enter') onDone(value); }}
      />
    </Dialog>
  );
}

export function useV3Dialogs() {
  const [queue, setQueue] = useState([]);
  const seq = useRef(0);

  const push = useCallback((spec) => new Promise((resolve) => {
    seq.current += 1;
    setQueue((q) => [...q, { ...spec, id: seq.current, resolve }]);
  }), []);

  const v3Alert = useCallback((message, opts = {}) => push({
    type: 'alert', message, title: opts.title || 'שימו לב', icon: opts.icon || 'alert-circle',
    confirmLabel: opts.confirmLabel || 'הבנתי',
  }), [push]);

  const v3Confirm = useCallback((message, opts = {}) => push({
    type: 'confirm', message, title: opts.title || 'לאשר?', icon: opts.icon || 'info',
    confirmLabel: opts.confirmLabel || 'אישור', cancelLabel: opts.cancelLabel || 'ביטול', content: opts.content, locked: !!opts.locked,
  }), [push]);

  const v3Prompt = useCallback((message, opts = {}) => push({
    type: 'prompt', message, title: opts.title || 'נדרש מידע', icon: opts.icon || 'edit',
    label: opts.label || message, placeholder: opts.placeholder, defaultValue: opts.defaultValue, inputMode: opts.inputMode,
    confirmLabel: opts.confirmLabel || 'אישור', cancelLabel: opts.cancelLabel || 'ביטול',
  }), [push]);

  const cur = queue[0];
  const settle = (value) => {
    if (!cur) return;
    setQueue((q) => q.filter((x) => x.id !== cur.id));
    cur.resolve(value);
  };

  // כל ה-Dialog-ים נשארים mounted תמיד (רק open משתנה) - ר' הערה מעל PromptDialog.
  const shown = cur || EMPTY_ITEM;
  const isOpen = (type) => !!cur && cur.type === type;

  const node = (
    <>
      <Dialog
        open={isOpen('alert')} variant="confirm" mode="light" icon={shown.icon} title={shown.title} sub={multiline(shown.message)}
        onClose={() => settle(undefined)}
        actions={<Btn variant="primary" data-autofocus="" onClick={() => settle(undefined)}>{shown.confirmLabel}</Btn>}
      />
      <Dialog
        open={isOpen('confirm')} variant="confirm" mode="light" icon={shown.icon} title={shown.title} sub={multiline(shown.message)}
        closeOnScrim={!shown.locked}
        onClose={() => { if (!shown.locked) settle(false); }}
        actions={(
          <>
            <Btn variant="primary" icon="check" data-autofocus="" onClick={() => settle(true)}>{shown.confirmLabel}</Btn>
            <Btn variant="quiet" onClick={() => settle(false)}>{shown.cancelLabel}</Btn>
          </>
        )}
      >
        {shown.content}
      </Dialog>
      <PromptDialog item={shown.type === 'prompt' ? shown : null} open={isOpen('prompt')} onDone={settle} />
    </>
  );

  return { v3Alert, v3Confirm, v3Prompt, dialogs: node };
}

// עוגן Tip סביב כפתור: Tip מחליף onClick של הילד המשובץ, לכן עוטפים ב-span (בלי עצירת טאב).
export function TipWrap({ content, className, children }) {
  return (
    <Tip content={content}>
      <span tabIndex={-1} className={className} style={className ? undefined : { display: 'inline-flex' }}>{children}</span>
    </Tip>
  );
}
