import modernOrderCss from '../../orders/modern/modernOrderStyles';

// תוספות העיצוב הייחודיות לכרטיס הדגם. שפת העיצוב עצמה (צבעים, סיידבר, טופ-בר,
// כפתורים, טבלאות, מודלים) מגיעה כמו שהיא מ-modernOrderStyles כדי שכרטיס הדגם
// וכרטיס ההזמנה יישארו זהים לנצח — כאן רק מה שאין לו מקבילה בהזמנה.
const dressExtras = `
/* ===== תמונת הדגם בסיידבר ===== */
.moc-sidebar-thumb {
  width: 100%; height: 132px; border-radius: 12px; overflow: hidden; margin-bottom: 14px;
  background: rgba(255,255,255,0.16); display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.75); font-size: 0.82rem; font-weight: 600; gap: 6px; flex-direction: column;
  border: 1px solid rgba(255,255,255,0.25); position: relative; cursor: pointer; padding: 0;
}
.moc-sidebar-thumb img { width: 100%; height: 100%; object-fit: cover; }
.moc-sidebar-thumb:hover .moc-thumb-overlay { opacity: 1; }
.moc-thumb-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.45); color: #fff; opacity: 0;
  display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.82rem;
  font-weight: 700; transition: opacity 0.2s;
}

/* ===== אייקוני מצב בטופ-בר ===== */
.moc-icon-btn-soft.stock.attention .moc-amt-badge { background: var(--moc-warning-text); color: #fff; }
.moc-icon-btn-soft.stock.ok .moc-amt-badge { background: var(--moc-success-text); color: #fff; }
.moc-icon-btn-soft.stock.attention:hover:not(:disabled) { background: #fff7ed; color: #b45309; }
.moc-icon-btn-soft.stock.ok:hover:not(:disabled) { background: var(--moc-success-bg); color: #16a34a; }
.moc-icon-btn-soft.state { color: var(--moc-primary-dark); }
.moc-icon-btn-soft.state.no .moc-mini-badge { background: var(--moc-danger-text); }
.moc-icon-btn-soft.inspect.on { color: #b45309; background: #fffaf0; }
.moc-icon-btn-soft.inspect.on .moc-mini-badge { background: var(--moc-warning-text); }
.moc-icon-btn-soft.inspect.off .moc-mini-badge { background: var(--moc-neutral-text); }

/* ===== פריסת טאב "פרטי דגם" — תמונה בצד, שורות קומפקטיות לצידה ===== */
.moc-grid-detail { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
@media (max-width: 1100px) { .moc-grid-detail { grid-template-columns: 1fr; } }
.moc-image-frame {
  width: 100%; height: 250px; border-radius: 12px; background: #f3f1ea; border: 1px dashed #ddd6c4;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  color: #a9a290; overflow: hidden;
}
.moc-image-frame img { width: 100%; height: 100%; object-fit: contain; }

/* פס מצב צבעוני (לא פעיל / בבדיקה) */
.moc-status-note {
  background: linear-gradient(135deg, #fff5f5, #ffecec); border: 1px solid #ffd0d0; border-radius: 12px;
  padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  margin: 2px 0 10px;
}
.moc-status-note.warn { background: linear-gradient(135deg, #fffaf0, #fff4dc); border-color: #f0dfa8; }
.moc-status-note .moc-sn-label { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 0.92rem; color: #b3261e; }
.moc-status-note.warn .moc-sn-label { color: #8a6d1c; }
.moc-status-note .moc-sn-sub { font-size: 0.78rem; margin-top: 4px; opacity: 0.85; color: #b3261e; }
.moc-status-note.warn .moc-sn-sub { color: #a9873a; }

/* ===== סרגלי סינון ===== */
.moc-filter-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.moc-pill-toggle.on.green { background: var(--moc-success-bg); border-color: #bbf7d0; color: #16a34a; }
.moc-pill-toggle.on.orange { background: #fff7ed; border-color: #fed7aa; color: #b45309; }
.moc-pill-toggle.on.blue { background: var(--moc-info-bg); border-color: #bfdbfe; color: var(--moc-info-text); }
.moc-pill-toggle.on.red { background: var(--moc-danger-bg); border-color: #fecaca; color: var(--moc-danger-text); }
.moc-pill-toggle .moc-cnt { opacity: .6; font-size: .76rem; }
.moc-toolbar-search { position: relative; display: inline-flex; align-items: center; }
.moc-toolbar-search input { width: 280px; padding: 8px 34px 8px 30px; border-radius: 20px; font-size: 0.88rem; }
.moc-toolbar-search .moc-ts-icon { position: absolute; right: 11px; color: var(--moc-text-muted); pointer-events: none; display: flex; }
.moc-toolbar-search .moc-ts-clear { position: absolute; left: 6px; width: 22px; height: 22px; }

/* ===== טבלת הפריטים ===== */
.moc-table-scroll { overflow-x: auto; border-radius: 12px; border: 1px solid var(--moc-divider); }
.moc-data-table th .moc-th-inner { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.moc-data-table th .moc-sort-ic { color: #c7c2b4; flex-shrink: 0; }
.moc-data-table th.sorted { color: var(--moc-primary-dark); }
.moc-data-table th.sorted .moc-sort-ic { color: var(--moc-primary-dark); }
.moc-data-table tbody tr.st-repair { background: #fffbeb; }
.moc-data-table tbody tr.st-unused { background: #fff5f5; }
.moc-data-table tbody tr.st-deleted { opacity: 0.55; background: var(--moc-neutral-bg); }
.moc-data-table tbody tr.st-deleted .moc-mono { text-decoration: line-through; }
.moc-size-pill {
  display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 28px;
  padding: 0 8px; border-radius: 8px; background: var(--moc-primary-light); color: var(--moc-primary-dark);
  font-weight: 800; font-size: 0.92rem;
}
.moc-locked-cell { color: var(--moc-text-muted); font-weight: 600; }
.moc-cell-input { padding: 6px 9px; width: 140px; font-size: 0.9rem; }
.moc-cell-select { padding: 6px 9px; width: 128px; font-size: 0.88rem; }

/* צ'יפ מצב דו-מצבי בתוך תא (בתיקון / לא בשימוש) */
.moc-state-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px;
  font-size: 0.78rem; font-weight: 700; white-space: nowrap; border: none; font-family: inherit; cursor: pointer;
  background: var(--moc-neutral-bg); color: var(--moc-text-muted); transition: all .16s;
}
.moc-state-chip:hover:not(:disabled) { filter: brightness(0.96); }
.moc-state-chip:disabled { cursor: not-allowed; opacity: 0.6; }
.moc-state-chip.on-repair { background: var(--moc-warning-bg); color: #92400e; }
.moc-state-chip.on-unused { background: var(--moc-danger-bg); color: var(--moc-danger-text); }

.moc-col-filter-row td { background: #fdfcf8; padding: 6px 10px; border-bottom: 2px solid var(--moc-divider); }
.moc-col-filter-row input { padding: 5px 8px; font-size: 0.8rem; border-radius: 6px; }

/* שורה במצב עריכה — נפתחת מאייקון העיפרון */
.moc-data-table tbody tr.row-editing { background: #fffdf4; box-shadow: inset -3px 0 0 var(--moc-primary); }
.moc-data-table tbody tr.row-editing:hover { background: #fff8e5; }
.moc-row-actions { display: inline-flex; align-items: center; gap: 2px; justify-content: center; }
.moc-icon-btn-plain.act-save { color: var(--moc-primary-dark); background: var(--moc-primary-light); }
.moc-icon-btn-plain.act-save:hover { background: var(--moc-primary); color: #1e293b; }
.moc-icon-btn-plain.act-cancel:hover { background: var(--moc-neutral-bg); color: var(--moc-text-main); }
.moc-icon-btn-plain.act-edit:hover { background: var(--moc-primary-light); color: var(--moc-primary-dark); }

/* סרגל הוספה מהירה */
.moc-add-bar {
  background: linear-gradient(135deg, #fffdf6, #fdf8e9); border: 1px dashed var(--moc-border-color);
  border-radius: 12px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-end;
  flex-wrap: wrap; margin-bottom: 14px;
}
.moc-add-bar .moc-fld { display: flex; flex-direction: column; gap: 4px; }
.moc-add-bar .moc-fld.w-sm input, .moc-add-bar .moc-fld.w-sm select { width: 110px; }
.moc-add-bar .moc-fld.w-md input, .moc-add-bar .moc-fld.w-md select { width: 155px; }
.moc-add-bar .moc-add-hint { margin-right: auto; font-size: 0.78rem; color: #a9873a; align-self: center; max-width: 280px; line-height: 1.5; }

/* ===== תצוגת קוביות לפי מידה ===== */
.moc-cubes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.moc-size-cube {
  border: 1px solid var(--moc-divider); border-radius: 14px; padding: 14px 16px; background: var(--moc-card-bg-soft);
  display: flex; flex-direction: column; gap: 10px; box-shadow: var(--moc-shadow-sm); transition: all .18s;
}
.moc-size-cube:hover { border-color: var(--moc-border-color); box-shadow: var(--moc-shadow-lg); }
.moc-size-cube h4 {
  margin: 0; font-family: 'Playfair Display', 'Heebo', serif; font-size: 1.15rem; color: var(--moc-primary-dark);
  border-bottom: 2px solid var(--moc-primary-light); padding-bottom: 8px;
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.moc-cube-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.moc-cube-chip { padding: 3px 9px; border-radius: 12px; font-size: 0.78rem; font-weight: 700; }
.moc-cube-chip.ok { background: var(--moc-success-bg); color: #16a34a; }
.moc-cube-chip.repair { background: var(--moc-warning-bg); color: #92400e; }
.moc-cube-chip.unused { background: #fff0f0; color: #d84315; }
.moc-cube-chip.deleted { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
.moc-serial-box { background: #fff; border: 1px solid var(--moc-divider); border-radius: 10px; padding: 9px 12px; }
.moc-serial-box .moc-sb-label { font-size: 0.78rem; color: var(--moc-text-muted); font-weight: 700; margin-bottom: 3px; }
.moc-serial-box .moc-sb-value { color: var(--moc-primary-dark); font-size: 1.02rem; font-family: 'Consolas', monospace; word-break: break-word; }

/* ===== אשף "דגם חדש" — מבנה הצעדים של /orders/new בשפת העיצוב של הכרטיס ===== */
.moc-wizard { max-width: 980px; margin: 0 auto; }
.moc-stepper {
  background: var(--moc-card-bg); border: 1px solid var(--moc-border-color); border-radius: 18px;
  padding: 18px 20px; box-shadow: var(--moc-shadow-sm); display: grid; align-items: start;
  margin-bottom: 18px; --moc-node: 36px;
}
.moc-step-item {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px;
  min-width: 0; background: none; border: none; padding: 0; font-family: inherit; text-align: center;
  cursor: pointer; color: inherit;
}
.moc-step-item:disabled { cursor: not-allowed; }
/* קו מקשר לצעד הקודם (RTL — מימין) */
.moc-step-item:not(:first-child)::before,
.moc-step-item:not(:first-child)::after {
  content: ''; position: absolute; top: calc(var(--moc-node) / 2); left: calc(50% + var(--moc-node) / 2 + 6px);
  width: calc(100% - var(--moc-node) - 12px); height: 3px; border-radius: 3px; transform: translateY(-50%);
}
.moc-step-item:not(:first-child)::before { background: var(--moc-divider); }
.moc-step-item:not(:first-child)::after {
  background: var(--moc-primary); transform: translateY(-50%) scaleX(0); transform-origin: right center;
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.moc-step-item.reached:not(:first-child)::after { transform: translateY(-50%) scaleX(1); }
.moc-step-node {
  width: var(--moc-node); height: var(--moc-node); border-radius: 50%; background: #fff;
  border: 1px solid var(--moc-divider); display: flex; align-items: center; justify-content: center;
  font-weight: 800; color: var(--moc-text-muted); position: relative; z-index: 2;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.moc-step-item.reached .moc-step-node { background: var(--moc-primary-light); border-color: var(--moc-border-color); color: var(--moc-primary-dark); }
.moc-step-item.active .moc-step-node {
  background: var(--moc-primary); border-color: var(--moc-primary-dark); color: #1e293b;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.45); transform: scale(1.1);
}
.moc-step-label { font-size: 0.85rem; font-weight: 700; color: var(--moc-text-muted); }
.moc-step-item.active .moc-step-label { color: var(--moc-primary-dark); }
.moc-step-card { animation: mocFadeSlide 0.25s ease; }
.moc-step-inner { max-width: 680px; margin: 0 auto; }
.moc-wizard-foot {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  margin-top: 18px; padding-top: 16px; border-top: 2px solid var(--moc-divider); flex-wrap: wrap;
}
.moc-summary-list { display: flex; flex-direction: column; gap: 2px; }
.moc-summary-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--moc-divider);
}
.moc-summary-row:last-child { border-bottom: none; }
.moc-summary-row .moc-sr-label { color: var(--moc-text-muted); font-size: 0.88rem; min-width: 150px; }
.moc-summary-row .moc-sr-value { font-weight: 700; }
.moc-summary-row .moc-sr-value.empty { color: var(--moc-text-muted); font-weight: 500; font-style: italic; }

/* בונה המידות בצעד הפריטים */
.moc-size-builder { display: flex; flex-direction: column; gap: 10px; }
.moc-size-line {
  display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--moc-divider);
  border-radius: 10px; padding: 10px 12px; flex-wrap: wrap;
}
.moc-size-line .moc-sl-preview {
  margin-right: auto; font-family: 'Consolas', monospace; font-size: 0.82rem; color: var(--moc-primary-dark);
  background: var(--moc-primary-light); padding: 4px 10px; border-radius: 8px; white-space: nowrap;
}
.moc-size-line input, .moc-size-line select { width: 108px; }

/* ===== אריחי סיכום (מקבילה לסיכום התשלומים בהזמנה) ===== */
.moc-stat-tiles { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.moc-stat-tile { flex: 1; min-width: 165px; padding: 15px 18px; border-radius: 12px; }
.moc-stat-tile .moc-st-label { font-size: 0.85rem; opacity: 0.85; }
.moc-stat-tile .moc-st-value { font-size: 1.6rem; font-weight: 800; margin-top: 4px; }
.moc-stat-tile.total { background: var(--moc-neutral-bg); color: var(--moc-text-main); }
.moc-stat-tile.ok { background: var(--moc-success-bg); color: #16a34a; }
.moc-stat-tile.warn { background: var(--moc-warning-bg); color: #92400e; }
.moc-stat-tile.info { background: var(--moc-info-bg); color: var(--moc-info-text); }
.moc-stat-tile.danger { background: var(--moc-danger-bg); color: var(--moc-danger-text); }
`;

const modernDressCss = modernOrderCss + dressExtras;

export default modernDressCss;
