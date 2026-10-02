// PP-16 PDF check (used by render.mjs): every family block must be whole on ONE page - its header (MRT-<order> barcode label) followed
// by exactly itemCount item rows ("k מתוך n"), and no item rows may open a page before a header (= a block split across pages).
// pypdf prints the RTL cells reversed ("2 מתוך1" for "1 מתוך 2"), so the item-row marker is `^<n> מתוך<k>` and the page counter
// ("8 מתוך8עמוד", margin box) is excluded by the trailing "עמוד".
export function blocksIntact(texts, blocks) {
  const byId = new Map(blocks.map((b) => [String(b.orderId), b]));
  const problems = [];
  const seen = new Set();
  texts.forEach((t, pi) => {
    const lines = t.split('\n');
    let cur = null; // { id, rows, n }
    const close = () => {
      if (!cur) return;
      const b = byId.get(cur.id);
      if (!b) problems.push(`p${pi + 1}: unknown block ${cur.id}`);
      else if (cur.rows !== b.itemCount) problems.push(`order ${cur.id}: ${cur.rows} rows on page ${pi + 1}, expected ${b.itemCount} (block split?)`);
      cur = null;
    };
    let orphans = 0;
    for (const line of lines) {
      const h = line.match(/(?:^|[^A-Z-])MRT-(\d{1,9})(?!\d)/);
      if (h) { close(); cur = { id: h[1], rows: 0 }; seen.add(h[1]); continue; }
      if (/^\d+ \u05de\u05ea\u05d5\u05da\d+/.test(line) && !/\u05e2\u05de\u05d5\u05d3/.test(line)) { if (cur) cur.rows++; else orphans++; }
    }
    close();
    if (orphans) problems.push(`page ${pi + 1}: ${orphans} item row(s) before any block header (continuation of a split block)`);
  });
  for (const b of blocks) if (!seen.has(String(b.orderId))) problems.push(`order ${b.orderId}: block header not found`);
  return problems.length ? problems.slice(0, 5).join(' ; ') : true;
}
