#!/usr/bin/env node
/**
 * מוצא את קישור ה-Preview Deployment (Vercel) עבור ענף/PR נתון, דרך GitHub Deployments
 * API - בלי להשתמש ב-Vercel CLI/API וב-VERCEL_TOKEN בכלל (אינטגרציית Vercel<->GitHub
 * כבר יוצרת deployment+status על כל push, וה-GITHUB_TOKEN הרגיל של ה-workflow מספיק
 * כדי לקרוא אותם - ר' .github/workflows/claude-fix-reports.yml, "deployments: read").
 *
 * למה סקריפט node ולא curl/gh ישירות מתוך הפרומפט: כשנכתב, קלוד ב-workflow הזה היה
 * מוגבל ל- --allowedTools "Bash(node:*)" בלבד. ה-allowedTools הורחב מאז (ר'
 * claude-fix-reports.yml) כדי לאפשר גם git/gh/Edit/Write לתיקון קוד+PR בפועל, אבל
 * הסקריפט הזה נשאר כמות שהוא - node+fetch עדיין פשוט יותר מ-gh api לצורך הזה בדיוק.
 *
 * מכיוון ששני הגמחים (הראשי + נווה יעקב) הם שני פרויקטי Vercel נפרדים המחוברים
 * לאותו ריפו, אותו push לענף אחד מייצר בד"כ שני deployments נפרדים (אחד לכל
 * פרויקט) - הסקריפט מחזיר את כולם (מזוהים לפי application.name/environment ב-API),
 * לא רק אחד, כדי ש-fix-reports.md יוכל לצרף את הקישור הנכון לגמח הרלוונטי.
 *
 * Usage:
 *   node scripts/get-preview-deployment-url.js --branch=<branch> [--timeout=180] [--interval=15]
 *
 * דורש GITHUB_TOKEN (permissions: deployments: read) ו-GITHUB_REPOSITORY (אוטומטי
 * ב-GitHub Actions, "owner/repo") - או --repo=owner/repo לבדיקה ידנית.
 *
 * פלט: JSON למסך, מערך של { environment, url }. אם שום deployment לא הגיע ל-state
 * "success" בתוך ה-timeout - יוצא עם קוד שגיאה והודעה שהבנייה עדיין בתהליך (לא תקלה,
 * פשוט לנסות שוב מאוחר יותר/לדווח שהקישור עוד לא מוכן).
 */

'use strict';

function parseArgs(argv) {
  const out = { timeout: 180, interval: 15 };
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = m[2];
  }
  return out;
}

async function githubApi(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} -> ${res.status} ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

async function findPreviewUrls({ repo, branch, token }) {
  // Most-recent-first; take one deployment per distinct Vercel project (dedup by
  // the "environment"/payload label GitHub shows, which differs per Vercel project).
  const deployments = await githubApi(`/repos/${repo}/deployments?ref=${encodeURIComponent(branch)}&per_page=20`, token);
  const seenEnvironments = new Set();
  const results = [];

  for (const dep of deployments) {
    const envLabel = dep.environment || 'preview';
    if (seenEnvironments.has(envLabel)) continue; // older deployment for a project we already resolved
    const statuses = await githubApi(`/repos/${repo}/deployments/${dep.id}/statuses`, token);
    const success = statuses.find((s) => s.state === 'success' && s.environment_url);
    if (success) {
      seenEnvironments.add(envLabel);
      results.push({ environment: envLabel, url: success.environment_url });
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const branch = args.branch;
  const token = process.env.GITHUB_TOKEN;
  const repo = args.repo || process.env.GITHUB_REPOSITORY;

  if (!branch) {
    console.error('Usage: node scripts/get-preview-deployment-url.js --branch=<branch> [--timeout=180] [--interval=15]');
    process.exit(1);
  }
  if (!token) {
    console.error('ERROR: GITHUB_TOKEN env var is required (permissions: deployments: read).');
    process.exit(1);
  }
  if (!repo) {
    console.error('ERROR: GITHUB_REPOSITORY env var (or --repo=owner/repo) is required.');
    process.exit(1);
  }

  const timeoutMs = Number(args.timeout) * 1000;
  const intervalMs = Number(args.interval) * 1000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    let results = [];
    try {
      results = await findPreviewUrls({ repo, branch, token });
    } catch (e) {
      console.error(`WARN: ${e.message}`);
    }

    if (results.length > 0) {
      console.log(JSON.stringify(results));
      return;
    }

    if (Date.now() >= deadline) {
      console.error(`TIMEOUT: no successful preview deployment found for branch "${branch}" within ${args.timeout}s - it may still be building.`);
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
