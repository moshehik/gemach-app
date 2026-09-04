// Shared HTML email templates. Visual language (fonts, header, colors) mirrors the order
// email in app/api/orders/[id]/email/route.js so all system emails look like they come from
// the same place. Colors are hardcoded (no CSS custom properties) since this HTML is sent
// through the Apps Script mailer / rendered in email clients, outside the app's CSS context.

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// User-typed free text (message bodies, bug descriptions) isn't HTML - escape it and turn
// line breaks into <br> so it renders as the plain text the sender actually typed.
export function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

const SHARED_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@500;700;900&display=swap');

  body { font-family: 'David Libre', 'Times New Roman', Georgia, serif; background-color: #f6f6f4; margin: 0; padding: 24px 10px; direction: rtl; color: #444; }
  .email-box { width: 100%; max-width: 480px; margin: 0 auto; background: #fff; padding: 32px; box-sizing: border-box; border: 1px solid #eaeaea; border-radius: 6px; }

  .bsd { text-align: right; font-size: 13px; font-weight: 600; color: #999; margin-bottom: 6px; letter-spacing: 0.5px; }
  .email-header { text-align: center; border-bottom: 1px solid #eaeaea; padding-bottom: 20px; margin-bottom: 28px; }
  .email-header h1 { margin: 0; font-family: 'Frank Ruhl Libre', 'David Libre', serif; font-size: 26px; color: #262626; font-weight: 700; letter-spacing: 0.5px; }
  .email-header .subtitle { margin-top: 6px; font-size: 13px; color: #999; }

  .greeting { font-size: 16px; color: #333; margin-bottom: 4px; }
  .explanation { font-size: 15px; color: #666; margin-bottom: 28px; line-height: 1.7; }

  .password-label { text-align: center; font-size: 13px; color: #999; margin-bottom: 8px; }
  .password-box { text-align: center; background: #f4f4f4; border: 1px dashed #ccc; border-radius: 6px; padding: 18px 10px; margin-bottom: 28px; }
  .password-value { direction: ltr; font-family: 'Courier New', monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #262626; }

  .instructions { font-size: 14.5px; color: #555; line-height: 1.8; margin-bottom: 24px; }
  .body-text { font-size: 14.5px; color: #444; line-height: 1.8; margin-bottom: 24px; white-space: normal; }

  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13.5px; }
  .meta-table td { padding: 6px 0; border-bottom: 1px solid #f2f2f2; vertical-align: top; }
  .meta-table td.meta-label { color: #999; width: 110px; white-space: nowrap; }
  .meta-table td.meta-value { color: #333; }

  .warning { font-size: 13px; color: #856404; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 12px 14px; line-height: 1.7; margin-bottom: 8px; }
  .info-box { font-size: 13px; color: #555; background: #f4f4f4; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; line-height: 1.7; margin-bottom: 8px; }

  .email-footer { margin-top: 28px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 14px; }

  .files-table { width: 100%; border-collapse: collapse; margin: 0 0 24px 0; font-size: 13.5px; border: 1px solid #e5e5e5; }
  .files-table th, .files-table td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #eee; }
  .files-table th { background-color: #f4f4f4; color: #333; font-weight: 700; }
  .files-table tbody tr:nth-child(even) { background-color: #fbfbfb; }
  .files-table tbody tr:last-child td { border-bottom: none; }
  .files-section-title { font-size: 15px; font-weight: 700; color: #333; margin: 0 0 10px 0; }
  .dest-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .dest-email { background: #e3f2fd; color: #1565c0; }
  .dest-drive { background: #e8f5e9; color: #2e7d32; }
  .dest-both { background: #f3e5f5; color: #6a1b9a; }
  .dl-link { color: #1565c0; font-weight: 700; }
`;

// Common shell (בס"ד header + gmach name + footer) every system email is built on, so a
// change to the branding only has to happen in one place.
function renderShell({ gmachName, subtitle, bodyHtml, footerNote }) {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="utf-8">
      <style>${SHARED_STYLE}</style>
    </head>
    <body>
      <div class="email-box">
        <div class="bsd">בס"ד</div>
        <div class="email-header">
          <h1>${escapeHtml(gmachName)}</h1>
          ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>

        ${bodyHtml}

        <div class="email-footer">
          ${footerNote || `הודעה אוטומטית ממערכת ${escapeHtml(gmachName)}`}
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * @param {object} opts
 * @param {string} [opts.firstName]
 * @param {string} opts.tempPassword
 * @param {boolean} [opts.triggeredByManager] true when a manager reset it, false for self-service "forgot password"
 * @param {string} [opts.gmachName]
 * @param {string} [opts.gmachPhone]
 * @returns {string} full HTML document
 */
export function renderPasswordResetEmailHtml({
  firstName,
  tempPassword,
  triggeredByManager = false,
  gmachName = 'גמ"ח שמלות',
  gmachPhone = ''
}) {
  const explanation = triggeredByManager
    ? 'סיסמתך למערכת אופסה על ידי מנהל.'
    : 'התקבלה בקשה לאיפוס הסיסמה שלך למערכת.';

  const bodyHtml = `
    <div class="greeting">שלום ${escapeHtml(firstName || '')},</div>
    <div class="explanation">${explanation}<br>להלן סיסמה זמנית לחיבור למערכת:</div>

    <div class="password-label">סיסמה זמנית</div>
    <div class="password-box">
      <span class="password-value">${escapeHtml(tempPassword)}</span>
    </div>

    <div class="instructions">
      יש להתחבר למערכת עם הסיסמה הזמנית, ובהתחברות הראשונה תתבקש/י להגדיר סיסמה חדשה משלך.
    </div>

    <div class="warning">
      אם לא ביקשת איפוס סיסמה, ניתן להתעלם מהודעה זו${gmachPhone ? ` או לפנות אלינו בטלפון ${gmachPhone}` : ' ולפנות למנהל המערכת'}.
    </div>
  `;

  return renderShell({ gmachName, bodyHtml });
}

/**
 * General-purpose styled email - free-text subject/body wrapped in the same shell, used by
 * the manager "send email" flow (app/api/send-email/route.js) and internal message alerts
 * (app/api/notifications/route.js).
 *
 * @param {object} opts
 * @param {string} [opts.title] shown as a heading above the message; falls back to no heading
 * @param {string} opts.bodyText plain text (not HTML) - escaped and line-broken automatically
 * @param {string} [opts.gmachName]
 * @param {string} [opts.subtitle] small line under the gmach name (e.g. "הודעה חדשה")
 * @returns {string} full HTML document
 */
export function renderGenericEmailHtml({
  title,
  bodyText,
  gmachName = 'גמ"ח שמלות',
  subtitle = ''
}) {
  const bodyHtml = `
    ${title ? `<div class="greeting">${escapeHtml(title)}</div>` : ''}
    <div class="body-text">${textToHtml(bodyText || '')}</div>
  `;

  return renderShell({ gmachName, subtitle, bodyHtml });
}

/**
 * Internal bug-report notification email (app/api/error-report/route.js). The machine-
 * readable ---AI_DATA_START---/---AI_DATA_END--- block that route also emails as plain text
 * is intentionally left OUT of this HTML version - it's not meant for human eyes, so it's
 * kept only in the plain-text `body` field the route sends alongside this.
 *
 * @param {object} opts
 * @param {string} opts.employeeName
 * @param {string} [opts.time]
 * @param {string} [opts.title] page/window title where the error was reported
 * @param {string} [opts.url]
 * @param {string} [opts.userText] the reporter's description
 * @param {string[]} [opts.lastButtons]
 * @param {string} [opts.gmachName]
 * @returns {string} full HTML document
 */
export function renderErrorReportEmailHtml({
  employeeName,
  time,
  title,
  url,
  userText,
  lastButtons = [],
  gmachName = 'גמ"ח שמלות'
}) {
  const metaRow = (label, value) => value
    ? `<tr><td class="meta-label">${escapeHtml(label)}</td><td class="meta-value">${escapeHtml(value)}</td></tr>`
    : '';

  const buttonsHtml = lastButtons && lastButtons.length > 0
    ? lastButtons.map((b, i) => `${i + 1}. ${escapeHtml(b)}`).join('<br>')
    : 'אין פעולות מתועדות';

  const bodyHtml = `
    <div class="greeting">דיווח תקלה חדש</div>
    <table class="meta-table">
      ${metaRow('מדווח/ת:', employeeName)}
      ${metaRow('זמן:', time)}
      ${metaRow('חלון/דף:', title)}
      ${metaRow('כתובת:', url)}
    </table>

    <div class="info-box"><strong>5 הפעולות האחרונות:</strong><br>${buttonsHtml}</div>

    <div class="body-text"><strong>תיאור מהמשתמש:</strong><br>${textToHtml(userText || '')}</div>
  `;

  return renderShell({ gmachName, subtitle: 'דיווח תקלה - לטיפול AI', bodyHtml });
}

// ---------------------------------------------------------------------------
// קבצים מצורפים למייל / לדרייב + טבלת הוראות מסודרת (נשלח דרך ה-GAS)
// ---------------------------------------------------------------------------

/**
 * עיצוב גודל קובץ לתצוגה אנושית (KB/MB).
 */
export function formatFileSizeHebrew(bytes) {
  const n = Number(bytes);
  if (!n || isNaN(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const DEST_LABEL = {
  email: 'מצורף למייל',
  drive: 'נשמר בדרייב',
  both: 'מייל + דרייב'
};

const DEST_CLASS = {
  email: 'dest-email',
  drive: 'dest-drive',
  both: 'dest-both'
};

/**
 * טבלת הוראות מסודרת לרשימת קבצים - מוטמעת בגוף המייל (htmlBody) ומסבירה
 * לנמען לכל קובץ: לאן נשלח (מייל/דרייב/גם וגם), מה גודלו, ואיך מורידים אותו
 * (צרופה ישירה במייל או קישור הורדה מהדרייב עם הרשאת הורדה מלאה).
 *
 * @param {Array<{fileName:string,sizeBytes?:number,dest?:'email'|'drive'|'both',driveUrl?:string}>} files
 * @param {object} [opts]
 * @param {boolean} [opts.includeTitle=true]
 * @returns {string} HTML snippet (לא מסמך מלא) - לשלב בתוך bodyHtml לפני renderShell
 */
export function renderAttachmentsGuideTable(files, opts = {}) {
  const list = Array.isArray(files) ? files.filter(f => f && f.fileName) : [];
  if (list.length === 0) return '';
  const includeTitle = opts.includeTitle !== false;

  const rows = list.map((f, i) => {
    const dest = f.dest && DEST_LABEL[f.dest] ? f.dest : 'email';
    const howTo = dest === 'email'
      ? 'פתחו את הצרופה בתחתית המייל ולחצו הורדה.'
      : dest === 'drive'
        ? (f.driveUrl
          ? `לחצו <a class="dl-link" href="${escapeHtml(f.driveUrl)}">קישור להורדה</a> - הקישור פתוח עם הרשאת הורדה מלאה, אין צורך בבקשת גישה.`
          : 'קישור ההורדה מהדרייב יישלח בנפרד - הקובץ שותף עם הרשאת הורדה מלאה לכתובת זו.')
        : (f.driveUrl
          ? `מצורף למייל + <a class="dl-link" href="${escapeHtml(f.driveUrl)}">גיבוי בדרייב להורדה</a> (הרשאה מלאה).`
          : 'מצורף למייל, ועותק נשמר בדרייב עם הרשאת הורדה מלאה.');
    return `
      <tr>
        <td style="text-align:center;color:#999;">${i + 1}</td>
        <td style="font-weight:600;color:#333;">${escapeHtml(f.fileName)}</td>
        <td style="white-space:nowrap;">${formatFileSizeHebrew(f.sizeBytes)}</td>
        <td style="white-space:nowrap;"><span class="dest-badge ${DEST_CLASS[dest]}">${DEST_LABEL[dest]}</span></td>
        <td style="font-size:12.5px;color:#555;line-height:1.7;">${howTo}</td>
      </tr>`;
  }).join('');

  return `
    ${includeTitle ? `<div class="files-section-title">קבצים מצורפים - הוראות הורדה</div>` : ''}
    <table class="files-table">
      <thead>
        <tr>
          <th style="width:34px;text-align:center;">#</th>
          <th>שם הקובץ</th>
          <th>גודל</th>
          <th>יעד</th>
          <th>איך מורידים?</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="info-box">הקבצים בדרייב שותפו ישירות לכתובת המייל שלכם עם הרשאת צפייה והורדה מלאה, ובנוסף הקישור פתוח לכל מי שמחזיק בו - אם מופיעה בקשת גישה, ודאו שאתם מחוברים עם אותה כתובת מייל אליה נשלח המכתב.</div>
  `;
}

/**
 * גרסת טקסט-פשוט של טבלת ההוראות (לשדה body שנשמר ב-EmailLog ונשלח כגיבוי).
 */
export function renderAttachmentsGuideText(files) {
  const list = Array.isArray(files) ? files.filter(f => f && f.fileName) : [];
  if (list.length === 0) return '';
  const lines = list.map((f, i) => {
    const dest = f.dest && DEST_LABEL[f.dest] ? DEST_LABEL[f.dest] : DEST_LABEL.email;
    const extra = f.driveUrl ? ` - הורדה: ${f.driveUrl}` : '';
    return `${i + 1}. ${f.fileName} (${formatFileSizeHebrew(f.sizeBytes)}, ${dest})${extra}`;
  });
  return `\n\nקבצים מצורפים - הוראות הורדה:\n${lines.join('\n')}\nקבצי דרייב שותפו עם הרשאת הורדה מלאה לכתובת זו.`;
}
