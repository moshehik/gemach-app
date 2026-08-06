# System emails

Every email the app sends goes through the same external mechanism: a Google Apps Script
web app (`script.google.com/macros/s/AKfycby.../exec`) that receives a JSON POST and sends
the actual Gmail message. The script URL is configurable via the `email_link_a` /
`email_link_b` / `email_routing_strategy` `SystemSetting` rows (see `/admin` settings), with
the same hardcoded deployment ID duplicated as a fallback constant in every file below - if
that deployment is ever replaced, all of these need updating (or route them all through
`email_link_a`).

## Send sites

| Trigger | File | Subject | Attachment filename |
|---|---|---|---|
| Self-service "שכחתי סיסמה" | `app/api/auth/forgot-password/route.js` (via `lib/mailer.js`) | `איפוס סיסמה - מערכת הגמ"ח` | `הודעה.txt` |
| Manager resets an employee's password | `app/api/employees/[id]/reset-password/route.js` (via `lib/mailer.js`) | `איפוס סיסמה - מערכת הגמ"ח` | `הודעה.txt` |
| Manager "שלח מייל" modal (`SendEmailModal`, `ModernSendEmailModal`) | `app/api/send-email/route.js` | free text, admin-typed | user-attached file, or `הודעה.txt` |
| "מייל הזמנה" / "מייל השכרה" (`OrderPrintMenu`) | `app/api/orders/[id]/email/route.js` | `הזמנה #<id> - גמ"ח שמלות` | `` הזמנה <orderId>.pdf `` |
| Bug report submitted | `app/api/error-report/route.js` | `דיווח תקלה ממערכת הגמח - לטיפול AI` | `דוח שגיאה.txt` |
| Internal message with "שלח גם במייל" (per-recipient `receiveEmailAlerts`) | `app/api/notifications/route.js` | message title | `הודעה.txt` |

All attachment filenames are dummy placeholders (base64 `fileName`/`fileContent` the script's
API requires) except the order/rental PDF, which is the real attached document.

## Shared HTML template (`lib/emailTemplates.js`)

Every send site above now sends **both** a plain-text `body` (kept for `EmailLog` storage and
as a fallback) **and** a styled `htmlBody`, built from `lib/emailTemplates.js`:

- `renderPasswordResetEmailHtml(...)` - temporary-password emails.
- `renderGenericEmailHtml({ title, bodyText, gmachName, subtitle })` - free-text emails
  (manager "send email", internal message alerts). Escapes `bodyText` and converts line
  breaks to `<br>` - never pass pre-built HTML here unless you also update the function.
- `renderErrorReportEmailHtml(...)` - bug-report emails. Deliberately leaves out the
  `---AI_DATA_START---/---AI_DATA_END---` machine-readable block that the plain-text `body`
  still carries (see `app/api/error-report/route.js`) - that block isn't meant for human eyes.
- `escapeHtml` / `textToHtml` - shared escaping helpers, exported for reuse.

All three share one visual shell (`renderShell` internally): the same בס"ד header, gmach
name in Frank Ruhl Libre, and footer used across every system email. This mirrors the
older, more elaborate order/rental report design in
`app/api/orders/[id]/email/route.js` (which the owner picked and which was left as-is,
not routed through the shared shell, since its layout is a full invoice/table report, not a
simple message).

**To add a new system email:** call `renderGenericEmailHtml` (or add a new template
function to this file if the layout needs to be custom) and pass the result as `htmlBody` in
the Apps Script payload, alongside a `body` plain-text fallback. If you're already using
`lib/mailer.js`'s `sendSystemEmail`, pass it as the `html` option.

**Unverified:** the order-email flow (`action: "sendGemachOrderEmail"`) is confirmed to
render `htmlBody` correctly in the actual inbox. Whether the *default* Apps Script action
(used by every other send site, no `action` field) also honors `htmlBody` - rather than only
showing the plain-text `body` - has not been confirmed against a real inbox. Send yourself a
test password-reset or notification email to check; if it turns out the default action
ignores `htmlBody`, that's a one-line fix inside the Apps Script itself
(`GmailApp.sendEmail(to, subject, body, {htmlBody})`), not in this repo.

## Known gaps (pre-existing, not addressed here)

- `app/api/error-report/route.js` and `app/api/notifications/route.js` don't write to
  `EmailLog` on send/failure - unlike every other send site, these two flows are invisible in
  `app/management/email-logs`.
- `ModernSendEmailModal` (`components/customers/modern/ModernSendEmailModal.js`) never lets
  the user attach a file, so it always falls through to the dummy `הודעה.txt` placeholder.

## Behavior change in this pass

`app/api/notifications/route.js` previously always POSTed to the hardcoded fallback script
URL, ignoring `email_link_a` / `email_link_b` / `email_routing_strategy` (every other send
site already respected those settings). It now resolves the URL the same way the others do.
