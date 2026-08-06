#!/usr/bin/env node
/**
 * Inserts one AuditReport row from a JSON payload file - the DB-writing tail end of
 * the /audit-system slash command (see .claude/commands/audit-system.md). This is the
 * ONLY write the whole 11-agent audit system performs; every audit-* subagent is
 * strictly read-only.
 *
 * Usage:
 *   node scripts/insert_audit_report.js <path-to-payload.json>
 *
 * Payload shape:
 *   {
 *     "agentSlugs": "audit-bugs,audit-orders,...",
 *     "totalFindings": 3,
 *     "highCount": 1,
 *     "mediumCount": 2,
 *     "lowCount": 0,
 *     "results": { "agents": [ { "slug", "label", "status", "findings": [...] } ] }
 *   }
 *
 * DB target: same active/inactive DB toggle the app itself uses (.active-db in the
 * repo root, written by /admin/database - see app/lib/prisma.js), so the inserted
 * report shows up wherever the app is currently pointed (PROD or TEST). Env loading
 * mirrors scripts/backup_prod_db.js - no `dotenv` package is installed in this repo.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.join(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
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
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

function resolveActiveDbUrl() {
  let mode = 'prod';
  try {
    const dbFile = path.join(ROOT, '.active-db');
    if (fs.existsSync(dbFile)) {
      mode = fs.readFileSync(dbFile, 'utf8').trim() || 'prod';
    }
  } catch (e) {
    // fall through with 'prod'
  }
  if (mode === 'test') {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('.active-db says "test" but TEST_DATABASE_URL is not set.');
    }
    return { mode, url: process.env.TEST_DATABASE_URL };
  }
  const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('No database URL found (checked PROD_DATABASE_URL, DATABASE_URL).');
  }
  return { mode: 'prod', url };
}

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    console.error('Usage: node scripts/insert_audit_report.js <path-to-payload.json>');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(path.resolve(payloadPath), 'utf8'));
  const { agentSlugs, totalFindings = 0, highCount = 0, mediumCount = 0, lowCount = 0, results } = payload;

  if (!agentSlugs || !results) {
    console.error('Payload must include at least "agentSlugs" and "results".');
    process.exit(1);
  }

  const { mode, url } = resolveActiveDbUrl();
  const prisma = new PrismaClient({ datasourceUrl: url });

  try {
    const report = await prisma.auditReport.create({
      data: {
        agentSlugs,
        totalFindings,
        highCount,
        mediumCount,
        lowCount,
        resultsJson: JSON.stringify(results)
      }
    });
    console.log(`OK: inserted AuditReport ${report.id} into ${mode.toUpperCase()} at ${report.runAt.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
