// עיצוב "הזמנה חדשה" — פורט מתוך order_samples/new_order_card_design.html.
// כל הכללים תחומים תחת ‎.noc כדי שלא ידלפו לשאר האפליקציה, באותה שיטה של
// components/orders/modern/modernOrderStyles.js לכרטיס ההזמנה הקיימת.
const newOrderCss = `
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Frank+Ruhl+Libre:wght@400;500;700&display=swap');

.noc {
  --noc-gold: #d4af37;
  --noc-gold-dark: #b5952f;
  --noc-sky: #6db6dd;
  --noc-sky-dark: #2f86b3;
  --noc-text: #34302a;
  --noc-muted: #8d867a;
  --noc-line: rgba(150, 130, 90, 0.16);
  --noc-ok: #16a34a;
  --noc-alert: #d0483b;
  --noc-glass: rgba(255, 255, 255, 0.62);
  --noc-glass-edge: rgba(255, 255, 255, 0.8);
  --noc-shell: rgba(255, 255, 255, 0.5);
  --noc-field: rgba(255, 255, 255, 0.75);
  --noc-lift: 0 20px 45px -28px rgba(40, 70, 95, 0.40);

  font-family: 'Heebo', var(--font-primary, system-ui), sans-serif;
  color: var(--noc-text);
  direction: rtl;
}
.noc *, .noc *::before, .noc *::after { box-sizing: border-box; }
.noc h1, .noc h2, .noc h3 { font-family: 'Frank Ruhl Libre', 'Heebo', serif; font-weight: 500; margin: 0; }

/* מצב כהה — אותה זכוכית, על משטח כהה */
[data-theme="dark"] .noc {
  --noc-text: #ece7dd;
  --noc-muted: #a29a8b;
  --noc-line: rgba(212, 175, 55, 0.18);
  --noc-glass: rgba(38, 36, 32, 0.62);
  --noc-glass-edge: rgba(212, 175, 55, 0.18);
  --noc-shell: rgba(30, 28, 25, 0.55);
  --noc-field: rgba(20, 19, 17, 0.5);
  --noc-lift: 0 20px 45px -28px rgba(0, 0, 0, 0.8);
}

/* ===== רקע העמוד + כתמי אור מאחורי הזכוכית ===== */
/* הריווח מימין משאיר את הסרגל המהיר הצף (global-sidebar) גלוי לצד הבאנר */
.noc-page {
  position: relative;
  min-height: calc(100vh - var(--noc-nav, 72px));
  padding: 14px 96px 18px 20px;
  background:
    radial-gradient(760px 520px at 92% -8%, rgba(125, 197, 235, 0.26), transparent 62%),
    radial-gradient(680px 480px at 2% 104%, rgba(173, 216, 240, 0.28), transparent 62%),
    linear-gradient(158deg, #fafcfe 0%, #eef4f8 100%);
  overflow: hidden;
}
[data-theme="dark"] .noc-page {
  background:
    radial-gradient(760px 520px at 92% -8%, rgba(109, 182, 221, 0.18), transparent 62%),
    radial-gradient(680px 480px at 2% 104%, rgba(60, 100, 125, 0.20), transparent 62%),
    linear-gradient(158deg, #16191c 0%, #121416 100%);
}
.noc-glow { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; z-index: 0; }
.noc-glow.a { width: 420px; height: 420px; top: -130px; right: 4%; background: rgba(125, 197, 235, 0.30); }
.noc-glow.b { width: 360px; height: 360px; bottom: -140px; right: 26%; background: rgba(160, 210, 238, 0.26); }
.noc-glow.c { width: 300px; height: 300px; top: 34%; left: -90px; background: rgba(214, 236, 248, 0.40); }
[data-theme="dark"] .noc-glow { opacity: 0.45; }

.noc-inner { position: relative; z-index: 1; max-width: 1340px; margin: 0 auto; }
.noc-crumb { color: var(--noc-muted); font-size: 0.85rem; margin-bottom: 10px; padding-right: 4px; }
.noc-crumb a { color: inherit; text-decoration: none; }
.noc-crumb a:hover { color: var(--noc-gold-dark); }
.noc-crumb strong { color: var(--noc-gold-dark); font-weight: 500; }

/* ===== מעטפת זכוכית ===== */
.noc-shell {
  display: flex; overflow: hidden; border-radius: 24px;
  height: calc(100vh - var(--noc-nav, 72px) - 64px); min-height: 520px;
  background: var(--noc-shell);
  backdrop-filter: blur(26px) saturate(150%);
  -webkit-backdrop-filter: blur(26px) saturate(150%);
  border: 1px solid var(--noc-glass-edge);
  box-shadow: 0 30px 70px -34px rgba(40, 70, 95, 0.40);
}

/* ===== הבאנר הימני ===== */
.noc-side {
  width: 274px; flex-shrink: 0; padding: 26px 22px; color: #fff;
  display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
  background: linear-gradient(168deg, rgba(109, 182, 221, 0.82) 0%, rgba(56, 137, 178, 0.64) 100%);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-left: 1px solid rgba(255, 255, 255, 0.34);
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.35);
  text-shadow: 0 1px 2px rgba(30, 80, 110, 0.18);
  overflow-y: auto;
}
.noc-side-title { font-family: 'Frank Ruhl Libre', serif; font-size: 1.22rem; font-weight: 500; }
.noc-side-sub { font-size: 0.78rem; color: rgba(255,255,255,0.78); margin-top: 4px; }
.noc-side-rule { height: 1px; background: rgba(255,255,255,0.28); margin: 22px 0 18px; border: none; }

/* ===== מסלול השלבים ===== */
.noc-steps { display: flex; flex-direction: column; }
.noc-step {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: right;
  background: none; border: none; font-family: inherit; padding: 7px 0; cursor: pointer; color: inherit;
}
.noc-step:disabled { cursor: not-allowed; }
.noc-node-col { position: relative; width: 24px; flex-shrink: 0; align-self: stretch; }
.noc-node-col::before, .noc-node-col::after {
  content: ''; position: absolute; right: 11px; width: 2px; background: rgba(255,255,255,0.3);
}
.noc-node-col::before { top: -7px; height: 7px; }
.noc-node-col::after { top: 24px; bottom: -7px; }
.noc-step:first-child .noc-node-col::before, .noc-step:last-child .noc-node-col::after { display: none; }

.noc-node {
  position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;
  border: 1.5px solid rgba(255,255,255,0.55); color: rgba(255,255,255,0.9);
  background: rgba(255,255,255,0.14); transition: 0.2s; text-shadow: none;
}
.noc-step.done .noc-node { background: #fff; border-color: #fff; color: var(--noc-sky-dark); }
.noc-step.current .noc-node { background: #fff; border-color: #fff; color: var(--noc-sky-dark); box-shadow: 0 0 0 5px rgba(255,255,255,0.24); }
.noc-step.done .noc-node-col::after,
.noc-step.done .noc-node-col::before,
.noc-step.current .noc-node-col::before { background: #fff; }

.noc-step .noc-step-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-top: 2px; }
.noc-step .noc-step-ttl { font-size: 0.95rem; color: rgba(255,255,255,0.78); transition: 0.16s; white-space: nowrap; }
.noc-step.done .noc-step-ttl { color: rgba(255,255,255,0.95); }
.noc-step.current .noc-step-ttl { color: #fff; font-weight: 600; }
.noc-step:not(:disabled):hover .noc-step-ttl { color: #fff; }
.noc-step .noc-step-val {
  font-size: 0.75rem; color: rgba(255,255,255,0.68); max-width: 170px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.noc-step:not(.done):not(.current) { opacity: 0.7; }

/* ===== אזור התוכן ===== */
.noc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 14px 26px 20px; }
.noc-bar { display: flex; align-items: center; gap: 4px; justify-content: flex-end; min-height: 34px; flex-shrink: 0; }
.noc-flash { color: var(--noc-ok); font-size: 0.84rem; margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
.noc-flash.err { color: var(--noc-alert); }
.noc-ghost {
  background: none; border: none; color: var(--noc-muted); font-family: inherit; font-size: 0.85rem;
  cursor: pointer; padding: 7px 11px; border-radius: 9px; display: inline-flex; align-items: center; gap: 6px;
}
.noc-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.6); color: var(--noc-text); }
.noc-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.noc-ghost.danger { color: var(--noc-alert); }

.noc-pane { flex: 1; display: flex; flex-direction: column; min-height: 0; animation: nocRise 0.3s cubic-bezier(.16,1,.3,1); }
@keyframes nocRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.noc-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 6px 8px; }
.noc-scroll::-webkit-scrollbar { width: 7px; }
.noc-scroll::-webkit-scrollbar-thumb { background: rgba(150,130,90,0.22); border-radius: 6px; }

.noc-ask { margin: 6px 0 18px; }
.noc-ask h2 { font-size: 1.48rem; }
.noc-ask p { color: var(--noc-muted); font-size: 0.9rem; margin: 5px 0 0; }
.noc-mid { max-width: 580px; margin: 0 auto; }

/* ===== כרטיסים צפים ===== */
.noc-card {
  background: var(--noc-glass);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid var(--noc-glass-edge);
  border-radius: 20px; padding: 22px 24px; box-shadow: var(--noc-lift);
}
.noc-card + .noc-card { margin-top: 16px; }
.noc-card.tight { padding: 16px 18px; }

.noc-lbl { display: block; font-size: 0.8rem; color: var(--noc-muted); margin-bottom: 7px; }
.noc-lbl .req { color: var(--noc-alert); }
.noc input[type=text], .noc input[type=email], .noc input[type=number], .noc input[type=tel],
.noc input[type=date], .noc input[type=password], .noc textarea, .noc select {
  width: 100%; padding: 11px 14px; border: 1px solid var(--noc-line); border-radius: 12px;
  font-family: inherit; font-size: 0.96rem; color: var(--noc-text); outline: none;
  background: var(--noc-field); transition: 0.18s;
}
.noc input:focus, .noc textarea:focus, .noc select:focus {
  border-color: var(--noc-gold); background: rgba(255,255,255,0.92); box-shadow: 0 0 0 4px rgba(212,175,55,0.14);
}
[data-theme="dark"] .noc input:focus, [data-theme="dark"] .noc textarea:focus, [data-theme="dark"] .noc select:focus { background: rgba(25,24,21,0.85); }
.noc input[readonly] { background: rgba(255,255,255,0.4); color: var(--noc-muted); }
.noc input::placeholder, .noc textarea::placeholder { color: #b6afa2; }
.noc textarea { resize: vertical; }
.noc .noc-big-input { font-size: 1.22rem; padding: 14px 18px; text-align: center; letter-spacing: 0.5px; }
.noc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 13px 15px; }
.noc-stack > * + * { margin-top: 16px; }

.noc-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 11px 20px; border-radius: 12px; border: none; font-family: inherit;
  font-size: 0.93rem; font-weight: 600; cursor: pointer; transition: 0.18s;
}
.noc-btn.gold { background: var(--noc-gold); color: #3a3223; box-shadow: 0 10px 22px -12px rgba(180,145,40,0.9); }
.noc-btn.gold:hover:not(:disabled) { background: var(--noc-gold-dark); color: #fff; transform: translateY(-1px); }
.noc-btn.line { background: rgba(255,255,255,0.7); border: 1px solid var(--noc-line); color: var(--noc-muted); }
.noc-btn.line:hover:not(:disabled) { border-color: var(--noc-gold); color: var(--noc-text); }
.noc-btn.ok { background: var(--noc-ok); color: #fff; box-shadow: 0 10px 22px -12px rgba(22,163,74,0.9); }
.noc-btn.ok:hover:not(:disabled) { background: #15803d; transform: translateY(-1px); }
.noc-btn.wide { width: 100%; }
.noc-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.noc-link { background: none; border: none; color: var(--noc-gold-dark); font-family: inherit; font-size: 0.87rem; cursor: pointer; padding: 4px 2px; }
.noc-link:hover { text-decoration: underline; }

.noc-foot { display: flex; align-items: center; gap: 10px; padding: 14px 6px 0; flex-shrink: 0; flex-wrap: wrap; }
.noc-foot .noc-spacer { flex: 1; }

/* מגירה — כל מה שאינו חובה מתקפל */
.noc-more { margin-top: 14px; }
.noc-more-t {
  background: none; border: none; font-family: inherit; font-size: 0.86rem; color: var(--noc-gold-dark);
  cursor: pointer; padding: 8px 2px; display: inline-flex; align-items: center; gap: 7px;
}
.noc-more-t svg { transition: transform 0.2s; }
.noc-more.open .noc-more-t svg { transform: rotate(180deg); }
.noc-more-c { display: none; padding-top: 12px; }
.noc-more.open .noc-more-c { display: block; animation: nocRise 0.24s ease; }
.noc-more-badge {
  font-size: 0.72rem; font-weight: 700; background: rgba(212,175,55,0.18); color: var(--noc-gold-dark);
  padding: 2px 8px; border-radius: 20px;
}

/* בורר עדין */
.noc-switch {
  display: flex; gap: 6px; padding: 4px; border-radius: 14px; margin-bottom: 18px;
  background: rgba(255,255,255,0.5); border: 1px solid var(--noc-glass-edge);
}
[data-theme="dark"] .noc-switch { background: rgba(38,36,32,0.5); }
.noc-switch button {
  flex: 1; background: none; border: none; font-family: inherit; font-size: 0.88rem; color: var(--noc-muted);
  padding: 9px 6px; border-radius: 11px; cursor: pointer; transition: 0.18s;
}
.noc-switch button:hover { color: var(--noc-text); }
.noc-switch button.on { background: #fff; color: var(--noc-text); font-weight: 600; box-shadow: 0 6px 14px -10px rgba(85,68,30,0.7); }
[data-theme="dark"] .noc-switch button.on { background: rgba(70,66,58,0.9); }

/* שורות */
.noc-row { display: flex; align-items: center; gap: 14px; padding: 11px 2px; border-bottom: 1px solid var(--noc-line); }
.noc-row:last-child { border-bottom: none; }
.noc-row .noc-k { color: var(--noc-muted); font-size: 0.86rem; width: 120px; flex-shrink: 0; }
.noc-row .noc-v { flex: 1; min-width: 0; }
.noc-row .noc-v small { color: var(--noc-muted); margin-right: 6px; }
.noc-row .noc-amt { font-weight: 600; white-space: nowrap; }
.noc-row.total { padding-top: 15px; border-top: 1px solid var(--noc-line); border-bottom: none; }
.noc-row.total .noc-k { color: var(--noc-text); font-size: 1rem; width: auto; }
.noc-row.total .noc-amt { font-size: 1.38rem; font-family: 'Frank Ruhl Libre', serif; font-weight: 500; }

/* כרטיסי בחירה */
.noc-pick { display: flex; gap: 12px; flex-wrap: wrap; }
.noc-pick label {
  flex: 1; min-width: 190px; border: 1px solid var(--noc-line); border-radius: 15px; padding: 14px 16px;
  cursor: pointer; background: rgba(255,255,255,0.45); transition: 0.18s;
}
[data-theme="dark"] .noc-pick label { background: rgba(38,36,32,0.45); }
.noc-pick label:hover { border-color: var(--noc-gold); }
.noc-pick label.on { border-color: var(--noc-gold); background: rgba(212,175,55,0.14); }
.noc-pick .noc-pick-t { font-weight: 600; font-size: 0.95rem; }
.noc-pick .noc-pick-d { color: var(--noc-muted); font-size: 0.81rem; margin-top: 3px; }

/* מידות */
.noc-sizes { display: flex; gap: 8px; flex-wrap: wrap; min-height: 46px; align-items: center; }
.noc-size {
  min-width: 64px; padding: 8px 13px; border: 1px solid var(--noc-line); border-radius: 12px;
  background: rgba(255,255,255,0.7); font-family: inherit; cursor: pointer; text-align: center; transition: 0.18s;
  color: var(--noc-text);
}
[data-theme="dark"] .noc-size { background: rgba(38,36,32,0.6); }
.noc-size:hover:not(:disabled) { border-color: var(--noc-gold); transform: translateY(-1px); }
.noc-size.on { border-color: var(--noc-gold); background: rgba(212,175,55,0.16); }
.noc-size:disabled { color: #c6c0b3; cursor: not-allowed; background: rgba(255,255,255,0.3); transform: none; }
.noc-size .noc-sz { display: block; font-size: 1rem; font-weight: 600; }
.noc-size .noc-av { display: block; font-size: 0.69rem; color: var(--noc-muted); margin-top: 1px; }
.noc-size:disabled .noc-av { color: #c6c0b3; }
.noc-size .noc-gain { color: var(--noc-gold-dark); font-weight: 700; }

/* צ'יפים */
.noc-chips { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.noc-chip {
  padding: 8px 16px; border: 1px solid var(--noc-line); border-radius: 22px; background: rgba(255,255,255,0.7);
  font-family: inherit; font-size: 0.88rem; color: var(--noc-muted); cursor: pointer; transition: 0.18s;
  display: inline-flex; align-items: center; gap: 6px;
}
[data-theme="dark"] .noc-chip { background: rgba(38,36,32,0.6); }
.noc-chip:hover:not(:disabled) { border-color: var(--noc-gold); }
.noc-chip.on { background: rgba(212,175,55,0.16); border-color: var(--noc-gold); color: var(--noc-gold-dark); font-weight: 600; }
.noc-chip:disabled { opacity: 0.5; cursor: not-allowed; }
.noc-chip-len { display: flex; align-items: center; gap: 7px; color: var(--noc-muted); font-size: 0.87rem; }
.noc-chip-len input { width: 76px; padding: 8px 10px; text-align: center; }

/* פריסת שתי עמודות (פריטים / תשלום) */
.noc-split { display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr); gap: 18px; align-items: start; }
@media (max-width: 1080px) { .noc-split { grid-template-columns: 1fr; } }

.noc-cap { font-size: 0.78rem; color: var(--noc-muted); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }

/* רשימות גלילה */
.noc-list { max-height: 320px; overflow-y: auto; overflow-x: hidden; padding-left: 4px; }
.noc-list.tall { max-height: 42vh; }
.noc-list::-webkit-scrollbar { width: 6px; }
.noc-list::-webkit-scrollbar-thumb { background: rgba(150,130,90,0.22); border-radius: 6px; }
.noc-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 2px; border-bottom: 1px solid var(--noc-line); }
.noc-item:last-child { border-bottom: none; }
.noc-item .noc-it-main { flex: 1; min-width: 0; }
.noc-item .noc-nm { display: block; font-weight: 600; font-size: 0.93rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.noc-item .noc-meta { display: block; color: var(--noc-muted); font-size: 0.78rem; margin-top: 3px; }
.noc-item .noc-pr { font-weight: 600; white-space: nowrap; }
.noc-item .noc-acts { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; }
.noc-item:hover .noc-acts, .noc-item:focus-within .noc-acts { opacity: 1; }
.noc-mini {
  background: none; border: none; color: var(--noc-muted); cursor: pointer; padding: 5px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
}
.noc-mini:hover:not(:disabled) { color: var(--noc-text); background: rgba(255,255,255,0.85); }
.noc-mini.del:hover:not(:disabled) { color: var(--noc-alert); background: rgba(208,72,59,0.1); }
.noc-mini:disabled { opacity: 0.45; cursor: not-allowed; }
.noc-empty { color: #bdb6a8; font-size: 0.88rem; padding: 30px 0; text-align: center; }

.noc-hint { color: var(--noc-muted); font-size: 0.82rem; line-height: 1.7; margin: 0; }
.noc-hint.warn { color: #a9702a; }
.noc-hint.err { color: var(--noc-alert); }

.noc-note-box {
  background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 14px;
  padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start; font-size: 0.85rem; line-height: 1.6;
}
.noc-note-box.err { background: rgba(208, 72, 59, 0.1); border-color: rgba(208, 72, 59, 0.35); color: var(--noc-alert); }

/* ===== מודלים ===== */
body:has(.noc-ov) { overflow: hidden; }
.noc-ov {
  position: fixed; inset: 0; background: rgba(60, 50, 30, 0.34); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1500;
  direction: rtl; font-family: 'Heebo', var(--font-primary, system-ui), sans-serif;
}
.noc-box {
  background: rgba(255,255,255,0.9); backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.9); border-radius: 22px; width: 100%; max-width: 440px;
  padding: 28px 30px 22px; box-shadow: 0 30px 70px -30px rgba(85,68,30,0.6);
  animation: nocRise 0.25s cubic-bezier(.16,1,.3,1); max-height: 90vh; overflow-y: auto;
}
[data-theme="dark"] .noc-box { background: rgba(34,32,29,0.94); border-color: rgba(212,175,55,0.2); }
.noc-box.wide { max-width: 540px; }
.noc-box h3 { font-size: 1.18rem; margin-bottom: 10px; }
.noc-box p { color: var(--noc-muted); font-size: 0.91rem; line-height: 1.7; margin: 0 0 20px; }
.noc-box .noc-box-acts { display: flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }

.noc-spin {
  width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(150,130,90,0.2);
  border-top-color: var(--noc-gold); animation: nocSpin 0.8s linear infinite; margin: 0 auto 16px;
}
.noc-spin.sm { width: 16px; height: 16px; border-width: 2px; margin: 0; }
@keyframes nocSpin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .noc-page { padding: 12px 14px 16px; }
  .noc-shell { flex-direction: column; height: auto; }
  .noc-side { width: 100%; }
  .noc-main { padding: 14px 16px 18px; }
  .noc-scroll { overflow: visible; }
}
`;

export default newOrderCss;
