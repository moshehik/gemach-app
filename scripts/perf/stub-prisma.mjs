// prisma לכלי המדידה: TEST בלבד + לוג של כל שאילתה (SQL, פרמטרים, משך) ב-globalThis.__queries
import fs from 'node:fs';
import { createRequire } from 'node:module';
const base = new URL('../../', import.meta.url);
const require = createRequire(base);
fs.readFileSync(new URL('.env', base), 'utf8').split('\n').forEach((l) => { const m = l.trim().match(/^([A-Z_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); });
const { PrismaClient } = require('@prisma/client');
if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.PROD_DATABASE_URL) throw new Error('TEST_DATABASE_URL missing or equals PROD');
const client = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL, log: [{ emit: 'event', level: 'query' }] });
globalThis.__queries = [];
client.$on('query', (e) => { globalThis.__queries.push({ sql: e.query, params: e.params, ms: e.duration }); });
export default client;
