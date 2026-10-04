'use client';

import '@/design-system/components.css';
import '@/app/components/login/login.css';
import './gate.css';
import { useState } from 'react';
import Link from 'next/link';
import { useA5Shell } from '../menu/A5ShellContext';
import { MenuSprite } from '../menu/menuParts';
import { I } from '../login/loginParts';
import LoginGate from '../login/LoginGate';

// חלון "אין הרשאה" בעיצוב החדש - אחיד עם חלונות דף הכניסה החדש (החלון הכהה .dlg.dk של login.css, L03-L05/L15:
// תג עגול, כותרת, שורת הסבר, לחצן זהב ראשי ולחצן משני). החלטות הבעלים 4.10.2026: BRD-E19 "לעצב את השער מחדש לפי
// הפלטה החדשה", BRD-UNV-4 "עיצוב חדש לחלון ... אמור להיות עיצוב אחיד". השער עצמו (מי רשאי) לא השתנה - PageGate.
// עובדת מחוברת בלי הרשאה: "חזרה לדף הבית". אורח (לא מחובר): "כניסה למערכת" (חלון הכניסה, LoginGate) + "חזרה לדף הבית".
// הטקסטים של עובדת מחוברת = הטקסטים של NoAccessMessage הקיים.
export default function NoAccessCard({ guest = false, page = '' }) {
  const inA5Shell = useA5Shell();
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <div className="gm-ds gm-login gm-gate home-bg" dir="rtl">
      {inA5Shell ? null : <MenuSprite />}
      <main className="gt-stage">
        <section className="dlg dk gt-card" role="alert" aria-labelledby="gt-t">
          <div className="dbadge"><I n="lock" /></div>
          <h2 id="gt-t">{guest ? 'יש להתחבר למערכת' : 'אין הרשאת גישה'}</h2>
          <p className="sub">
            {guest
              ? `כדי לצפות ב${page || 'עמוד הזה'} יש להתחבר למערכת עם המשתמש שלך.`
              : 'אין לך הרשאה לצפות בעמוד זה. העמוד המבוקש מוגבל להרשאות מסוימות בלבד. אם לדעתך זו טעות, פנה/י למנהל המערכת.'}
          </p>
          <div className="dbtns">
            {guest ? (
              <button type="button" className="gbtn" onClick={() => setLoginOpen(true)}><I n="user" />כניסה למערכת</button>
            ) : null}
            <Link href="/" className={guest ? 'ghost' : 'gbtn'}><I n="home" />חזרה לדף הבית</Link>
          </div>
        </section>
      </main>
      {loginOpen ? <LoginGate isModal onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
}
