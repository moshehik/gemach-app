import prisma from '@/app/lib/prisma';

// Thin wrapper around the app's existing email mechanism (a Google Apps Script webhook,
// URL configurable via the `email_link_a` / `email_link_b` / `email_routing_strategy`
// SystemSetting rows - see app/api/send-email/route.js and app/api/error-report/route.js,
// which this mirrors). Centralized here so the password-reset flows don't duplicate the
// script-URL lookup / payload shape a third time.
const FALLBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBDsY2mF7h9PyGCw-ZpuaVK4XbtybOcd5t1Ka9TAU-cNFmKPsZYwxeNTxL3juZC-GvQA/exec';

async function resolveScriptUrl() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['email_link_a', 'email_link_b', 'email_routing_strategy'] } }
  });
  const linkA = settings.find(s => s.key === 'email_link_a')?.value;
  const linkB = settings.find(s => s.key === 'email_link_b')?.value;
  const strategy = settings.find(s => s.key === 'email_routing_strategy')?.value || 'all_a';

  if (strategy === 'all_b' && linkB) return linkB;
  if (linkA) return linkA;
  return FALLBACK_SCRIPT_URL;
}

/**
 * Sends a plain-text/HTML email through the gemach's existing Google Apps Script mailer,
 * and records the attempt in EmailLog (same as the other senders in the app).
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} [opts.subject]
 * @param {string} [opts.body] plain text body (also stored as-is in EmailLog)
 * @param {string} [opts.html] optional styled HTML body; when set, sent as `htmlBody`
 *   alongside `body` (same field the working order-email flow in
 *   app/api/orders/[id]/email/route.js already sends) so the script can render it if it
 *   supports htmlBody, with `body` as a plain-text fallback either way.
 * @param {string} [opts.employeeId] for EmailLog attribution
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function sendSystemEmail({ to, subject, body, html, employeeId } = {}) {
  if (!to) {
    return { success: false, message: 'לא סופקה כתובת מייל' };
  }

  let isSuccess = false;
  let errorMessage = null;

  try {
    const scriptUrl = await resolveScriptUrl();
    const payload = {
      to,
      cc: '',
      subject: subject || 'הודעה ממערכת הגמ"ח',
      body: body || '',
      ...(html ? { htmlBody: html } : {}),
      fileName: 'הודעה.txt',
      fileContent: Buffer.from('נשלח ממערכת הגמ"ח').toString('base64')
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { status: 'error', message: responseText };
    }

    isSuccess = result.status === 'success';
    if (!isSuccess) errorMessage = result.message || 'Unknown error';
  } catch (e) {
    console.error('sendSystemEmail failed:', e);
    errorMessage = e.message || 'שגיאת רשת בשליחת המייל';
  }

  try {
    await prisma.emailLog.create({
      data: {
        to,
        subject: subject || null,
        body: body || null,
        status: isSuccess ? 'success' : 'error',
        errorMessage: isSuccess ? null : errorMessage,
        employeeId: employeeId || null,
        sentAt: new Date()
      }
    });
  } catch (e) {
    console.error('Failed to write EmailLog for password email:', e);
  }

  return isSuccess ? { success: true } : { success: false, message: errorMessage };
}
