'use client';

import { useRef, useCallback } from 'react';
import { sanitizeValue, MAX_STEPS } from '../../lib/actionRecorderCore';

// מקליט פעולות ("מאקרו", כמו הקלטת מאקרו ב-Word): רושם לחיצות, הקלדות, בחירות ברשימות,
// מקשי Enter/Tab/Escape וניווט בין דפים, כרשימת צעדים בטקסט. המשתמש רואה את זה כחלק מ"הסרטת
// מסך" — כאן אין שום ממשק. לא מעלה כלום בעצמו; מחזיר מערך צעדים ל-formatActionSteps
// (lib/actionRecorderCore.js). ערכי שדות רגישים (סיסמה/אשראי/ת"ז) מוחלפים בהסתרה כבר כאן,
// לפני שהם בכלל נכנסים לזיכרון.

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], label, summary';

function clean(s, max = 40) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function labelFor(el) {
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l) return clean(l.textContent);
  }
  const wrap = el.closest('label');
  if (wrap) return clean(wrap.textContent);
  return '';
}

function metaOf(el) {
  return {
    type: el.type,
    name: el.name,
    id: el.id,
    autocomplete: el.getAttribute('autocomplete'),
    label: labelFor(el),
    placeholder: el.getAttribute('placeholder'),
    elementName: el.getAttribute('data-element-name'),
    ariaLabel: el.getAttribute('aria-label'),
  };
}

// תיאור אנושי של אלמנט: תווית/טקסט/placeholder — ובסוגריים סוג האלמנט
function describe(el) {
  const tag = el.tagName.toLowerCase();
  const kind =
    tag === 'a' ? 'קישור' :
    tag === 'button' || el.getAttribute('role') === 'button' ? 'כפתור' :
    tag === 'select' ? 'רשימה' :
    tag === 'textarea' ? 'שדה טקסט' :
    tag === 'input' ? (el.type === 'checkbox' ? 'תיבת סימון' : el.type === 'radio' ? 'כפתור בחירה' : 'שדה') :
    el.getAttribute('role') === 'tab' ? 'לשונית' : 'אלמנט';
  const text =
    clean(el.getAttribute('aria-label')) ||
    labelFor(el) ||
    clean(el.getAttribute('placeholder')) ||
    clean(el.getAttribute('title')) ||
    (tag === 'input' || tag === 'select' || tag === 'textarea' ? '' : clean(el.innerText || el.textContent)) ||
    clean(el.getAttribute('data-element-name')) ||
    clean(el.name) || clean(el.id);
  return text ? `${kind} "${text}"` : kind;
}

export default function useActionRecorder() {
  const stepsRef = useRef([]);
  const startRef = useRef(0);
  const cleanupRef = useRef(null);

  const start = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    stepsRef.current = [];
    startRef.current = Date.now();
    let lastHref = window.location.pathname + window.location.search;
    const now = () => (Date.now() - startRef.current) / 1000;
    const page = () => window.location.pathname;
    const push = (step) => {
      if (stepsRef.current.length < MAX_STEPS) stepsRef.current.push({ t: now(), page: page(), ...step });
    };

    // הקלדה נרשמת פעם אחת לשדה (ערך סופי) — לא תו-תו
    const pendingTyping = new Map(); // element -> timeout id
    const flushTyping = (el) => {
      const id = pendingTyping.get(el);
      if (id === undefined) return;
      clearTimeout(id);
      pendingTyping.delete(el);
      push({ type: 'type', target: describe(el), value: sanitizeValue(metaOf(el), el.value) });
    };

    const onClick = (e) => {
      // כפתורי הממשק של ההקלטה עצמה (סרגל "סיום") לא נרשמים
      if (e.target?.closest?.('[data-no-record]')) return;
      const el = e.target?.closest?.(INTERACTIVE);
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      // לחיצה על שדה טקסט רגיל לא מעניינת — ההקלדה עצמה תירשם
      if ((tag === 'input' && !['checkbox', 'radio', 'button', 'submit'].includes(el.type)) || tag === 'textarea' || tag === 'select') return;
      // לחיצה על label שעוטף/מפנה לשדה — נרשמת דרך השדה עצמו
      if (tag === 'label') return;
      push({ type: 'click', target: describe(el) });
    };
    const onInput = (e) => {
      const el = e.target;
      const tag = el?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') return;
      if (['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type)) return;
      const prev = pendingTyping.get(el);
      if (prev !== undefined) clearTimeout(prev);
      pendingTyping.set(el, setTimeout(() => flushTyping(el), 900));
    };
    const onChange = (e) => {
      const el = e.target;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'select') {
        push({ type: 'select', target: describe(el), value: sanitizeValue(metaOf(el), el.selectedOptions?.[0]?.textContent || el.value) });
      } else if (tag === 'input' && ['checkbox', 'radio'].includes(el.type)) {
        push({ type: 'click', target: `${describe(el)} (${el.checked ? 'סומן' : 'הוסר סימון'})` });
      }
    };
    const onKeyDown = (e) => {
      if (!['Enter', 'Tab', 'Escape'].includes(e.key)) return;
      const el = e.target;
      if (el && el !== document.body && pendingTyping.has(el)) flushTyping(el);
      push({ type: 'key', key: e.key, target: el && el !== document.body ? describe(el) : '' });
    };

    const poll = setInterval(() => {
      const href = window.location.pathname + window.location.search;
      if (href !== lastHref) {
        lastHref = href;
        push({ type: 'navigate' });
      }
    }, 500);

    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('keydown', onKeyDown, true);

    cleanupRef.current = () => {
      for (const el of Array.from(pendingTyping.keys())) flushTyping(el);
      clearInterval(poll);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('keydown', onKeyDown, true);
      cleanupRef.current = null;
    };
  }, []);

  // עוצר ומחזיר את הצעדים שנרשמו
  const stop = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    const steps = stepsRef.current;
    stepsRef.current = [];
    return steps;
  }, []);

  const getCount = useCallback(() => stepsRef.current.length, []);

  return { start, stop, getCount };
}
