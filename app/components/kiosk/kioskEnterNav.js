'use client';

// kioskEnterNav.js - ניווט באנטר בין שדות הטופס בעמדה (Enter = השדה הבא, גם על בחירה כן/לא; רווח משנה את הבחירה).
//
// נקודת חיבור: סוכן "customer-consent" בונה hook משותף לניווט באנטר (app/lib או app/components/shared). עד שהוא ייכנס,
// זה מימוש מינימלי מקומי עם אותו חוזה: useEnterNav(formRef). כשה-hook המשותף מוכן מחליפים רק את ה-import ב-KioskRegistration.js.
//
// החוזה: כל אלמנט ממוקד שמשתתף בשרשרת מסומן ב-data-enter="<שם שדה>". כמה אלמנטים עם אותו שם (שני כפתורי כן/לא) נחשבים שדה אחד:
// Enter מדלג לשדה הבא ברשימה (לפי סדר ה-DOM). על השדה האחרון Enter מעביר את הפוקוס ללחצן השליחה (data-enter-submit) ולא שולח.

import { useEffect } from 'react';

function focusable(el) {
  return !!el && !el.disabled && el.offsetParent !== null;
}

export function useEnterNav(formRef) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      const t = e.target;
      if (!t || !t.dataset || !t.dataset.enter) return; // לא אלמנט משתתף (למשל לחצן השליחה): Enter עובד כרגיל
      e.preventDefault();
      const all = Array.from(form.querySelectorAll('[data-enter]')).filter(focusable);
      const at = all.indexOf(t);
      const next = all.find((el, i) => i > at && el.dataset.enter !== t.dataset.enter);
      if (next) { next.focus(); return; }
      const submit = form.querySelector('[data-enter-submit]');
      if (focusable(submit)) submit.focus();
    };
    form.addEventListener('keydown', onKeyDown);
    return () => form.removeEventListener('keydown', onKeyDown);
  }, [formRef]);
}
