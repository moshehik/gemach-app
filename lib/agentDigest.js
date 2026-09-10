import prisma from '@/app/lib/prisma';
import { getCachedSettingValue } from '@/lib/settingsCache';
import { sendSystemEmail } from '@/lib/mailer';
import { renderGenericEmailHtml } from '@/lib/emailTemplates';
import { isReligiousBlackoutNow } from '@/lib/hebrewDate';

/**
 * עדכון תקופתי במייל על ענפי-תיקון (PR) שהסוכן האוטומטי (.claude/commands/fix-reports.md)
 * פתח וממתינים לאישור מיזוג ידני - ר' app/api/cron/agent-digest/route.js (ה-endpoint
 * שקורא לפונקציה הזו, מופעל ע"י שני crons קבועים ב-vercel.json) ו-CLAUDE.md סעיף
 * "Agent PR-approval digest email".
 *
 * נשלח פעם אחת בלבד (לא לכל גמח בנפרד) כי מדובר בריפו GitHub אחד משותף לשני הגמחים -
 * PR-ים לא שייכים מבנית לגמח ספציפי, אז אין צורך/טעם לפצל. ה-SystemSetting שקובעת
 * הפעלה/שעות קיימת בכוונה רק ב-DB של הגמח הראשי (ר' scratch/seed_agent_digest_settings.js) -
 * אל תפעילו את אותה הגדרה גם בנווה יעקב, זה ישלח מייל כפול לאותה רשימת PR-ים.
 */

const AGENT_BRANCH_PREFIX = 'fix-reports/';
// שני "משבצות" השליחה הנתמכות היום, כל אחת מחוברת ל-cron קבוע נפרד ב-vercel.json
// (ר' שם למה השעה בפועל יכולה לזוז עד חצי שעה בגלל שעון קיץ/חורף). הוספת משבצת
// שלישית דורשת גם cron חדש בקוד, לא רק שינוי בהגדרה.
const SLOT_LABELS = { evening: '17:00', midnight: '00:00' };

async function fetchOpenAgentPRs() {
  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GH_DISPATCH_REPO;
  if (!token || !repo) {
    return { error: 'GH_DISPATCH_TOKEN/GH_DISPATCH_REPO לא מוגדרים בסביבה' };
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    return { error: `GitHub API החזיר ${res.status}` };
  }
  const all = await res.json();
  const agentPRs = (Array.isArray(all) ? all : []).filter(pr => (pr.head?.ref || '').startsWith(AGENT_BRANCH_PREFIX));
  return { prs: agentPRs };
}

function formatPrBlock(pr) {
  const created = new Date(pr.created_at).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const bodyExcerpt = (pr.body || '').trim().replace(/\r?\n+/g, ' ').slice(0, 220);
  const truncated = (pr.body || '').length > 220 ? '...' : '';
  return [
    `#${pr.number} - ${pr.title}`,
    `ענף: ${pr.head.ref}`,
    `נפתח: ${created}`,
    bodyExcerpt ? `תקציר: ${bodyExcerpt}${truncated}` : null,
    `קישור: ${pr.html_url}`,
  ].filter(Boolean).join('\n');
}

/**
 * @param {{ slot: 'evening'|'midnight' }} opts
 * @returns {Promise<object>} תמיד מחזיר אובייקט עם הסבר, לא זורק - ה-route קורא לזה
 * וכותב ל-JSON תגובה, אין צד שמצפה ל-exception.
 */
export async function runAgentDigest({ slot } = {}) {
  const enabled = await getCachedSettingValue('agent_digest_email_enabled', 'false');
  if (enabled !== 'true') return { skipped: 'disabled' };

  const slotLabel = SLOT_LABELS[slot];
  if (!slotLabel) return { skipped: 'unknown-slot', slot };

  const hoursRaw = await getCachedSettingValue('agent_digest_email_hours', '17:00,00:00');
  const activeHours = hoursRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (!activeHours.includes(slotLabel)) return { skipped: 'slot-disabled', slot, slotLabel };

  if (isReligiousBlackoutNow()) return { skipped: 'shabbat-or-chag' };

  const { prs, error } = await fetchOpenAgentPRs();
  if (error) return { skipped: 'github-error', error };
  if (!prs || prs.length === 0) return { skipped: 'no-open-prs' };

  const recipients = await prisma.employee.findMany({
    where: { roleId: 2, isActive: true, email: { not: null } },
    select: { email: true, firstName: true },
  });
  if (recipients.length === 0) return { skipped: 'no-recipient' };

  const bodyText = `יש ${prs.length} שינויי קוד שהסוכן האוטומטי הכין (מ-2 הגמחים, בין אם הדיווח המקורי הגיע מהגמח הראשי או מנווה יעקב) וממתינים לאישור שלך למיזוג:\n\n${prs.map(formatPrBlock).join('\n\n')}\n\nלמיזוג בפועל - היכנסו ל-PR הרלוונטי ב-GitHub ולחצו Merge. הריפו משותף לשני הגמחים, אז מיזוג PR אחד מעלה את התיקון לשניהם יחד (Vercel פורס אוטומטית מ-main).`;

  const html = renderGenericEmailHtml({
    title: `${prs.length} שינויי קוד ממתינים לאישור שלך`,
    bodyText,
    subtitle: 'עדכון ענפי תיקון אוטומטי',
  });

  const results = [];
  for (const emp of recipients) {
    const r = await sendSystemEmail({
      to: emp.email,
      subject: `${prs.length} שינויים ממתינים לאישור מיזוג - מערכת הגמ"ח`,
      body: bodyText,
      html,
    });
    results.push({ to: emp.email, success: r.success, message: r.message });
  }
  return { sent: true, slot: slotLabel, count: prs.length, results };
}
