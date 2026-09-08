#!/usr/bin/env node
/**
 * טעינת env ובחירת connection string לפי ארגון (גמח), משותף לכל סקריפטי
 * /fix-reports (read-error-reports.js, error-report-reply.js, agent-loop-status.js,
 * agent-log-report.js) - כדי שסבב אחד יוכל לבדוק את שני הגמחים (2 DB-ים נפרדים).
 *
 * org 1 = הגמח הראשי, ממשיך להשתמש בשמות המשתנים הישנים (PROD_DATABASE_URL/
 * DATABASE_URL) בלי לשבור כלום קיים. org 2 = "נווה יעקב", דורש secret/env נוסף
 * בשם DATABASE_URL_ORG2 (או PROD_DATABASE_URL_ORG2).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let envLoaded = false;

function loadEnvFiles() {
  if (envLoaded) return;
  envLoaded = true;
  for (const file of [path.join(ROOT, '.env.local'), path.join(ROOT, '.env')]) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

/** קורא `--org=1|2` מ-argv (ברירת מחדל 1), ומחזיר { org, rest } בלי הדגל הזה. */
function parseOrgArg(argv) {
  let org = 1;
  const rest = [];
  for (const arg of argv) {
    const m = /^--org=(\d)$/.exec(arg);
    if (m) {
      org = Number(m[1]);
    } else {
      rest.push(arg);
    }
  }
  if (org !== 1 && org !== 2) {
    throw new Error(`--org must be 1 or 2, got ${org}`);
  }
  return { org, rest };
}

function resolveDbUrl(org = 1) {
  loadEnvFiles();
  const suffix = org === 2 ? '_ORG2' : '';
  const url = process.env[`PROD_DATABASE_URL${suffix}`] || process.env[`DATABASE_URL${suffix}`];
  if (!url) {
    const names = suffix
      ? `PROD_DATABASE_URL${suffix}, DATABASE_URL${suffix}`
      : 'PROD_DATABASE_URL, DATABASE_URL';
    throw new Error(`No database URL found for org ${org} (checked ${names}).`);
  }
  return url;
}

module.exports = { loadEnvFiles, parseOrgArg, resolveDbUrl };
