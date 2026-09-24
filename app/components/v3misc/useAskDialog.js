'use client';
// חלונית v3 שמחליפה window.confirm / window.alert באותה זרימה מוּמתנת (await).
// ask({title, sub, icon, badgeKind, okLabel, cancelLabel}) => Promise<boolean>
// בלי cancelLabel = הודעה (כפתור אחד; ה-Promise מתממש ב-true בסגירה).
// משמש רק את עמודי home/messages/my-hours/punch-clock/profile/display-settings.
import { useCallback, useRef, useState } from 'react';
import { Dialog, Btn } from '@/app/v3/ui/components';

export default function useAskDialog() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const ask = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(opts);
  }), []);

  const finish = (value) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    if (r) r(value);
  };

  const node = state ? (
    <Dialog
      open
      variant="confirm"
      mode="dark"
      title={state.title}
      sub={state.sub}
      icon={state.icon || 'info'}
      badgeKind={state.badgeKind}
      onClose={() => finish(state.cancelLabel ? false : true)}
      actions={(
        <>
          <Btn variant="primary" data-autofocus onClick={() => finish(true)}>{state.okLabel || 'הבנתי'}</Btn>
          {state.cancelLabel && <Btn variant="quiet" onClick={() => finish(false)}>{state.cancelLabel}</Btn>}
        </>
      )}
    />
  ) : null;

  return { ask, node };
}
