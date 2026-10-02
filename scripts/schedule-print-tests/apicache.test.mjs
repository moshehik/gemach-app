// The wizard's Excel download is POST /api/schedule/print (the approval PIN must not travel in the URL) but it only
// reads. lib/apiCache.js must not treat it as a mutation - the '/api/schedule' rule would wipe the client cache of
// orders, alterations, dresses, inventory and stock-check on every download (review 2.10, SHOULD-FIX 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { isMutationSkipped } = await import(pathToFileURL(process.env.PROJ + '/lib/apiCache.js').href);

test('POST /api/schedule/print is not a mutation; schedule marks still are', () => {
  assert.equal(isMutationSkipped('/api/schedule/print'), true);
  assert.equal(isMutationSkipped('/api/schedule/marks'), false);
  assert.equal(isMutationSkipped('/api/schedule'), false);
  assert.equal(isMutationSkipped('/api/orders/123'), false);
});
