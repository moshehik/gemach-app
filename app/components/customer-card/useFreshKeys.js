'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// מפתחות שהופיעו עכשיו (שורה חדשה ברשימת השינויים, סמן לשונית חדש) - לקבלת מחלקת הנפשת הכניסה (enter / fresh) כמו בעיצוב.
// מחושב באפקט פריסה (לפני הצביעה) ולא בזמן הרינדור, ומתנקה ב-onAnimationEnd דרך clear(key). initialFresh: גם מה שקיים ברינדור הראשון.
export default function useFreshKeys(keys, { initialFresh = false } = {}) {
  const known = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());
  const sig = keys.join('\u0001');
  useLayoutEffect(() => {
    const list = sig ? sig.split('\u0001') : [];
    const prev = known.current;
    const added = prev ? list.filter((k) => !prev.has(k)) : (initialFresh ? list : []);
    known.current = new Set(list);
    if (added.length) setFresh((f) => new Set([...f, ...added]));
  }, [sig, initialFresh]);
  const clear = useCallback((k) => setFresh((f) => { if (!f.has(k)) return f; const n = new Set(f); n.delete(k); return n; }), []);
  return [fresh, clear];
}
