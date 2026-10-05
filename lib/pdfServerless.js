// Serverless (Vercel / AWS Lambda) Chromium launch for lib/pdf.js - kept in its own module so the pure parts can be unit-tested
// (scripts/pdf-tests/pdf-serverless.test.mjs) and so lib/pdf.js stays readable.
//
// Why this exists (2026-10-05): server PDF generation had never succeeded in production - every /api/pdf call ended in a ~170-byte
// JSON error after 4-6 seconds, which is the size of puppeteer's "Failed to launch the browser process: Code: NNN / stderr: / TROUBLESHOOTING"
// message. That means the Chromium binary WAS found and extracted (4-6s is the brotli inflate on a cold function) and then died on start.
// We cannot run Vercel's Linux runtime from a developer machine, so this module (1) removes the known ways a serverless launch dies silently,
// (2) retries once with a minimal flag set, and (3) when it still fails, says WHY (stage + exit code/signal + missing shared libraries +
// environment fingerprint) so the next failed click shows the real reason in the toast / Vercel runtime log.
// See docs/server-pdf-verification-2026-10-05.md.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';

// chromium.br inflates to ~190MB (149.0.0). A smaller /tmp/chromium is a leftover of an interrupted extraction.
export const MIN_CHROMIUM_BYTES = 100 * 1024 * 1024;

// Flags for the retry. Deliberately minimal and Lambda-safe: no sandbox (no user namespaces on Lambda-like hosts), no zygote, one process,
// no GPU / WebGL (a PDF needs none), no /dev/shm (absent or tiny there). puppeteer.launch adds its own defaults on top.
export const FALLBACK_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--no-zygote',
  '--single-process',
  '--disable-gpu',
  '--disable-webgl',
  '--disable-dev-shm-usage',
];

/** Error carrying the pipeline stage it came from (import / extract / launch / render...) - the route returns it as `stage`. */
export function stageError(stage, cause, extra) {
  const msg = cause && cause.message ? String(cause.message) : String(cause);
  const err = new Error(extra ? `${msg} ${extra}` : msg);
  err.pdfStage = stage;
  if (cause && cause.stack) err.stack = cause.stack;
  return err;
}

/** One line, no puppeteer "TROUBLESHOOTING" boilerplate, capped - for detail strings (toast / JSON / log). */
export function compactMessage(message, max = 300) {
  const flat = String(message == null ? '' : message)
    .replace(/TROUBLESHOOTING:\s*\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * The environment the Chromium child process gets. @sparticuz/chromium already sets LD_LIBRARY_PATH / FONTCONFIG_PATH on process.env when it
 * is imported, but we pass them to the child EXPLICITLY (puppeteer.launch `env`) so the shared libraries it ships (libnss3 & co, extracted
 * to <tmp>/al2023/lib) are found no matter what the host runtime did to process.env, and give Chromium a writable HOME (Lambda-like
 * hosts have a read-only or missing one; Chromium/NSS write config there).
 */
export function buildChromiumEnv(baseEnv, { tmp = os.tmpdir(), homeWritable = null } = {}) {
  const env = { ...baseEnv };
  const libDir = path.join(tmp, 'al2023', 'lib');
  const parts = [libDir, ...String(env.LD_LIBRARY_PATH || '').split(':').filter(Boolean)];
  env.LD_LIBRARY_PATH = [...new Set(parts)].join(':');
  if (!env.FONTCONFIG_PATH) env.FONTCONFIG_PATH = path.join(tmp, 'fonts');
  const writable = homeWritable === null ? isWritableDir(env.HOME) : homeWritable;
  if (!env.HOME || !writable) env.HOME = tmp;
  return env;
}

function isWritableDir(dir) {
  if (!dir) return false;
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}

const isAl2023Host = (env = process.env) =>
  !!env.VERCEL || /(20|22|24)\.x/.test(`${env.AWS_EXECUTION_ENV || ''} ${env.AWS_LAMBDA_JS_RUNTIME || ''}`);

const sizeOf = (p) => { try { return fs.statSync(p).size; } catch { return -1; } };

const run = (file, args, opts) => new Promise((resolve) => {
  try {
    execFile(file, args, { timeout: 8000, maxBuffer: 256 * 1024, ...opts }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  } catch (error) {
    resolve({ error, stdout: '', stderr: '' });
  }
});

/**
 * Runs the extracted binary directly (outside puppeteer) to learn why it will not start: its exit code / signal / stderr for `--version`,
 * and - via the dynamic loader's own trace mode (LD_TRACE_LOADED_OBJECTS=1, no ldd needed) - which shared libraries cannot be found.
 * Only called AFTER a failed launch. Never throws.
 */
export async function probeChromium(executablePath, env) {
  const out = {};
  const v = await run(executablePath, ['--version'], { env });
  out.version = compactMessage(v.stdout, 80) || null;
  if (v.error) {
    out.exit = v.error.code !== undefined ? String(v.error.code) : String(v.error.message || v.error);
    if (v.error.signal) out.signal = v.error.signal;
  }
  if (v.stderr.trim()) out.stderr = compactMessage(v.stderr, 160);
  const t = await run(executablePath, [], { env: { ...env, LD_TRACE_LOADED_OBJECTS: '1' } });
  const missing = (t.stdout + '\n' + t.stderr).split('\n').filter((l) => /not found/i.test(l)).map((l) => l.trim().split(' ')[0]).filter(Boolean);
  if (missing.length) out.missingLibs = missing.slice(0, 8);
  return out;
}

/** Compact environment fingerprint for the error detail. */
export function fingerprint({ executablePath, env, tmp = os.tmpdir(), probe } = {}) {
  const e = env || process.env;
  const bits = [
    `node=${process.version}`,
    `vercel=${e.VERCEL ? 1 : 0}`,
    `exec=${e.AWS_EXECUTION_ENV || '-'}`,
    `chromium=${executablePath ? sizeOf(executablePath) : 'n/a'}B`,
    `libnss3=${sizeOf(path.join(tmp, 'al2023', 'lib', 'libnss3.so')) > 0 ? 'ok' : 'MISSING'}`,
    `swiftshader=${sizeOf(path.join(tmp, 'libGLESv2.so')) > 0 ? 'ok' : 'MISSING'}`,
    `fonts=${sizeOf(path.join(tmp, 'fonts', 'fonts.conf')) > 0 ? 'ok' : 'MISSING'}`,
  ];
  if (probe) {
    if (probe.version) bits.push(`--version="${probe.version}"`);
    if (probe.exit) bits.push(`exit=${probe.exit}`);
    if (probe.signal) bits.push(`signal=${probe.signal}`);
    if (probe.stderr) bits.push(`stderr="${probe.stderr}"`);
    if (probe.missingLibs) bits.push(`missingLibs=${probe.missingLibs.join(',')}`);
  }
  return bits.join(' ');
}

function findBinDir() {
  const candidates = [
    path.join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin'),
    '/var/task/node_modules/@sparticuz/chromium/bin',
  ];
  return candidates.find((c) => { try { return fs.existsSync(path.join(c, 'chromium.br')); } catch { return false; } }) || null;
}

// @sparticuz/chromium.executablePath() returns early as soon as <tmp>/chromium EXISTS, without checking that the libraries / fonts that
// ship beside it were extracted too - after an interrupted or concurrent first extraction a warm instance then starts a binary that cannot
// find libnss3 (exit 127). Re-inflate whatever is missing.
async function ensureCompanionFiles(mod, tmp) {
  const binDir = findBinDir();
  if (!binDir || typeof mod.inflate !== 'function') return;
  const jobs = [];
  if (isAl2023Host() && sizeOf(path.join(tmp, 'al2023', 'lib', 'libnss3.so')) <= 0) {
    try { fs.rmSync(path.join(tmp, 'al2023'), { recursive: true, force: true }); } catch { /* best effort */ }
    jobs.push(mod.inflate(path.join(binDir, 'al2023.tar.br')));
  }
  if (sizeOf(path.join(tmp, 'libGLESv2.so')) <= 0) jobs.push(mod.inflate(path.join(binDir, 'swiftshader.tar.br')));
  if (sizeOf(path.join(tmp, 'fonts', 'fonts.conf')) <= 0) {
    try { fs.rmSync(path.join(tmp, 'fonts'), { recursive: true, force: true }); } catch { /* best effort */ }
    jobs.push(mod.inflate(path.join(binDir, 'fonts.tar.br')));
  }
  if (jobs.length) await Promise.all(jobs);
}

/**
 * Launches the bundled Chromium. `puppeteer` is the puppeteer-core default export (passed in so this module has no static dependency on it).
 * Throws an Error whose `pdfStage` is import-chromium | extract-chromium | launch and whose message explains the failure.
 */
export async function launchServerlessChromium(puppeteer, { viewport, loadChromium = () => import('@sparticuz/chromium') } = {}) {
  const tmp = os.tmpdir();

  let mod;
  try {
    mod = await loadChromium();
  } catch (e) {
    throw stageError('import-chromium', e);
  }
  const chromium = mod.default;
  // A PDF needs no WebGL: drops the swiftshader/ANGLE GPU flags (--use-gl=angle --enable-unsafe-swiftshader) that run inside the single
  // Chromium process and are one more way for it to die at startup.
  try { chromium.setGraphicsMode = false; } catch { /* older API - keep default */ }

  const exePath = path.join(tmp, 'chromium');
  const have = sizeOf(exePath);
  if (have >= 0 && have < MIN_CHROMIUM_BYTES) {
    try { fs.rmSync(exePath, { force: true }); } catch { /* best effort */ }
  }

  let executablePath;
  try {
    executablePath = await chromium.executablePath();
    await ensureCompanionFiles(mod, tmp);
  } catch (e) {
    throw stageError('extract-chromium', e, `[${fingerprint({ executablePath: exePath })}]`);
  }

  const env = buildChromiumEnv(process.env);
  const base = {
    executablePath,
    headless: 'shell',
    env,
    // Chromium's own stderr into the function log (it is also what puppeteer puts in its error, but only the last lines and racily).
    dumpio: true,
    timeout: 20000,
    ...(viewport ? { defaultViewport: viewport } : {}),
  };

  let firstError;
  try {
    const args = [...(await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' })), '--disable-dev-shm-usage'];
    return await puppeteer.launch({ ...base, args });
  } catch (e) {
    firstError = e;
  }

  let secondError;
  try {
    return await puppeteer.launch({ ...base, args: FALLBACK_ARGS, timeout: 15000 });
  } catch (e) {
    secondError = e;
  }

  const probe = await probeChromium(executablePath, env);
  const detail = `${compactMessage(firstError && firstError.message)} || retry(minimal flags): ${compactMessage(secondError && secondError.message, 160)} || [${fingerprint({ executablePath, env, probe })}]`;
  const err = new Error(detail);
  err.pdfStage = 'launch';
  err.pdfProbe = probe;
  throw err;
}
