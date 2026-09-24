'use client';
// app/v3/motion/useReducedMotion.js — CONSTITUTION §ה.3.
// true כש-prefers-reduced-motion:reduce **או** data-motion="reduced" על html
// (מתג משתמש עתידי, שקול למדיניות המערכת - §ה.3 "מתג משתמש שקול לנ״ל").
import { useEffect, useState } from 'react';

function readReduced() {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const attr = document.documentElement.dataset.motion === 'reduced';
  return Boolean(media || attr);
}

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(readReduced);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(readReduced());
    mql.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { mql.removeEventListener('change', update); observer.disconnect(); };
  }, []);
  return reduced;
}
