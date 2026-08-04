// עיצוב "כרטיס הזמנה מודרני" — פורט מתוך order_samples/order_card_new_design.html.
// כל הכללים תחומים תחת ‎.moc כדי שלא ידלפו לשאר האפליקציה (המנהלים הקיימים
// שמוטמעים בטאבים שומרים על העיצוב הפנימי שלהם).
const modernOrderCss = `
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');

.moc {
  --moc-primary: #d4af37;
  --moc-primary-dark: #b5952f;
  --moc-primary-light: rgba(212, 175, 55, 0.12);
  --moc-text-main: #2c2c2c;
  --moc-text-muted: #737373;
  --moc-bg-page: #f6f4ef;
  --moc-card-bg: #ffffff;
  --moc-card-bg-soft: #fbfaf7;
  --moc-border-color: rgba(212, 175, 55, 0.25);
  --moc-divider: #ececec;
  --moc-shadow-sm: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
  --moc-shadow-lg: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);
  --moc-success-bg: #f0fdf4; --moc-success-text: #22c55e;
  --moc-warning-bg: rgba(245,158,11,0.14); --moc-warning-text: #f59e0b;
  --moc-danger-bg: #fef2f2; --moc-danger-text: #ef4444;
  --moc-neutral-bg: #f1f5f9; --moc-neutral-text: #64748b;
  --moc-info-bg: #eff6ff; --moc-info-text: #2563eb;

  font-family: 'Heebo', var(--font-primary, system-ui), sans-serif;
  color: var(--moc-text-main);
  direction: rtl;
}
.moc *, .moc *::before, .moc *::after { box-sizing: border-box; }
.moc h1, .moc h2, .moc h3, .moc .moc-serif { font-family: 'Playfair Display', 'Heebo', serif; }

.moc-container {
  background: var(--moc-card-bg); border-radius: 20px; box-shadow: var(--moc-shadow-lg);
  display: flex; overflow: hidden; height: calc(100vh - 110px); min-height: 560px;
  border: 1px solid var(--moc-border-color);
}

/* ===== Sidebar ===== */
.moc-sidebar {
  width: 300px; min-width: 260px; flex-shrink: 0;
  background: linear-gradient(165deg, var(--moc-primary) 0%, var(--moc-primary-dark) 100%);
  color: #fff; padding: 22px 20px; display: flex; flex-direction: column; justify-content: space-between;
  overflow-y: auto; overflow-x: hidden;
}
.moc-sidebar-top-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.moc-order-id-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.moc-order-num { font-weight: 700; font-size: 1rem; color: #fff; font-family: 'Playfair Display', serif; }
.moc-v-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.3); display: inline-block; }
.moc-icon-btn-ghost {
  background: rgba(0,0,0,0.15); color: #fff; border: none; border-radius: 50%;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.2s; flex-shrink: 0;
}
.moc-icon-btn-ghost:hover { background: rgba(0,0,0,0.3); }

.moc-badge {
  padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 700;
  display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
}
.moc-badge.on-white.success { background: var(--moc-success-bg); color: #16a34a; }
.moc-badge.on-white.warning { background: var(--moc-warning-bg); color: #92400e; }
.moc-badge.on-white.danger { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-badge.on-white.neutral { background: var(--moc-neutral-bg); color: var(--moc-neutral-text); }
.moc-badge.on-white.info { background: var(--moc-info-bg); color: var(--moc-info-text); }

.moc-sidebar-info-panel {
  background: rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 11px;
}
.moc-sip-row { display: flex; align-items: center; gap: 9px; font-size: 0.95rem; color: rgba(255,255,255,0.95); }
.moc-sip-row svg { opacity: 0.75; flex-shrink: 0; }
.moc-sip-row strong { font-weight: 700; font-size: 1.02rem; }

.moc-search-wrapper { position: relative; width: 100%; }
.moc-search-wrapper svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
.moc-search-input {
  width: 100%; padding: 11px 36px; border-radius: 20px; border: none; outline: none;
  background: #fff; color: var(--moc-text-main); font-size: 0.92rem; transition: all 0.2s;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06); font-family: inherit;
}
.moc-search-input:focus { box-shadow: inset 0 1px 3px rgba(0,0,0,0.06), 0 0 0 3px rgba(255,255,255,0.35); }
.moc-search-input::placeholder { color: #9c9c9c; }

.moc-sidebar-divider { border: none; border-top: 1px solid rgba(255,255,255,0.18); margin: 18px 0; }

.moc-tab-nav { display: flex; flex-direction: column; gap: 3px; }
.moc-tab-btn {
  display: flex; align-items: center; gap: 10px; background: transparent; border: none;
  color: rgba(255,255,255,0.85); text-align: right; padding: 11px 12px; border-radius: 10px;
  font-size: 1rem; cursor: pointer; transition: all 0.18s; font-family: inherit; font-weight: 500;
  width: 100%;
}
.moc-tab-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.moc-tab-btn.active { background: #fff; color: var(--moc-primary-dark); font-weight: 700; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
.moc-tab-btn .moc-count { margin-right: auto; opacity: .7; font-size: .8rem; }
.moc-tab-btn.active .moc-count { opacity: .55; }

/* ===== Content ===== */
.moc-content-area { flex: 1; padding: 26px 30px; overflow-y: auto; background: var(--moc-card-bg); min-width: 0; }

.moc-content-topbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 2px solid var(--moc-divider); gap: 16px; flex-wrap: wrap; }
.moc-topbar-title-block h2 { margin: 0; font-size: 1.3rem; color: var(--moc-text-main); }
.moc-hint { color: var(--moc-text-muted); font-size: 0.85rem; }
.moc-topbar-actions { display: flex; align-items: center; gap: 4px; padding-top: 12px; flex-wrap: wrap; }

.moc-icon-btn-soft {
  background: transparent; border: none; border-radius: 9px; width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: var(--moc-text-muted); transition: all 0.2s; position: relative; flex-shrink: 0;
}
.moc-icon-btn-soft:hover:not(:disabled) { background: var(--moc-neutral-bg); color: var(--moc-text-main); }
.moc-icon-btn-soft:disabled { opacity: 0.45; cursor: not-allowed; }
.moc-icon-btn-soft.primary { color: var(--moc-primary-dark); }
.moc-icon-btn-soft.primary:hover:not(:disabled) { background: var(--moc-primary); color: #1e293b; }
.moc-icon-btn-soft.danger { color: var(--moc-danger-text); }
.moc-icon-btn-soft.danger:hover:not(:disabled) { background: var(--moc-danger-bg); }
.moc-icon-btn-soft.orange { color: #ea580c; }
.moc-icon-btn-soft.orange:hover:not(:disabled) { background: #fff7ed; }
.moc-icon-btn-soft.purple { color: #7e22ce; }
.moc-icon-btn-soft.purple:hover:not(:disabled) { background: #f3e8ff; }
.moc-icon-btn-soft.warn { color: #b45309; }
.moc-icon-btn-soft.warn:hover:not(:disabled) { background: #fffaf0; }
.moc-icon-btn-soft.exit { width: auto; padding: 0 14px; gap: 6px; font-weight: 700; font-size: 0.88rem; color: var(--moc-text-main); background: var(--moc-neutral-bg); font-family: inherit; }
.moc-icon-btn-soft.exit:hover:not(:disabled) { background: #e2e8f0; }

.moc-amt-badge {
  position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
  font-size: 0.62rem; font-weight: 800; padding: 2px 7px; border-radius: 10px; white-space: nowrap;
  border: 2px solid #fff; line-height: 1.3;
}
.moc-icon-btn-soft.money.debt .moc-amt-badge { background: var(--moc-danger-text); color: #fff; }
.moc-icon-btn-soft.money.credit .moc-amt-badge { background: var(--moc-success-text); color: #fff; }
.moc-icon-btn-soft.money.debt:hover { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-icon-btn-soft.money.credit:hover { background: var(--moc-success-bg); color: var(--moc-success-text); }

.moc-icon-btn-soft.sig { color: var(--moc-primary-dark); }
.moc-mini-badge {
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
  background: var(--moc-success-text); color: #fff;
}
.moc-icon-btn-soft.sig.no .moc-mini-badge { background: var(--moc-danger-text); }
.moc-topbar-sep { width: 1px; align-self: stretch; background: var(--moc-divider); margin: 4px 4px; }

.moc-dropdown-menu {
  position: absolute; top: 100%; left: 0; margin-top: 8px; background: #fff; color: #333;
  border-radius: 10px; box-shadow: var(--moc-shadow-lg); overflow: hidden; min-width: 170px; z-index: 40;
}
.moc-dropdown-item { padding: 0.6rem 0.9rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--moc-text-main); white-space: nowrap; }
.moc-dropdown-item:hover { background: var(--moc-neutral-bg); }

.moc-content-section { display: none; animation: mocFadeSlide 0.25s ease; }
.moc-content-section.active { display: block; }
@keyframes mocFadeSlide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* ===== Cards / details ===== */
.moc-card-panel {
  background: var(--moc-card-bg-soft); border: 1px solid var(--moc-divider); border-radius: 14px;
  padding: 20px 22px; box-shadow: var(--moc-shadow-sm);
}
.moc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 1100px) { .moc-grid-2 { grid-template-columns: 1fr; } }

.moc-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 10px; flex-wrap: wrap; }
.moc-panel-head .moc-title-row { display: flex; align-items: center; gap: 10px; }
.moc-avatar-chip {
  width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 1rem; background: var(--moc-primary-light); color: var(--moc-primary-dark); flex-shrink: 0;
}
.moc-avatar-chip.lg { width: 46px; height: 46px; font-size: 1.1rem; }
.moc-panel-head .moc-lbl { font-weight: 700; font-size: 1.1rem; color: var(--moc-text-main); display: block; }
.moc-panel-head .moc-sub-lbl { font-size: 0.82rem; color: var(--moc-text-muted); margin-top: 2px; }

.moc-detail-card { border-top: 3px solid var(--moc-primary); }
.moc-detail-rows { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
.moc-detail-row { display: flex; align-items: center; gap: 8px; font-size: 1rem; color: var(--moc-text-main); font-weight: 600; direction: ltr; justify-content: flex-end; }
.moc-detail-row svg { color: var(--moc-text-muted); flex-shrink: 0; }
.moc-detail-row.plain { direction: rtl; justify-content: flex-start; font-weight: 500; }

.moc-sign-status-pill {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px; border: none;
  cursor: pointer; font-weight: 700; font-size: 0.92rem; transition: all 0.2s; font-family: inherit;
}
.moc-sign-status-pill.yes { background: var(--moc-success-bg); color: #166534; }
.moc-sign-status-pill.no { background: var(--moc-neutral-bg); color: var(--moc-text-muted); }

.moc-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: none;
  font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.18s; font-family: inherit;
}
.moc-btn-gold { background: var(--moc-primary); color: #1e293b; }
.moc-btn-gold:hover { background: var(--moc-primary-dark); color: #fff; }
.moc-btn-outline { background: #f7f4ec; border: none; color: #555; }
.moc-btn-outline:hover { background: #eee6d3; }
.moc-btn-icon { width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 8px; }

.moc-field-label { display: block; font-size: 0.85rem; color: var(--moc-text-muted); font-weight: 600; margin-bottom: 4px; }
.moc-field-value { font-size: 1.08rem; font-weight: 700; color: var(--moc-text-main); }

.moc-notes-box {
  background: #fff; border: 1px solid var(--moc-divider); border-radius: 10px; padding: 12px 14px;
  color: #444; white-space: pre-wrap; min-height: 50px; font-size: 0.95rem;
}

.moc input[type=text], .moc input[type=email], .moc input[type=date], .moc input[type=time], .moc textarea, .moc select {
  width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd6c4; font-size: 0.95rem;
  font-family: inherit; background: #fff; outline: none; transition: border-color 0.15s;
}
.moc input:focus, .moc textarea:focus, .moc select:focus { border-color: var(--moc-primary); }
.moc input[type=checkbox] { width: auto; }

.moc-toggle-pair { display: inline-flex; background: var(--moc-neutral-bg); padding: 4px; border-radius: 12px; gap: 4px; }
.moc-toggle-pair .moc-opt { padding: 7px 16px; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; color: var(--moc-text-muted); border: none; background: transparent; font-family: inherit; }
.moc-toggle-pair .moc-opt.active { background: #fff; color: var(--moc-text-main); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }

.moc-spacing-note { background: linear-gradient(135deg, #fffaf0, #fff4dc); border: 1px solid #f0dfa8; border-radius: 12px; padding: 14px 16px; margin-top: 16px; }
.moc-spacing-note-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.moc-spacing-note-label { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.92rem; color: #8a6d1c; }
.moc-spacing-note select { width: 170px; border-color: #e9d495; }
.moc-spacing-note p { margin: 8px 0 0 0; font-size: 0.78rem; color: #a9873a; }

.moc-empty-state { text-align: center; padding: 40px 0; color: #b8b2a2; }

/* ===== Modals ===== */
.moc-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1500; padding: 20px; direction: rtl; font-family: 'Heebo', var(--font-primary, system-ui), sans-serif; }
.moc-modal-box { background: #fff; border-radius: 16px; width: 100%; max-width: 460px; box-shadow: var(--moc-shadow-lg); overflow: hidden; animation: mocFadeSlide 0.2s ease; }
.moc-modal-box.wide { max-width: 560px; }
.moc-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--moc-divider); background: #faf9f5; }
.moc-modal-head h3 { margin: 0; font-size: 1.15rem; }
.moc-modal-body { padding: 22px; max-height: 65vh; overflow-y: auto; }
.moc-modal-foot { padding: 16px 22px; border-top: 1px solid var(--moc-divider); display: flex; justify-content: flex-end; gap: 10px; }
.moc-close-x { background: var(--moc-neutral-bg); border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; color: #666; display: flex; align-items: center; justify-content: center; }

.moc-employee-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--moc-divider); gap: 8px; }
.moc-employee-row:last-child { border-bottom: none; }

/* משפט טעינה/הודעות */
.moc-save-msg { font-size: 0.85rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 8px; }
.moc-save-msg.ok { background: var(--moc-success-bg); color: #166534; }
.moc-save-msg.err { background: var(--moc-danger-bg); color: var(--moc-danger-text); }

/* נעילת הזמנה שעבר תאריכה */
.moc-lock-overlay {
  position: absolute; inset: 0; background: rgba(255,255,255,0.45); z-index: 60;
  display: flex; justify-content: center; align-items: flex-start; backdrop-filter: blur(2px);
}

@keyframes spin { to { transform: rotate(360deg); } }

.moc-scrollbar::-webkit-scrollbar, .moc ::-webkit-scrollbar { width: 8px; }
.moc-scrollbar::-webkit-scrollbar-thumb, .moc ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 8px; }

@media (max-width: 900px) {
  .moc-container { flex-direction: column; height: auto; }
  .moc-sidebar { width: 100%; min-width: 0; }
}
`;

export default modernOrderCss;
