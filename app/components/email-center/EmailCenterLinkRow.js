'use client';

// שורת קישור בהגדרות מערכת (סעיף "מיילים אוטומטיים ללקוחות") אל מרכז המיילים - אותן הגדרות, עם עריכת הניסוח והתזמון.
import Link from 'next/link';
import { Ic } from '../settings-sim/SettingsDialogs';

export default function EmailCenterLinkRow() {
  return (
    <div className="li st-row st-ctlrow">
      <div className="ic-b"><Ic id="mail" /></div>
      <div className="t">
        <b className="st-lb">מרכז המיילים</b>
        <small>עריכת הנושא והניסוח של כל מייל, תזמון לפני/אחרי אירוע, נתונים קבועים ודיוורים.</small>
      </div>
      <div className="st-ctl">
        <Link className="btn ghost sm" href="/admin/email-center" data-guide-id="set.emailcenter-link" aria-label="פתיחת מרכז המיילים (עמוד נפרד)" data-element-name="כפתור_settings_email_center">
          <Ic id="ext" />פתיחה
        </Link>
      </div>
    </div>
  );
}
