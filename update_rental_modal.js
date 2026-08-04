const fs = require('fs');
let file = fs.readFileSync('components/orders/RentalReturnModal.js', 'utf8');

file = file.replace(
  'import { X, Info, Save, Ban, Undo2, AlertTriangle, CheckCircle2, PackageX, PackageCheck, MoreVertical, Calendar, ScanLine, Loader2, Scissors, Pencil } from \'lucide-react\';',
  'import { X, Info, Save, Ban, Undo2, AlertTriangle, CheckCircle2, PackageX, PackageCheck, MoreVertical, Calendar, ScanLine, Loader2, Scissors, Pencil, User, Phone, Clock } from \'lucide-react\';'
);

const oldSidebar = `            {/* Sidebar */}
            <div className="rrm-sidebar">
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
                  <button data-agy-id="rentalreturnmodal_button_1" className="rrm-close-btn" title="סגור חלון" onClick={attemptCloseCard}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <span className="rrm-badge" style={{ background: overallStatusColor.bg, color: overallStatusColor.text }}>{overallStatus}</span>
                </div>

                <h2 className="rrm-customer-name">
                  {selectedOrder.customer ? \`\${selectedOrder.customer.firstName || ''} \${selectedOrder.customer.lastName || ''}\` : 'לא צוין לקוח'}
                </h2>
                <div className="rrm-order-id-row">
                  <p className="rrm-order-id">הזמנה #{selectedOrder.orderId}</p>
                  <button data-agy-id="rentalreturnmodal_button_23" className="rrm-order-link-btn"
                    onClick={() => window.open(\`/orders/\${selectedOrder.orderId}\`, '_blank')}
                    title="כרטיס הזמנה">
                    <Pencil size={13} />
                  </button>
                </div>

                {selectedOrder.eventDate && (
                  <div className="rrm-date-info">
                    <label><Calendar size={13} style={{ verticalAlign: 'text-bottom', marginLeft: '4px' }} />תאריך אירוע</label>
                    <div className="val">{getHebrewDateString(selectedOrder.eventDate)}</div>
                    <div className="rrm-date-sub">{new Date(selectedOrder.eventDate).toLocaleDateString('he-IL')}</div>
                  </div>
                )}

                <div className="rrm-barcode-section">
                  <label>סריקה מהירה (השכרה/החזרה):</label>
                  <form data-agy-id="rentalreturnmodal_form_2" onSubmit={handleGlobalBarcodeScan} className="rrm-barcode-form">
                    <ScanLine size={16} className="rrm-barcode-icon" />
                    <input data-agy-id="rentalreturnmodal_input_3"
                      ref={modalBarcodeRef}
                      type="text"
                      className="rrm-barcode-input"
                      placeholder="הזן ברקוד..."
                      value={modalBarcode}
                      onChange={(e) => setModalBarcode(e.target.value.replace(/\\s+/g, ''))}
                      disabled={isProcessing}
                    />
                    <button data-agy-id="rentalreturnmodal_button_4" type="submit" className="hidden">סרוק</button>
                  </form>
                </div>
              </div>
            </div>`;

const newSidebar = `            {/* Sidebar */}
            <aside className="rrm-sidebar">
              <div>
                <div className="rrm-sidebar-top-row">
                  <button data-agy-id="rentalreturnmodal_button_1" className="rrm-icon-btn-ghost" title="סגור חלון" onClick={attemptCloseCard}>
                    <X size={16} />
                  </button>
                  <div className="rrm-order-id-group">
                    <span className="rrm-order-num">הזמנה #{selectedOrder.orderId}</span>
                    <span className="rrm-v-divider" />
                    <span className="rrm-badge on-white" style={{ background: overallStatusColor.bg, color: overallStatusColor.text }}>
                      <Clock size={13} /> {overallStatus}
                    </span>
                  </div>
                </div>

                <div className="rrm-sidebar-info-panel">
                  <div className="rrm-sip-row">
                    <User size={15} />
                    <strong>{selectedOrder.customer ? \`\${selectedOrder.customer.firstName || ''} \${selectedOrder.customer.lastName || ''}\` : 'לא צוין לקוח'}</strong>
                  </div>
                  {selectedOrder.customer?.phone1 && (
                    <div className="rrm-sip-row">
                      <Phone size={15} />
                      <span style={{ direction: 'ltr' }}>{selectedOrder.customer.phone1}</span>
                    </div>
                  )}
                  {selectedOrder.eventDate && (
                    <div className="rrm-sip-row">
                      <Calendar size={15} />
                      <span>
                        {(selectedOrder.isAbroad || selectedOrder.isWeekdayEvent)
                          ? (selectedOrder.fromDate ? \`\${getHebrewDateString(selectedOrder.fromDate)} — \${getHebrewDateString(selectedOrder.toDate || selectedOrder.returnDate)}\` : 'אירוע חו"ל')
                          : (selectedOrder.eventDateHebrew || getHebrewDateString(selectedOrder.eventDate))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <hr className="rrm-sidebar-divider" />
                <form data-agy-id="rentalreturnmodal_form_2" className="rrm-search-wrapper" style={{ marginTop: '16px' }} onSubmit={handleGlobalBarcodeScan}>
                  <ScanLine size={17} />
                  <input data-agy-id="rentalreturnmodal_input_3"
                    ref={modalBarcodeRef}
                    type="text"
                    className="rrm-search-input"
                    value={modalBarcode}
                    onChange={(e) => setModalBarcode(e.target.value.replace(/\\s+/g, ''))}
                    placeholder="סריקה מהירה — השכרה / החזרה"
                    disabled={isProcessing}
                  />
                  <button data-agy-id="rentalreturnmodal_button_4" type="submit" className="hidden" style={{display: 'none'}}>סרוק</button>
                </form>
              </div>
            </aside>`;

file = file.replace(oldSidebar, newSidebar);

const oldCss = `        .rrm-sidebar {
          background: var(--primary-color, #d4af37); color: #fff; padding: 24px 20px;
          width: 30%; min-width: 220px; display: flex; flex-direction: column; justify-content: space-between;
        }
        .rrm-close-btn {
          background: rgba(0,0,0,0.15); color: #fff; border: none; border-radius: 50%;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .rrm-close-btn:hover { background: rgba(0,0,0,0.3); }
        .rrm-customer-name { color: #fff; font-size: 1.5rem; margin: 0 0 4px 0; font-family: 'Playfair Display', serif; }
        .rrm-order-id { opacity: 0.85; font-size: 0.95rem; margin: 0; }
        .rrm-order-id-row { display: flex; align-items: center; gap: 6px; }
        .rrm-order-link-btn {
          background: rgba(0,0,0,0.15); color: #fff; border: none; border-radius: 50%;
          width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; padding: 0; flex-shrink: 0;
        }
        .rrm-order-link-btn:hover { background: rgba(0,0,0,0.3); }
        .rrm-date-info { margin-top: 20px; background: rgba(0,0,0,0.12); padding: 12px 14px; border-radius: 8px; }
        .rrm-date-info label { font-size: 0.78rem; opacity: 0.85; display: flex; align-items: center; margin-bottom: 4px; }
        .rrm-date-info .val { font-weight: 600; font-size: 1.05rem; }
        .rrm-date-sub { font-size: 0.75rem; opacity: 0.75; margin-top: 2px; }
        .rrm-barcode-section { margin-top: 20px; background: rgba(255,255,255,0.15); padding: 14px; border-radius: 8px; }
        .rrm-barcode-section label { font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 8px; }
        .rrm-barcode-form { position: relative; display: flex; align-items: center; }
        .rrm-barcode-icon { position: absolute; right: 10px; color: #888; pointer-events: none; }
        .rrm-barcode-input {
          width: 100%; padding: 10px 34px 10px 10px; border-radius: 6px; border: none; outline: none;
          text-align: center; font-size: 1rem; direction: ltr;
        }

        .rrm-main { padding: 24px 28px; width: 70%; overflow-y: auto; }`;

const newCss = `        .rrm-sidebar {
          width: 300px; min-width: 260px; flex-shrink: 0;
          background: linear-gradient(165deg, #d4af37 0%, #b5952f 100%);
          color: #fff; padding: 22px 20px; display: flex; flex-direction: column; justify-content: space-between;
          overflow-y: auto; overflow-x: hidden;
        }
        .rrm-sidebar-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: nowrap; min-width: 0; }
        .rrm-order-id-group { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-width: 0; overflow: hidden; }
        .rrm-order-num { font-weight: 700; font-size: 1rem; color: #fff; font-family: 'Playfair Display', serif; margin: 0; }
        .rrm-v-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.3); display: inline-block; }
        .rrm-icon-btn-ghost {
          background: rgba(0,0,0,0.15); color: #fff; border: none; border-radius: 50%;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s; flex-shrink: 0;
        }
        .rrm-icon-btn-ghost:hover { background: rgba(0,0,0,0.3); }

        .rrm-sidebar-info-panel {
          background: rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 11px;
        }
        .rrm-sip-row { display: flex; align-items: center; gap: 9px; font-size: 0.95rem; color: rgba(255,255,255,0.95); margin: 0; }
        .rrm-sip-row svg { opacity: 0.75; flex-shrink: 0; }
        .rrm-sip-row strong { font-weight: 700; font-size: 1.02rem; }

        .rrm-search-wrapper { position: relative; width: 100%; }
        .rrm-search-wrapper svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .rrm-search-input {
          width: 100%; padding: 11px 42px 11px 16px; border-radius: 20px; border: none; outline: none;
          background: #fff; color: #2c2c2c; font-size: 0.92rem; transition: all 0.2s;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.06); font-family: inherit;
        }
        .rrm-search-input:focus { box-shadow: inset 0 1px 3px rgba(0,0,0,0.06), 0 0 0 3px rgba(255,255,255,0.35); }
        .rrm-search-input::placeholder { color: #9c9c9c; }

        .rrm-sidebar-divider { border: none; border-top: 1px solid rgba(255,255,255,0.18); margin: 18px 0; }

        .rrm-main { padding: 24px 28px; width: 70%; overflow-y: auto; flex: 1; min-width: 0; }`;

file = file.replace(oldCss, newCss);

fs.writeFileSync('components/orders/RentalReturnModal.js', file);
console.log('Success');
