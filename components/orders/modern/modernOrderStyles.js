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

/* שכבת מסך מלא — הכרטיס עולה מעל המערכת עם רקע נקי (מכסה את הניווט, מתחת למודלים).
   הריווח מימין משאיר את הסרגל המהיר הצף (global-sidebar, z-index 999) גלוי לצד הכרטיס. */
.moc-page-overlay {
  position: fixed; inset: 0; z-index: 500; background: var(--moc-bg-page);
  overflow-y: auto; padding: 16px 104px 20px 22px;
}

/* שילוב הסרגל המהיר הצף בשפת העיצוב של הכרטיס כשהוא פתוח */
body:has(.moc-page-overlay) .global-sidebar {
  background: #fff;
  border: 1px solid rgba(212, 175, 55, 0.35);
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.05);
}
body:has(.moc-page-overlay) .global-sidebar-icon { color: #a08a3c; }
body:has(.moc-page-overlay) .global-sidebar-icon:hover { color: #b5952f; background: rgba(212, 175, 55, 0.14); }
.moc-page-wrap { max-width: 1520px; margin: 0 auto; }

.moc-top-strip { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 0 4px; }
.moc-breadcrumb { color: var(--moc-text-muted); font-size: 0.9rem; }
.moc-breadcrumb a { color: inherit; text-decoration: none; transition: color 0.15s; }
.moc-breadcrumb a:hover { color: var(--moc-primary-dark); }
.moc-breadcrumb strong { color: var(--moc-primary-dark); }

.moc-container {
  background: var(--moc-card-bg); border-radius: 20px; box-shadow: var(--moc-shadow-lg);
  display: flex; overflow: hidden; height: calc(100vh - 110px); min-height: 560px;
  border: 1px solid var(--moc-border-color);
}
.moc-page-overlay .moc-container { height: calc(100vh - 92px); }

/* ===== Sidebar ===== */
.moc-sidebar {
  width: 300px; min-width: 260px; flex-shrink: 0;
  background: linear-gradient(165deg, var(--moc-primary) 0%, var(--moc-primary-dark) 100%);
  color: #fff; padding: 22px 20px; display: flex; flex-direction: column; justify-content: space-between;
  overflow-y: auto; overflow-x: hidden;
}
.moc-sidebar-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: nowrap; min-width: 0; }
.moc-order-id-group { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-width: 0; overflow: hidden; }
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
  width: 100%; padding: 11px 42px 11px 16px; border-radius: 20px; border: none; outline: none;
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

/* הטופ-בר נשאר תמיד בשורה אחת — הכותרת והמלל מתקצרים (ellipsis) במקום לשבור שורה */
.moc-content-topbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 2px solid var(--moc-divider); gap: 16px; flex-wrap: nowrap; }
.moc-topbar-title-block { display: flex; align-items: baseline; gap: 10px; min-width: 0; overflow: hidden; }
.moc-topbar-title-block h2 { margin: 0; font-size: 1.3rem; color: var(--moc-text-main); white-space: nowrap; flex-shrink: 0; }
.moc-hint { color: var(--moc-text-muted); font-size: 0.85rem; }
.moc-topbar-title-block .moc-hint { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.moc-topbar-actions { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; flex-shrink: 0; }

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


/* שורות קומפקטיות בפרטים כלליים — נושא אחד מתחת לשני */
.moc-compact-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.moc-compact-row + .moc-compact-row, .moc-compact-row + div + .moc-compact-row { border-top: 1px solid var(--moc-divider); }
.moc-cr-main { flex: 1; min-width: 0; }
.moc-cr-title { font-weight: 700; font-size: 1rem; color: var(--moc-text-main); }
.moc-cr-sub { font-size: 0.85rem; color: var(--moc-text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moc-cr-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
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
.moc-btn-sm { padding: 6px 12px; font-size: 0.82rem; }
.moc-btn-danger-soft { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-btn-danger-soft:hover { background: #fee2e2; }
.moc-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.moc-field-label { display: block; font-size: 0.85rem; color: var(--moc-text-muted); font-weight: 600; margin-bottom: 4px; }
.moc-field-value { font-size: 1.08rem; font-weight: 700; color: var(--moc-text-main); }

.moc-notes-box {
  background: #fff; border: 1px solid var(--moc-divider); border-radius: 10px; padding: 12px 14px;
  color: #444; white-space: pre-wrap; min-height: 50px; font-size: 0.95rem;
}

.moc input[type=text], .moc input[type=email], .moc input[type=number], .moc input[type=password], .moc input[type=tel], .moc input[type=date], .moc input[type=time], .moc textarea, .moc select {
  width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd6c4; font-size: 0.95rem;
  font-family: inherit; background: #fff; outline: none; transition: border-color 0.15s;
}
.moc input:focus, .moc textarea:focus, .moc select:focus { border-color: var(--moc-primary); }
.moc input[type=checkbox] { width: auto; }

.moc-toggle-pair { display: inline-flex; background: var(--moc-neutral-bg); padding: 4px; border-radius: 12px; gap: 4px; }
.moc-toggle-pair .moc-opt { padding: 7px 16px; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; color: var(--moc-text-muted); border: none; background: transparent; font-family: inherit; }
.moc-toggle-pair .moc-opt.active { background: #fff; color: var(--moc-text-main); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }

/* קומפקטי במכוון — לא נמתח לרוחב מלא של הכרטיס כמו שאר שדות ה-edit-box, אבל רחב מספיק
   שהציר לא ייצור שורת גלילה גם כשיש 6-7 עצירות (0..ברירת מחדל+2) */
.moc-spacing-note { background: linear-gradient(135deg, #fffaf0, #fff4dc); border: 1px solid #f0dfa8; border-radius: 12px; padding: 14px 16px; margin-top: 16px; align-self: flex-start; max-width: 620px; width: 100%; }
.moc-spacing-note-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.moc-spacing-note-label { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.92rem; color: #8a6d1c; }
.moc-spacing-note p { margin: 10px 0 0 0; font-size: 0.78rem; color: #a9873a; }

/* ציר ימי הרווח — בחירת ציפוף ויזואלית */
.moc-days-axis { display: flex; align-items: center; margin: 14px 4px 0px; overflow-x: auto; padding-bottom: 24px; }
.moc-day-stop {
  position: relative; width: 32px; height: 32px; border-radius: 50%; border: 2px solid #e9d495;
  background: #fff; color: #8a6d1c; font-weight: 700; font-size: 0.86rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.18s; font-family: inherit; flex-shrink: 0;
}
.moc-day-stop:hover { border-color: var(--moc-primary); transform: scale(1.1); }
.moc-day-stop.selected {
  background: var(--moc-primary); border-color: var(--moc-primary-dark); color: #1e293b;
  box-shadow: 0 3px 10px rgba(212, 175, 55, 0.45); transform: scale(1.12);
}
.moc-day-stop .moc-day-caption {
  position: absolute; top: calc(100% + 4px); font-size: 0.62rem; color: #a9873a;
  white-space: nowrap; font-weight: 600; right: 50%; transform: translateX(50%);
}
.moc-day-connector { height: 3px; flex: 1; background: #eeddab; min-width: 10px; border-radius: 2px; }
.moc-day-connector.passed { background: var(--moc-primary); }

/* אייקון נעילת הזמנה בטופ-בר */
.moc-icon-btn-soft.lock-on { color: var(--moc-danger-text); background: var(--moc-danger-bg); }
.moc-icon-btn-soft.lock-on:hover:not(:disabled) { background: #fee2e2; color: var(--moc-danger-text); }
.moc-icon-btn-soft.lock-off { color: #16a34a; }
.moc-icon-btn-soft.lock-off:hover:not(:disabled) { background: var(--moc-success-bg); color: #16a34a; }

.moc-empty-state { text-align: center; padding: 40px 0; color: #b8b2a2; }

/* ===== טבלאות נתונים (פריטים / תשלומים) ===== */
.moc-table-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.moc-section-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 18px;
}

/* לחצן דו-מצבי מודרני (מופעל/כבוי) */
.moc-pill-toggle {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 13px; border-radius: 20px;
  border: 1px solid var(--moc-divider); background: #fff; color: var(--moc-text-muted);
  font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: all 0.18s; font-family: inherit; white-space: nowrap;
}
.moc-pill-toggle:hover { border-color: var(--moc-border-color); }
.moc-pill-toggle.on { background: var(--moc-primary-light); border-color: var(--moc-border-color); color: var(--moc-primary-dark); }

/* עיגול המתנה אחיד לכל פעולה אסינכרונית */
.moc-spinner {
  display: inline-block; width: 15px; height: 15px; flex-shrink: 0;
  border: 2px solid rgba(181, 149, 47, 0.25); border-top-color: var(--moc-primary-dark);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
.moc-spinner.light { border-color: rgba(255,255,255,0.35); border-top-color: #fff; }
.moc-spinner.lg { width: 34px; height: 34px; border-width: 3px; }

/* תגית "ניתן לזכות פריט חדש" — נספרת לאחור על שורת דמי ביטול בזמן שהזיכוי עדיין בר-מימוש.
   נקייה במכוון (בלי מסגרת/רקע) כדי לא להתחרות עם עיצוב טבלת החיובים. */
.moc-credit-badge {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;
  font-size: 0.72rem; font-weight: 700; color: #92400e; width: fit-content;
}
.moc-credit-badge .moc-credit-time { direction: ltr; font-variant-numeric: tabular-nums; }
.moc-credit-badge.urgent { color: var(--moc-danger-text); animation: mocCreditPulse 1s ease-in-out infinite; }
@keyframes mocCreditPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
table.moc-data-table { width: 100%; border-collapse: collapse; }
.moc-data-table th, .moc-data-table td { padding: 12px 10px; text-align: right; border-bottom: 1px solid var(--moc-divider); font-size: 0.92rem; vertical-align: middle; }
.moc-data-table th { color: var(--moc-text-muted); font-weight: 700; font-size: 0.82rem; background: #faf9f5; position: sticky; top: 0; z-index: 5; }
.moc-data-table tbody tr { transition: background 0.15s; }
.moc-data-table tbody tr:hover { background: var(--moc-primary-light); }
.moc-data-table tbody tr.deleted { opacity: 0.55; background: var(--moc-neutral-bg); }
.moc-mono { font-family: 'Consolas', monospace; }

.moc-icon-btn-add {
  width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
  background: var(--moc-primary-light); color: var(--moc-primary-dark); display: flex; align-items: center;
  justify-content: center; transition: all 0.2s; flex-shrink: 0;
}
.moc-icon-btn-add:hover { background: var(--moc-primary); color: #1e293b; }

.moc-icon-btn-plain {
  background: transparent; border: none; border-radius: 8px; cursor: pointer; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; color: var(--moc-text-muted); transition: all 0.2s;
  width: 30px; height: 30px;
}
.moc-icon-btn-plain:hover { background: var(--moc-neutral-bg); color: var(--moc-text-main); }
.moc-icon-btn-plain.row-delete:hover { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-icon-btn-plain.restore:hover { background: var(--moc-success-bg); color: #16a34a; }

.moc-check-label { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--moc-text-muted); cursor: pointer; white-space: nowrap; font-weight: 600; }

.moc-repair-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.moc-repair-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 8px;
  background: var(--moc-primary-light); color: var(--moc-primary-dark); font-size: 0.78rem; font-weight: 700; white-space: nowrap;
  border: none; font-family: inherit;
}
.moc-repair-chip.muted { background: var(--moc-neutral-bg); color: var(--moc-text-muted); font-weight: 600; }
.moc-repair-chip.done { background: var(--moc-success-bg); color: #16a34a; cursor: pointer; }
.moc-repair-chip.not-done { background: var(--moc-warning-bg); color: #92400e; cursor: pointer; }
.moc-data-table.hide-alter .moc-col-alter { display: none; }

/* שורת עריכה/פריט חדש — עורכי דגם/מידה/תיקונים בתוך התא */
.moc-inline-edit { display: flex; flex-direction: column; gap: 8px; min-width: 170px; }
.moc-inline-edit .moc-field-label { margin-bottom: 0; font-size: 0.75rem; }
.moc-data-table tbody tr.editing { background: #fffdf4; box-shadow: inset -3px 0 0 var(--moc-primary); }
.moc-data-table tbody tr.editing:hover { background: #fff8e5; }
.moc-data-table tbody tr.editing td { padding-top: 16px; padding-bottom: 16px; vertical-align: top; }
.moc-edit-box {
  background: #fff; border: 1px solid var(--moc-border-color); border-radius: 10px;
  padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
}

/* ===== השכרות והחזרות ===== */
.moc-rental-item { padding: 16px 4px; border-bottom: 1px solid var(--moc-divider); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.moc-rental-item:last-child { border-bottom: none; }
.moc-rental-item .moc-title-line { font-size: 1.02rem; font-weight: 700; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.moc-rental-item .moc-sub-line { font-size: 0.85rem; color: var(--moc-text-muted); margin-top: 4px; }
.moc-rental-item .moc-dates-line { font-size: 0.8rem; color: var(--moc-text-muted); display: flex; gap: 14px; margin-top: 8px; background: var(--moc-neutral-bg); padding: 6px 10px; border-radius: 6px; width: fit-content; flex-wrap: wrap; }
.moc-return-toggle { display: inline-flex; background: var(--moc-neutral-bg); border-radius: 50px; padding: 4px; border: 1px solid #e5e5e5; align-items: stretch; }
.moc-return-toggle button { border: none; background: transparent; padding: 7px 14px; border-radius: 50px; font-weight: 700; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; gap: 5px; color: var(--moc-text-muted); font-family: inherit; transition: background 0.16s, color 0.16s, box-shadow 0.16s; }
.moc-return-toggle button:hover:not(:disabled) { color: var(--moc-text-main); }
.moc-return-toggle button.good.active, .moc-return-toggle button.good:hover:not(:disabled) { background: var(--moc-success-bg); color: #16a34a; }
.moc-return-toggle button.bad.active, .moc-return-toggle button.bad:hover:not(:disabled) { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-return-toggle button.active { box-shadow: 0 1px 3px rgba(0,0,0,0.09); }
.moc-return-toggle button:disabled { opacity: 0.5; cursor: progress; }
.moc-return-toggle .moc-rt-sep { width: 1px; background: #ddd; margin: 6px 2px; }

/* גרסה מוקטנת לשימוש בתוך טבלת הפריטים (לצד כפתורי moc-btn-sm) */
.moc-return-toggle.compact { padding: 3px; background: #fff; border-color: var(--moc-divider); }
.moc-return-toggle.compact button { padding: 5px 11px; font-size: 0.78rem; gap: 4px; }
.moc-return-toggle.compact .moc-rt-sep { margin: 5px 1px; }

.moc-notes-banner { background: var(--moc-warning-bg); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; gap: 10px; font-size: 0.9rem; color: var(--moc-text-main); align-items: flex-start; }
.moc-pending-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--moc-danger-bg); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-weight: 700; font-size: 0.92rem; color: #991b1b; flex-wrap: wrap; }

/* ===== תשלומים ===== */
.moc-pay-summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.moc-pay-tile { flex: 1; min-width: 180px; padding: 16px 18px; border-radius: 12px; }
.moc-pay-tile .moc-pt-lbl { font-size: 0.85rem; opacity: 0.85; }
.moc-pay-tile .moc-pt-amt { font-size: 1.6rem; font-weight: 800; margin-top: 4px; }
.moc-pay-tile.total { background: var(--moc-neutral-bg); color: var(--moc-text-main); }
.moc-pay-tile.paid { background: var(--moc-success-bg); color: #16a34a; }
.moc-pay-tile.debt { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-pay-tile.credit { background: var(--moc-info-bg); color: var(--moc-info-text); }
.moc-pay-tile.credit-window { background: var(--moc-warning-bg); color: #92400e; }
.moc-pay-tile.credit-window .moc-credit-badge { margin-top: 6px; font-size: 0.78rem; }

.moc-section-block { margin-bottom: 26px; }
.moc-section-block h3 { margin: 0 0 12px 0; font-size: 1.1rem; }

/* גוני רקע עדינים לפי סוג שורה בטבלת החיובים/תשלומים, כדי לזהות במבט חטוף
   חיוב רגיל, זיכוי, דמי ביטול, מימוש זיכוי, תיקון וכו'. עדינים בכוונה כדי
   שלא יתחרו עם ה-hover ועם צבע הסכום עצמו. */
.moc-row-icon { flex-shrink: 0; color: var(--moc-text-muted); }
.moc-row-item td:first-child .moc-row-icon { color: var(--moc-primary-dark); }
.moc-row-repair { background: rgba(245, 158, 11, 0.06); }
.moc-row-repair .moc-row-icon { color: #b45309; }
.moc-row-original { background: rgba(100, 116, 139, 0.06); }
.moc-row-cancel-credit { background: rgba(16, 185, 129, 0.08); }
.moc-row-cancel-credit .moc-row-icon { color: #059669; }
.moc-row-fee { background: rgba(239, 68, 68, 0.06); }
.moc-row-fee .moc-row-icon { color: #dc2626; }
.moc-row-redeem { background: rgba(37, 99, 235, 0.07); }
.moc-row-redeem .moc-row-icon { color: #2563eb; }
.moc-row-manual { background: rgba(139, 92, 246, 0.06); }
.moc-row-manual .moc-row-icon { color: #7c3aed; }
.moc-row-payment .moc-row-icon { color: #16a34a; }
.moc-row-payment-credit { background: rgba(37, 99, 235, 0.06); }
.moc-row-payment-credit .moc-row-icon { color: #2563eb; }

/* ===== היסטוריה ===== */
/* כל שורת היסטוריה מכווצת לשורה אחת כברירת מחדל — לחיצה עליה חושפת את פירוט השינויים מתחת */
.moc-history-item { border-bottom: 1px solid var(--moc-divider); }
.moc-history-item:last-child { border-bottom: none; }
.moc-history-row {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 0; border: none; background: none;
  cursor: pointer; font-family: inherit; text-align: right; color: inherit;
}
.moc-history-chevron { color: var(--moc-text-muted); flex-shrink: 0; transition: transform 0.15s ease; }
.moc-history-chevron.expanded { transform: rotate(180deg); color: var(--moc-primary-dark); }
.moc-history-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--moc-primary); flex-shrink: 0; }
.moc-history-item .moc-action-tag { font-size: 0.76rem; font-weight: 700; background: var(--moc-primary-light); color: var(--moc-primary-dark); padding: 2px 8px; border-radius: 6px; flex-shrink: 0; }
.moc-history-item .moc-meta { color: var(--moc-text-muted); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moc-history-details { padding: 0 0 12px 25px; }
.moc-history-item .moc-diff { background: #faf9f5; border: 1px solid var(--moc-divider); border-radius: 6px; padding: 6px 10px; font-size: 0.82rem; color: #555; }

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
.moc-save-msg { font-size: 0.85rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; min-width: 0; }
.moc-save-msg.ok { background: var(--moc-success-bg); color: #166534; }
.moc-save-msg.err { background: var(--moc-danger-bg); color: var(--moc-danger-text); }

/* נעילת הזמנה שעבר תאריכה */
.moc-lock-overlay {
  position: absolute; inset: 0; background: rgba(255,255,255,0.45); z-index: 60;
  display: flex; justify-content: center; align-items: flex-start; backdrop-filter: blur(2px);
}

@keyframes spin { to { transform: rotate(360deg); } }

.moc-scrollbar::-webkit-scrollbar, .moc ::-webkit-scrollbar { width: 8px; height: 8px; }
.moc-scrollbar::-webkit-scrollbar-thumb, .moc ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 8px; }

@media (max-width: 900px) {
  .moc-container { flex-direction: column; height: auto; }
  .moc-sidebar { width: 100%; min-width: 0; }
}
`;

export default modernOrderCss;
