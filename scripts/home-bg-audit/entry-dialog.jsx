// נקודת כניסה לבדיקת test_dialog_focus.mjs: GuideDialog האמיתי בתוך הורה שמצייר מחדש עם onClose חדש בכל ציור (כמו HomeA5).
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GuideDialog } from '../../app/components/search/ShortcutsUi.js';
import { guideRows } from '@/lib/quickShortcuts';

function Parent() {
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(true);
  window.__bump = () => setN((x) => x + 1);
  window.__closed = () => !open;
  return <div data-n={n}>{open && <GuideDialog rows={guideRows({ mineUsable: true })} onTry={() => {}} onClose={() => setOpen(false)} skin="home" />}</div>;
}
createRoot(document.getElementById('root')).render(<Parent />);
