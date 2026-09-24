'use client';

// חלוניות v3 לשימוש משפחת "לקוחות": הודעה (במקום window.alert) ואישור (במקום window.customConfirm).
// אותו זרימה: alert = הצגה בלבד; confirm = Promise<boolean> שמחכים לו ב-await.
import { useCallback, useRef, useState } from 'react';
import { Dialog, Btn } from '@/app/v3/ui/components';

const MSG_STYLE = { whiteSpace: 'pre-line' };

export function useAlertDialog() {
  const [state, setState] = useState(null);
  const show = useCallback((message, title = 'שימו לב') => {
    setState({ message: String(message ?? ''), title });
  }, []);
  const close = useCallback(() => setState(null), []);
  const node = (
    <Dialog
      open={!!state}
      onClose={close}
      variant="confirm"
      mode="light"
      icon="alert-circle"
      title={state?.title}
      sub={<span style={MSG_STYLE}>{state?.message}</span>}
      actions={<Btn variant="primary" onClick={close} data-autofocus>הבנתי</Btn>}
    />
  );
  return [show, node];
}

export function useConfirmDialog() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const ask = useCallback((message, title = 'לאשר?') => new Promise((resolve) => {
    resolver.current = resolve;
    setState({ message: String(message ?? ''), title });
  }), []);
  const settle = useCallback((value) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    if (r) r(value);
  }, []);
  const node = (
    <Dialog
      open={!!state}
      onClose={() => settle(false)}
      variant="confirm"
      mode="light"
      icon="alert-tri"
      title={state?.title}
      sub={<span style={MSG_STYLE}>{state?.message}</span>}
      actions={(
        <>
          <Btn variant="primary" onClick={() => settle(true)} data-autofocus>אישור</Btn>
          <Btn variant="quiet" onClick={() => settle(false)}>ביטול</Btn>
        </>
      )}
    />
  );
  return [ask, node];
}
