// Phase 0 CPU reductions (2026-10-06) - static pins. Run: node --test scripts/cpu-phase0.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- 1. neighbour prefetch --------------------------------------------------
test('ROUTE_NEIGHBORS: /orders no longer auto-warms the heavy /board and /rentals data', () => {
  const src = read('app/lib/prefetchRoutes.js');
  const m = src.match(/const ROUTE_NEIGHBORS = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'ROUTE_NEIGHBORS block found');
  const orders = m[1].match(/'\/orders':\s*\[([^\]]*)\]/);
  assert.ok(orders, "'/orders' entry found");
  assert.ok(!/\/board|\/rentals/.test(orders[1]), 'no /board or /rentals under /orders');
  assert.match(orders[1], /\/customers/);
});

test('hover/focus/touch intent prefetch is untouched', () => {
  const src = read('app/components/PrefetchManager.js');
  for (const ev of ['mouseover', 'focusin', 'touchstart']) assert.ok(src.includes(`'${ev}'`), ev);
  assert.ok(read('app/lib/prefetchRoutes.js').includes("'/board': () =>"), 'board prefetcher still exists for intent');
  assert.ok(read('app/lib/prefetchRoutes.js').includes("'/rentals': () =>"), 'rentals prefetcher still exists for intent');
});
