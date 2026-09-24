'use client';
// חלוניות v3 מבוססות-הבטחה, במקום window.customConfirm / alert הנייטיב.
// אותו זרימה מוחלטת: `await confirm(...)` מחזיר true/false, `await notice(...)` נסגר בלחיצה.
// שימוש:  const { confirm, notice, dialogs } = useDressDialogs();  ... {dialogs} בסוף ה-JSX.
import { useCallback, useRef, useState } from 'react';
import { Dialog, Btn } from '@/app/v3/ui/components';

export default function useDressDialogs() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const close = useCallback((value) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    if (r) r(value);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    const o = typeof opts === 'string' ? { text: opts } : opts;
    resolver.current = resolve;
    setState({ kind: 'confirm', ...o });
  }), []);

  const notice = useCallback((opts) => new Promise((resolve) => {
    const o = typeof opts === 'string' ? { text: opts } : opts;
    resolver.current = resolve;
    setState({ kind: 'notice', ...o });
  }), []);

  const dialogs = state && (
    <Dialog
      open
      variant="confirm"
      mode={state.mode || 'light'}
      title={state.title}
      sub={state.text}
      icon={state.icon || (state.kind === 'confirm' ? 'alert-circle' : 'info')}
      onClose={() => close(state.kind === 'confirm' ? false : undefined)}
      actions={state.kind === 'confirm' ? (
        <>
          <Btn variant={state.danger ? 'danger' : 'primary'} data-autofocus="" onClick={() => close(true)}>{state.confirmLabel || 'אישור'}</Btn>
          <Btn variant="quiet" onClick={() => close(false)}>{state.cancelLabel || 'ביטול'}</Btn>
        </>
      ) : (
        <Btn variant="primary" data-autofocus="" onClick={() => close(undefined)}>{state.okLabel || 'הבנתי'}</Btn>
      )}
    />
  );

  return { confirm, notice, dialogs };
}
