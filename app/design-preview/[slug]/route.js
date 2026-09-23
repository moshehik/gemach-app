import fs from 'fs';
import path from 'path';
import { getAllCachedSettings } from '@/lib/settingsCache';

// Static design sketches (fake sample data only) meant to be viewed on the Neve Yaakov
// deployment ONLY - every other deployment answers 404. Route handlers are not wrapped by
// app/layout.js, so the require_login wall does not apply; the unguessable slug is the only
// gate. Files live in lib/design-preview/ and are read via literal paths so Vercel traces them.
export const dynamic = 'force-dynamic';

const FILES = {
  'order-card-a-9ca452c9e5': () => fs.readFileSync(path.join(process.cwd(), 'lib', 'design-preview', 'order-card-sketch-A.html'), 'utf8'),
  'order-card-b-267f9d95e0': () => fs.readFileSync(path.join(process.cwd(), 'lib', 'design-preview', 'order-card-sketch-B.html'), 'utf8'),
  'availability-sim-812db49974': () => fs.readFileSync(path.join(process.cwd(), 'lib', 'design-preview', 'availability-conflict-simulation.html'), 'utf8'),
};

async function isNeveYaakov() {
  // Vercel exposes the project's production domain per deployment (org-2 project = gmach-neve-yaakov).
  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodUrl) return prodUrl.includes('neve-yaakov') || prodUrl.includes('gemach-dresses-2');
  // No Vercel env (local dev): fall back to the org's own DB setting.
  try {
    const rows = await getAllCachedSettings();
    return (rows.find(s => s.key === 'gmach_name')?.value || '').includes('נווה יעקב');
  } catch {
    return false;
  }
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

export async function GET(_request, { params }) {
  const { slug } = await params;
  const read = Object.prototype.hasOwnProperty.call(FILES, slug) ? FILES[slug] : null;
  if (!read || !(await isNeveYaakov())) return notFound();
  return new Response(read(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
