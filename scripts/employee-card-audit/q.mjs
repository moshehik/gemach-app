import { serve, launch, sleep, PORT, DEMO } from './lib.mjs';
const fn = process.argv[2];
const s = await serve(); const b = await launch();
for (const which of ['demo', 'real']) {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
  await p.goto(which === 'demo' ? DEMO : `http://127.0.0.1:${PORT}/`, { waitUntil: 'load' }); await sleep(1500);
  console.log(which, JSON.stringify(await p.evaluate(new Function('return ' + fn)())));
}
await b.close(); s.close(); process.exit(0);
