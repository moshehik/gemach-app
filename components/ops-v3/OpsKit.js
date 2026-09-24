'use client';
// כלי תצוגה משותפים לעמודי "תפעול" (תפירות, לוח שנה, משלוחים) — שכבת תצוגה בלבד (R8).
// לא נכנסת ללוגיקה: מקבלת state ו-handlers מהעמוד כפי שהם.
import { useCallback, useRef, useState } from 'react';
import { Btn, Dialog, Icon, IconBtn, Tip } from '@/app/v3/ui/components';
import './ops.css';

/** מצב חלונית אישור/קוד לפי ערכת הנושא הפעילה (בהיר/כהה). חלונית עם קלט — תמיד בהיר (Dialog מטפל). */
export function dlgMode() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** כפתור-איקון עם ריבוע הסבר צף (R11) ותווית נגישה. */
export function TipBtn({ icon, label, variant = 'secondary', size = 'md', ...rest }) {
  return (
    <Tip content={label}>
      <span className="ops-anchor" tabIndex={-1}>
        <IconBtn icon={icon} label={label} variant={variant} size={size} {...rest} />
      </span>
    </Tip>
  );
}

/**
 * מחליף window.customConfirm / alert בחלונית v3, באותו זרם await:
 *   const ok = await ask({ title, text, icon, okLabel, cancelLabel });   // Promise<boolean>
 *   tell({ title, text, icon });                                         // הודעה + "הבנתי" (Promise<true>)
 * יש להציג {node} פעם אחת בעמוד.
 */
export function useOpsDialogs() {
  const [dlg, setDlg] = useState(null);
  const resolver = useRef(null);

  const settle = useCallback((value) => {
    const r = resolver.current;
    resolver.current = null;
    setDlg(null);
    if (r) r(value);
  }, []);

  const open = useCallback((kind, o) => new Promise((resolve) => {
    if (resolver.current) resolver.current(false);
    resolver.current = resolve;
    setDlg({ kind, ...o });
  }), []);

  const ask = useCallback((o) => open('confirm', o), [open]);
  const tell = useCallback((o) => open('alert', o), [open]);

  const node = dlg ? (
    <Dialog
      open
      onClose={() => settle(dlg.kind !== 'confirm')}
      mode={dlgMode()}
      icon={dlg.icon || (dlg.kind === 'confirm' ? 'alert-tri' : 'info')}
      title={dlg.title}
      sub={dlg.text}
      actions={dlg.kind === 'confirm' ? (
        <>
          <Btn variant="primary" data-autofocus="" onClick={() => settle(true)}>{dlg.okLabel || 'אישור'}</Btn>
          <Btn variant="quiet" onClick={() => settle(false)}>{dlg.cancelLabel || 'ביטול'}</Btn>
        </>
      ) : (
        <Btn variant="primary" data-autofocus="" onClick={() => settle(true)}>הבנתי</Btn>
      )}
    />
  ) : null;

  return { ask, tell, node };
}

/**
 * סרגל חיפוש: רגיל / חכם (AI). מציג בלבד — כל ה-state וה-handlers מגיעים מהעמוד.
 * onStats מקבל את אירוע הלחיצה (העמוד קובע מיקום לחלונית הסטטיסטיקה).
 */
export function SearchBar({
  aiInputMode, aiLoading, aiInputText, setAiInputText, searchInput, setSearchInput,
  onSubmit, onSubmitAi, onClear, onToggleAi, onStats, placeholder, placeholderAi, className,
}) {
  if (aiInputMode) {
    return (
      <form onSubmit={onSubmitAi} className={`v3-search ops-search ${className || ''}`}>
        {aiLoading ? <span className="v3-spin ops-search__spin" aria-hidden="true" /> : <Icon name="sparkles" />}
        <input
          type="text"
          aria-label={placeholderAi}
          value={aiInputText}
          onChange={(e) => setAiInputText(e.target.value)}
          placeholder={placeholderAi}
          disabled={aiLoading}
        />
        <div className="ops-search__acts">
          {aiInputText && !aiLoading && <TipBtn icon="x" label="ניקוי" variant="quiet" size="sm" onClick={() => setAiInputText('')} />}
          <TipBtn icon="sparkles" label="חזרה לחיפוש רגיל" variant="quiet" size="sm" className="ops-on" onClick={onToggleAi} />
          <TipBtn icon="activity" label="שאלות וסטטיסטיקה" variant="quiet" size="sm" onClick={onStats} />
          <Btn type="submit" variant="primary" size="sm" disabled={aiLoading}>{aiLoading ? 'חושב…' : 'חיפוש חכם'}</Btn>
        </div>
      </form>
    );
  }
  return (
    <form onSubmit={onSubmit} className={`v3-search ops-search ${className || ''}`}>
      <Icon name="search" />
      <input
        type="text"
        aria-label={placeholder}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={placeholder}
      />
      <div className="ops-search__acts">
        {searchInput && <TipBtn icon="x" label="ניקוי החיפוש" variant="quiet" size="sm" onClick={onClear} />}
        <TipBtn icon="sparkles" label="מעבר לחיפוש חכם" variant="quiet" size="sm" onClick={onToggleAi} />
        <TipBtn icon="activity" label="שאלות וסטטיסטיקה" variant="quiet" size="sm" onClick={onStats} />
        <Btn type="submit" variant="primary" size="sm">חיפוש</Btn>
      </div>
    </form>
  );
}
