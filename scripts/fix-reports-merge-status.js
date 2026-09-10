#!/usr/bin/env node
/**
 * מזהה אילו ענפי fix-reports/* כבר מוזגו בפועל ל-main ואילו לא - ומיישר קו בין
 * מצב ה-PR ב-GitHub לבין המציאות, במקרה הבא: מיזוג ה-PR נעשה לפעמים לא דרך כפתור
 * ה-Merge ב-GitHub אלא ע"י מיזוג ידני מקומי (`git merge` + `git push` ישירות ל-main,
 * ר' תיעוד ב-docs/fix-protocol-error-reports.md) - ואז ה-PR עצמו נשאר "open" ב-GitHub
 * למרות שהתוכן שלו כבר חי ב-main. בלי זה, .../app/api/cron/agent-digest (lib/agentDigest.js)
 * ימשיך לדווח על PR-ים כ"ממתינים למיזוג" גם אחרי שהם כבר בפרודקשן.
 *
 * שני מצבי הפעלה:
 * 1. יש GITHUB_TOKEN (ב-CI, או --token=... ידני) - שולף את כל ה-PR-ים הפתוחים עם
 *    ראש-ענף שמתחיל ב-fix-reports/, ולכל אחד בודק דרך Compare API
 *    (/repos/{repo}/compare/main...{branch}) האם main כבר מכיל את כל הקומיטים שלו
 *    (status "identical"/"behind"). זה עובד גם מ-checkout רדוד (fetch-depth:1) כי
 *    זו קריאת API, לא בדיקת git מקומית.
 * 2. אין טוקן (הרצה ידנית מקומית רגילה) - נופל חזרה לבדיקת git מקומית בלבד
 *    (`git merge-base --is-ancestor`) מול כל ענפי fix-reports/* המרוחקים, בלי שום
 *    התאמה מול מצב ה-PR (אין גישה ל-API). מספיק כדי לענות "מה כבר במיין" אבל לא
 *    יכול לסגור PR-ים.
 *
 * Usage:
 *   node scripts/fix-reports-merge-status.js [--repo=owner/repo] [--token=...] [--close-stale] [--json]
 *
 * --close-stale: רק במצב 1 (יש טוקן) - סוגר (state=closed, בלי merge) כל PR שכבר
 * מזוהה כמוזג-בפועל ל-main, עם תגובה מסבירה. לא נוגע ב-PR-ים שבאמת עדיין לא מוזגו.
 */

'use strict';

const { execFileSync } = require('child_process');

function parseArgs(argv) {
  const out = { closeStale: false, json: false };
  for (const arg of argv) {
    if (arg === '--close-stale') { out.closeStale = true; continue; }
    if (arg === '--json') { out.json = true; continue; }
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = m[2];
  }
  return out;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function listRemoteFixReportsBranches() {
  const out = git(['branch', '-r', '--list', 'origin/fix-reports/*']);
  if (!out) return [];
  return out
    .split('\n')
    .map((l) => l.trim().replace(/^origin\//, ''))
    .filter(Boolean);
}

function isAncestorOfMainLocally(branch) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', `origin/${branch}`, 'origin/main']);
    return true;
  } catch {
    return false;
  }
}

async function githubApi(path, token, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} -> ${res.status} ${await res.text().catch(() => '')}`);
  }
  return res.status === 204 ? null : res.json();
}

async function runWithToken({ repo, token, closeStale, json }) {
  const openPrs = await githubApi(`/repos/${repo}/pulls?state=open&per_page=100`, token);
  const fixReportPrs = openPrs.filter((pr) => pr.head.ref.startsWith('fix-reports/'));

  const rows = [];
  for (const pr of fixReportPrs) {
    let status = 'unknown';
    let mergedIntoMain = false;
    try {
      const compare = await githubApi(
        `/repos/${repo}/compare/main...${encodeURIComponent(pr.head.ref)}`,
        token
      );
      status = compare.status; // identical | ahead | behind | diverged
      mergedIntoMain = status === 'identical' || status === 'behind';
    } catch (e) {
      status = `error: ${e.message}`;
    }

    let action = 'none';
    if (mergedIntoMain && closeStale) {
      await githubApi(`/repos/${repo}/issues/${pr.number}/comments`, token, {
        method: 'POST',
        body: JSON.stringify({
          body:
            'התוכן של ה-PR הזה כבר מוזג ל-`main` (נמזג ישירות, לא דרך כפתור ה-Merge כאן) — ' +
            'נסגר אוטומטית ע"י scripts/fix-reports-merge-status.js כדי שרשימת ה-PR-ים הפתוחים תשקף מציאות.',
        }),
      });
      await githubApi(`/repos/${repo}/pulls/${pr.number}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });
      action = 'closed (already merged)';
    } else if (mergedIntoMain) {
      action = 'STALE - merged into main but PR still open';
    }

    rows.push({ number: pr.number, branch: pr.head.ref, compareStatus: status, mergedIntoMain, action });
  }

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`Open fix-reports/* PRs: ${rows.length}`);
    for (const r of rows) {
      console.log(`  #${r.number}  ${r.branch}  compare=${r.compareStatus}  ${r.action}`);
    }
    const stale = rows.filter((r) => r.mergedIntoMain && !closeStale);
    if (stale.length > 0) {
      console.log(`\n${stale.length} PR(s) already merged into main but still open on GitHub. Re-run with --close-stale to close them.`);
    }
  }

  return rows.some((r) => r.mergedIntoMain && !closeStale) ? 1 : 0;
}

function runLocalOnly({ json }) {
  const branches = listRemoteFixReportsBranches();
  const rows = branches.map((branch) => ({ branch, mergedIntoMain: isAncestorOfMainLocally(branch) }));

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log('No GITHUB_TOKEN available - local git-ancestry check only (no PR reconciliation):');
    for (const r of rows) {
      console.log(`  ${r.mergedIntoMain ? '[merged]  ' : '[PENDING] '}${r.branch}`);
    }
  }

  return rows.some((r) => !r.mergedIntoMain) ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = args.token || process.env.GITHUB_TOKEN;
  const repo = args.repo || process.env.GITHUB_REPOSITORY;

  git(['fetch', 'origin', '--quiet']);

  let exitCode;
  if (token && repo) {
    exitCode = await runWithToken({ repo, token, closeStale: args.closeStale, json: args.json });
  } else {
    if (args.closeStale) {
      console.error('WARN: --close-stale ignored - needs both a GitHub token and --repo/GITHUB_REPOSITORY.');
    }
    exitCode = runLocalOnly({ json: args.json });
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(2);
});
