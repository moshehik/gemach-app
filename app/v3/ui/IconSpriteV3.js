// v3 — שברי ספרייט להשלמת app/components/IconSprite.js (אותו סגנון: 24px, קו currentColor).
// עובי הקו/הקצוות מגיעים מה-<svg class="v3-ic"> (1.8, round). מרנדרים פעם אחת ב-layout,
// לצד <IconSprite/> הקיים. אין כאן כפילות של סמל קיים (i-unlock היה חסר בספרייט המקורי).
export default function IconSpriteV3() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-send" viewBox="0 0 24 24"><path d="M21 3 10.5 13.5" /><path d="m21 3-6.5 18-4-7.5L3 9.5 21 3Z" /></symbol>
        <symbol id="i-sparkles" viewBox="0 0 24 24"><path d="m11 4 1.9 5.1L18 11l-5.1 1.9L11 18l-1.9-5.1L4 11l5.1-1.9L11 4Z" /><path d="M18.5 3.5v3M17 5h3" /><path d="M18.5 16.5v3M17 18h3" /></symbol>
        <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 4v16h16" /><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6" /></symbol>
        <symbol id="i-loader" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" /></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></symbol>
        <symbol id="i-wifi-off" viewBox="0 0 24 24"><path d="m3 3 18 18" /><path d="M2 8.8a15 15 0 0 1 5-3M10.5 5.2A15 15 0 0 1 22 8.8" /><path d="M5 12.9a10 10 0 0 1 3.5-2.2M15.5 10.9a10 10 0 0 1 3.5 2" /><path d="M8.5 16.4a5 5 0 0 1 7 0" /><path d="M12 20h.01" /></symbol>
        <symbol id="i-shirt" viewBox="0 0 24 24"><path d="M8 4 3 7l2 4 3-1.5V20h8V9.5l3 1.5 2-4-5-3a4 4 0 0 1-8 0Z" /></symbol>
        <symbol id="i-ruler" viewBox="0 0 24 24"><g transform="rotate(-45 12 12)"><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M7 8v2.5M10.5 8v3.5M14 8v2.5M17.5 8v3.5" /></g></symbol>
        <symbol id="i-unlock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 7.8-1.3" /></symbol>
        <symbol id="i-server" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="14" width="16" height="6" rx="1.5" /><path d="M8 7h.01M8 17h.01" /></symbol>
        <symbol id="i-flask" viewBox="0 0 24 24"><path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.3 1.3 0 0 0 1.1 2h11.8a1.3 1.3 0 0 0 1.1-2l-5.5-9.5v-6" /><path d="M7.5 15h9" /></symbol>
        {/* חסרים לפי diagnosis-2026-09-24/02 §1.3 O14 (מנוע השינויים - רייל הזמנה) - undo/redo תלויי-כיוון
            (מתהפכים ב-RTL דרך --v3-dir כמו שאר אייקוני הכיוון, ראו icons.css/aliases.js) */}
        <symbol id="i-undo" viewBox="0 0 24 24"><path d="M8 7 4 11l4 4" /><path d="M4 11h10a6 6 0 0 1 0 12h-3" /></symbol>
        <symbol id="i-redo" viewBox="0 0 24 24"><path d="M16 7l4 4-4 4" /><path d="M20 11H10a6 6 0 0 0 0 12h3" /></symbol>
        <symbol id="i-cart" viewBox="0 0 24 24"><circle cx="9.5" cy="20" r="1.4" /><circle cx="17.5" cy="20" r="1.4" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6.2" /></symbol>
      </defs>
    </svg>
  );
}
