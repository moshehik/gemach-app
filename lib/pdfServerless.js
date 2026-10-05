// Serverless (Vercel / AWS Lambda) Chromium launch for lib/pdf.js - kept in its own module so the pure parts can be unit-tested
// (scripts/pdf-tests/server-pdf.test.mjs) and so lib/pdf.js stays readable.
//
// Why this exists (2026-10-05): server PDF generation had never succeeded in production - every /api/pdf call ended in a ~170-byte
// JSON error after 4-6 seconds, which is the size of puppeteer's "Failed to launch the browser process: Code: NNN / stderr: / TROUBLESHOOTING"
// message. That means the Chromium binary WAS found and extracted (4-6s is the brotli inflate on a cold function) and then died on start.
// We cannot run Vercel's Linux runtime from a developer machine, so this module (1) removes the known ways a serverless launch dies silently,
// (2) retries once with a DIFFERENT flag set (no --single-process, graphics on) so the two failures together point at the cause, and (3) when it
// still fails, says WHY: a diagnostics fingerprint (start probe exit/signal/stderr, missing shared libs, arch, glibc, /tmp mount options,
// memory, env key NAMES, file listings, timings) goes FIRST in the error detail - the part a toast / log line shows first.
// See docs/server-pdf-verification-2026-10-05.md.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';

// The extracted pack of @sparticuz/chromium 149.0.0 (measured on the shipped archives; scripts/pdf-tests/server-pdf.test.mjs re-measures
// them against node_modules and fails when the package is bumped without updating this table). `last` = the LAST entry of each archive,
// so a file of the expected size means the extraction ran to the end; a truncated one (interrupted/concurrent first extraction) does not.
export const PACK = Object.freeze({
  version: '149.0.0',
  chromiumBytes: 199908472, // bin/chromium.br inflated -> <tmp>/chromium
  libs: { dir: ['al2023'], last: [['lib/libsoftokn3.so', 360608], ['lib/libsoftokn3.chk', 84]] }, // al2023.tar.br -> <tmp>/al2023 (nss, nspr, expat)
  swiftshader: { last: [['vk_swiftshader_icd.json', 107]] }, // swiftshader.tar.br -> <tmp> directly
  fonts: { dir: ['fonts'], last: [['fonts/Open_Sans/OpenSans-Regular.ttf', 147528]] }, // fonts.tar.br -> <tmp>/fonts
});
// kept as a named export for callers / tests
export const MIN_CHROMIUM_BYTES = PACK.chromiumBytes;

export const DETAIL_MAX = 1500; // the route caps `detail` at the same length - the fingerprint is FIRST so a cut never removes it

/** The retry's flags: the README set WITHOUT --single-process (and, in launch code, with graphics on) - differs from attempt 1 on purpose. */
export const retryArgs = (args) => args.filter((a) => a !== '--single-process');

/** Error carrying the pipeline stage it came from (import / extract / launch / render...) - the route returns it as `stage`. */
export function stageError(stage, cause, extra) {
  const msg = cause && cause.message ? String(cause.message) : String(cause);
  const err = new Error(extra ? `${msg} ${extra}` : msg);
  err.pdfStage = stage;
  if (cause && cause.stack) err.stack = cause.stack;
  return err;
}

/** One line, no puppeteer "TROUBLESHOOTING" boilerplate, capped - for detail strings (toast / JSON / log). */
export function compactMessage(message, max = 500) {
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

// ---------- companion files (libs / swiftshader / fonts) ----------
const lastFilesOk = (root, last) => last.every(([rel, bytes]) => sizeOf(path.join(root, ...rel.split('/'))) === bytes);

/** Which extracted groups are incomplete under `tmp` (their LAST file is missing or the wrong size). */
export function incompleteCompanions(tmp, { al2023 = isAl2023Host() } = {}) {
  const out = [];
  if (al2023 && !lastFilesOk(path.join(tmp), PACK.libs.last.map(([r, b]) => [`al2023/${r}`, b]))) out.push('libs');
  if (!lastFilesOk(tmp, PACK.swiftshader.last)) out.push('swiftshader');
  if (!lastFilesOk(path.join(tmp, 'fonts'), PACK.fonts.last.map(([r, b]) => [r, b]))) out.push('fonts');
  return out;
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
// find libnss3 (exit 127). Re-inflate whatever is incomplete. (lambdafs.inflate itself quick-returns when a marker file/dir exists, so the
// stale marker is removed first.)
async function ensureCompanionFiles(mod, tmp) {
  const binDir = findBinDir();
  if (!binDir || typeof mod.inflate !== 'function') return;
  const jobs = [];
  for (const group of incompleteCompanions(tmp)) {
    if (group === 'libs') {
      try { fs.rmSync(path.join(tmp, 'al2023'), { recursive: true, force: true }); } catch { /* best effort */ }
      jobs.push(mod.inflate(path.join(binDir, 'al2023.tar.br')));
    } else if (group === 'swiftshader') {
      try { fs.rmSync(path.join(tmp, 'libGLESv2.so'), { force: true }); } catch { /* best effort */ }
      jobs.push(mod.inflate(path.join(binDir, 'swiftshader.tar.br')));
    } else {
      try { fs.rmSync(path.join(tmp, 'fonts'), { recursive: true, force: true }); } catch { /* best effort */ }
      jobs.push(mod.inflate(path.join(binDir, 'fonts.tar.br')));
    }
  }
  if (jobs.length) await Promise.all(jobs);
}

// ---------- diagnostics (ONLY after a failed launch) ----------
const run = (file, args, opts) => new Promise((resolve) => {
  try {
    execFile(file, args, { timeout: 3000, maxBuffer: 256 * 1024, ...opts }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  } catch (error) {
    resolve({ error, stdout: '', stderr: '' });
  }
});

const outcome = (r) => {
  const o = {};
  if (r.error) {
    o.exit = r.error.code !== undefined ? String(r.error.code) : String(r.error.message || r.error);
    if (r.error.signal) o.signal = r.error.signal;
    if (r.error.killed) o.timedOut = true;
  } else {
    o.exit = '0';
  }
  if (r.stderr.trim()) o.stderr = compactMessage(r.stderr, 160);
  return o;
};

/**
 * Runs the extracted binary directly (outside puppeteer) to learn why it will not start. Bounded: `--version` 3s, the dynamic loader's own
 * trace mode (LD_TRACE_LOADED_OBJECTS=1, no ldd needed; only when --version failed) 3s, and an actual headless start
 * (`--headless --no-sandbox --disable-gpu --dump-dom about:blank`) 5s -> worst case 11s. Never throws.
 */
export async function probeChromium(executablePath, env) {
  const out = {};
  const v = await run(executablePath, ['--version'], { env });
  out.version = compactMessage(v.stdout, 80) || null;
  out.versionRun = outcome(v);
  if (v.error) {
    const t = await run(executablePath, [], { env: { ...env, LD_TRACE_LOADED_OBJECTS: '1' } });
    const missing = (t.stdout + '\n' + t.stderr).split('\n').filter((l) => /not found/i.test(l)).map((l) => l.trim().split(' ')[0]).filter(Boolean);
    if (missing.length) out.missingLibs = missing.slice(0, 8);
  }
  const s = await run(executablePath, ['--headless', '--no-sandbox', '--disable-gpu', '--dump-dom', 'about:blank'], { env, timeout: 5000 });
  out.start = outcome(s);
  out.startStdout = compactMessage(s.stdout, 60) || null;
  return out;
}

/** ELF e_machine of a binary: 'x64' | 'arm64' | 'e_machine=0x..' | 'not-elf' | 'unreadable'. */
export function elfMachine(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(20);
    fs.readSync(fd, b, 0, 20, 0);
    if (!(b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46)) return 'not-elf';
    const m = b.readUInt16LE(18);
    return m === 0x3e ? 'x64' : m === 0xb7 ? 'arm64' : `e_machine=0x${m.toString(16)}`;
  } catch {
    return 'unreadable';
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* ignore */ } }
  }
}

/** Mount options of the filesystem holding `p`, from /proc/mounts text (longest matching mount point wins). null when unknown. */
export function mountOptionsFor(procMounts, p) {
  let best = null;
  for (const line of String(procMounts || '').split('\n')) {
    const f = line.split(' ');
    if (f.length < 4) continue;
    const mp = f[1];
    if ((p === mp || p.startsWith(mp.endsWith('/') ? mp : `${mp}/`)) && (!best || mp.length > best.mp.length)) best = { mp, type: f[2], opts: f[3] };
  }
  return best ? `${best.mp}(${best.type}):${best.opts}` : null;
}

const listDir = (dir, max = 14) => {
  try {
    const ents = fs.readdirSync(dir, { withFileTypes: true }).slice(0, max);
    return ents.map((e) => (e.isDirectory() ? `${e.name}/` : `${e.name}:${sizeOf(path.join(dir, e.name))}`)).join(',');
  } catch { return 'unreadable'; }
};

const osPrettyName = () => {
  try {
    const m = fs.readFileSync('/etc/os-release', 'utf8').match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    return m ? m[1] : null;
  } catch { return null; }
};

const glibcVersion = () => {
  try {
    if (process.report) process.report.excludeNetwork = true;
    return process.report.getReport().header.glibcVersionRuntime || null;
  } catch { return null; }
};

const mb = (n) => (Number.isFinite(n) ? Math.round(n / 1048576) : '?');

/**
 * The environment fingerprint for the error detail. Probe results first (the part a toast shows), then the host, then the files. Names of
 * environment variables only - never their values (except LD_LIBRARY_PATH / FONTCONFIG_PATH, which are paths we set ourselves).
 */
export function fingerprint({ executablePath, env, tmp = os.tmpdir(), probe, timings } = {}) {
  const e = env || process.env;
  const bits = [];
  if (probe) {
    const sr = probe.start || {};
    bits.push(`start:exit=${sr.exit ?? '?'}${sr.signal ? ` signal=${sr.signal}` : ''}${sr.timedOut ? ' TIMEOUT' : ''}${sr.stderr ? ` stderr="${sr.stderr}"` : ''}`);
    const vr = probe.versionRun || {};
    bits.push(`version:${probe.version ? `"${probe.version}"` : 'none'} exit=${vr.exit ?? '?'}${vr.signal ? ` signal=${vr.signal}` : ''}`);
    if (probe.missingLibs) bits.push(`missingLibs=${probe.missingLibs.join(',')}`);
  }
  let exeInfo = 'n/a';
  if (executablePath) {
    try {
      const st = fs.statSync(executablePath);
      let x = 'no';
      try { fs.accessSync(executablePath, fs.constants.X_OK); x = 'yes'; } catch { /* not executable */ }
      exeInfo = `${st.size}B mode=${(st.mode & 0o777).toString(8)} X_OK=${x} elf=${elfMachine(executablePath)} (expect ${PACK.chromiumBytes})`;
    } catch { exeInfo = 'MISSING'; }
  }
  bits.push(`chromium=${exeInfo}`);
  const missing = incompleteCompanions(tmp);
  bits.push(`companions=${missing.length ? `INCOMPLETE(${missing.join(',')})` : 'ok'}`);
  let mounts = null;
  try { mounts = mountOptionsFor(fs.readFileSync('/proc/mounts', 'utf8'), tmp); } catch { /* not linux */ }
  let free = '?';
  try { const s = fs.statfsSync(tmp); free = `${mb(s.bavail * s.bsize)}MB`; } catch { /* unsupported */ }
  bits.push(`tmp=${tmp} mount=${mounts || '?'} free=${free}`);
  bits.push(`node=${process.version} arch=${process.arch} platform=${process.platform} os=${os.release()} pretty=${osPrettyName() || '?'} glibc=${glibcVersion() || '?'}`);
  bits.push(`mem=${mb(os.freemem())}/${mb(os.totalmem())}MB cpus=${os.cpus().length}`);
  bits.push(`LD_LIBRARY_PATH=${e.LD_LIBRARY_PATH || '-'} FONTCONFIG_PATH=${e.FONTCONFIG_PATH || '-'} HOME=${e.HOME || '-'}`);
  const keys = Object.keys(process.env).filter((k) => /^(VERCEL|AWS_|LAMBDA)/.test(k)).sort();
  bits.push(`envKeys=${keys.join(',') || '-'} exec=${process.env.AWS_EXECUTION_ENV || '-'}`);
  bits.push(`ls(/tmp)=${listDir(tmp)}`);
  bits.push(`ls(al2023/lib)=${listDir(path.join(tmp, 'al2023', 'lib'), 12)}`);
  if (timings) bits.push(`ms:${Object.entries(timings).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  return bits.join(' | ');
}

/** Final launch-failure detail: fingerprint FIRST, then the two launch errors; capped. */
export function launchFailureDetail({ fp, firstError, secondError, max = DETAIL_MAX }) {
  const text = `[${fp}] || attempt1(single-process, graphics off): ${compactMessage(firstError && firstError.message, 300)} || attempt2(multi-process, graphics on): ${compactMessage(secondError && secondError.message, 300)}`;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Launches the bundled Chromium. `puppeteer` is the puppeteer-core default export (passed in so this module has no static dependency on it).
 * Throws an Error whose `pdfStage` is import-chromium | extract-chromium | launch and whose message explains the failure.
 */
export async function launchServerlessChromium(puppeteer, { viewport, loadChromium = () => import('@sparticuz/chromium') } = {}) {
  const tmp = os.tmpdir();
  const timings = {};
  const t0 = Date.now();

  let mod;
  try {
    mod = await loadChromium();
  } catch (e) {
    throw stageError('import-chromium', e);
  }
  const chromium = mod.default;
  // Attempt 1: a PDF needs no WebGL, so drop the swiftshader/ANGLE GPU flags (--use-gl=angle --enable-unsafe-swiftshader) that run inside the
  // single Chromium process - one fewer way to die at startup.
  try { chromium.setGraphicsMode = false; } catch { /* older API - keep default */ }

  const exePath = path.join(tmp, 'chromium');
  const have = sizeOf(exePath);
  if (have >= 0 && have !== PACK.chromiumBytes) {
    try { fs.rmSync(exePath, { force: true }); } catch { /* best effort */ } // truncated by an interrupted extraction -> extract again
  }

  let executablePath;
  try {
    executablePath = await chromium.executablePath();
    await ensureCompanionFiles(mod, tmp);
  } catch (e) {
    timings.extract = Date.now() - t0;
    const err = stageError('extract-chromium', e);
    const text = `[${fingerprint({ executablePath: exePath, tmp, timings })}] || ${compactMessage(e && e.message, 400)}`;
    err.message = text.length > DETAIL_MAX ? `${text.slice(0, DETAIL_MAX - 1)}…` : text;
    throw err;
  }
  timings.extract = Date.now() - t0;

  const env = buildChromiumEnv(process.env);
  const base = {
    executablePath,
    headless: 'shell',
    env,
    // Chromium's own stderr into the function log (it is also what puppeteer puts in its error, but only the last lines and racily).
    dumpio: true,
    ...(viewport ? { defaultViewport: viewport } : {}),
  };

  let firstError;
  const t1 = Date.now();
  try {
    const args = [...(await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' })), '--disable-dev-shm-usage'];
    return await puppeteer.launch({ ...base, args, timeout: 15000 });
  } catch (e) {
    firstError = e;
  }
  timings.launch1 = Date.now() - t1;

  // Attempt 2 differs on purpose: graphics ON and NO --single-process. If attempt 1 died because of the single-process/GPU-less combination
  // this one starts; if both die the same way the cause is the binary / libraries / host (see the probe).
  let secondError;
  const t2 = Date.now();
  try {
    try { chromium.setGraphicsMode = true; } catch { /* keep */ }
    const args = [...(await puppeteer.defaultArgs({ args: retryArgs(chromium.args), headless: 'shell' })), '--disable-dev-shm-usage'];
    return await puppeteer.launch({ ...base, args, timeout: 15000 });
  } catch (e) {
    secondError = e;
  }
  timings.launch2 = Date.now() - t2;

  const probe = await probeChromium(executablePath, env);
  timings.total = Date.now() - t0;
  const err = new Error(launchFailureDetail({ fp: fingerprint({ executablePath, env, tmp, probe, timings }), firstError, secondError }));
  err.pdfStage = 'launch';
  err.pdfProbe = probe;
  throw err;
}
