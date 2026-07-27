const fs = require('fs');
let code = fs.readFileSync('components/HebrewDatePicker.js', 'utf8');

// 1. Signature
code = code.replace(
  'export default function HebrewDatePicker({ value, onChange }) {',
  'export default function HebrewDatePicker({ value, selectedDate, onChange, className, style }) {\n  const actualValue = value || selectedDate;'
);

// 2. Dependencies
code = code.replace(/\[value, isOpen\]/g, '[actualValue, isOpen]');
code = code.replace(/\[value\]/g, '[actualValue]');
code = code.replace(/value \? new Date\(value\)/g, 'actualValue ? new Date(actualValue)');
code = code.replace(/if \(\!value\)/g, 'if (!actualValue)');
code = code.replace(/new Date\(value\)/g, 'new Date(actualValue)');

// 3. UI Modernization
// The main button container:
code = code.replace(
  /<div style={{ display: 'flex', width: '100%', border: '1px solid var\(--element-border\)', borderRadius: '8px', background: 'var\(--card-bg\)' }}>/g,
  '<div className={className} style={{ display: "flex", width: "100%", border: "2px solid transparent", borderRadius: "16px", background: "var(--card-bg)", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", transition: "all 0.3s", overflow: "hidden", ...(style || {}) }}\n           onFocus={(e) => { e.currentTarget.style.borderColor = "#a855f7"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(168, 85, 247, 0.15)"; }}\n           onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.05)"; }}>'
);

// The main button:
code = code.replace(
  /flex: 1,[\s\S]*?padding: '0\.4rem 0\.75rem',[\s\S]*?border: 'none',[\s\S]*?background: 'transparent',[\s\S]*?textAlign: 'right',[\s\S]*?fontSize: '0\.95rem',[\s\S]*?cursor: 'pointer',[\s\S]*?display: 'flex',[\s\S]*?justifyContent: 'space-between',[\s\S]*?alignItems: 'center'/g,
  'flex: 1, padding: "16px 20px", border: "none", background: "transparent", textAlign: "right", fontSize: "1.1rem", fontWeight: "600", color: "var(--text-main)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s"'
);

// Icon in button:
code = code.replace(
  /<Calendar size={18} \/>/g,
  '<Calendar size={22} color="#a855f7" />'
);

// Globe section:
code = code.replace(
  /borderRight: '1px solid var\(--element-border, #eee\)', width: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var\(--element-bg, #f9f9f9\)', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px'/g,
  'borderRight: "1px solid var(--border-main)", width: "60px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--element-bg)", borderTopLeftRadius: "16px", borderBottomLeftRadius: "16px", transition: "all 0.2s"'
);
code = code.replace(
  /<Globe size={18} style={{ color: 'var\(--text-muted\)', pointerEvents: 'none' }} \/>/g,
  '<Globe size={20} style={{ color: "var(--primary-color)", pointerEvents: "none" }} />'
);

// Popup:
code = code.replace(
  /background: 'var\(--card-bg\)',[\s\S]*?border: '1px solid #ddd',[\s\S]*?borderRadius: '12px',[\s\S]*?padding: '1rem',[\s\S]*?boxShadow: '0 4px 20px rgba\(0,0,0,0\.15\)',[\s\S]*?zIndex: 99999,[\s\S]*?width: '320px',[\s\S]*?direction: 'rtl'/g,
  'background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: "24px", padding: "20px", boxShadow: "0 20px 40px rgba(0,0,0,0.12)", zIndex: 99999, width: "360px", direction: "rtl", animation: "fadeIn 0.2s ease-out"'
);

// Header buttons (Next/Prev/Today):
code = code.replace(
  /background: 'var\(--image-bg\)', border: '1px solid var\(--element-border\)', borderRadius: '6px'/g,
  'background: "var(--element-bg)", border: "none", borderRadius: "999px", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)"'
);
code = code.replace(
  /background: '#e6f2ff', border: '1px solid #b3d9ff', borderRadius: '6px'/g,
  'background: "var(--primary-light)", border: "none", borderRadius: "999px", color: "var(--primary-color)", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"'
);

// Select inputs:
code = code.replace(
  /borderRadius: '6px', border: '1px solid var\(--element-border\)', background: 'var\(--card-bg\)'/g,
  'borderRadius: "12px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "500", transition: "all 0.2s", outline: "none"'
);

// Grid days:
code = code.replace(
  /borderRadius: '4px',[\s\S]*?background: d === hDay \? 'var\(--primary-color\)' : '#f9f9f9',[\s\S]*?color: d === hDay \? 'white' : 'inherit',[\s\S]*?fontWeight: d === hDay \? 'bold' : 'normal',[\s\S]*?border: '1px solid #eee',[\s\S]*?display: 'flex',[\s\S]*?flexDirection: 'row',[\s\S]*?alignItems: 'center',[\s\S]*?justifyContent: 'center',[\s\S]*?gap: '4px',[\s\S]*?minHeight: '32px'/g,
  'borderRadius: "12px", background: d === hDay ? "var(--gradient-primary)" : "transparent", color: d === hDay ? "white" : "var(--text-main)", fontWeight: d === hDay ? "bold" : "500", border: d === hDay ? "none" : "1px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", minHeight: "44px", transition: "all 0.2s", boxShadow: d === hDay ? "0 4px 10px rgba(168,85,247,0.3)" : "none"'
);
code = code.replace(
  /onMouseOver=\{\(e\) => \{\}\}/g, // In case we add hover
  ''
);

// Add hover effect to day cells programmatically via style if possible, or just a class.
// Since it's inline style, we can use onMouseOver and onMouseOut for hover.
code = code.replace(
  /onDoubleClick=\{\(\) => handleApply\(d\)\}/g,
  'onDoubleClick={() => handleApply(d)}\n                          onMouseOver={(e) => { if(d !== hDay) e.currentTarget.style.background = "var(--element-bg)"; }}\n                          onMouseOut={(e) => { if(d !== hDay) e.currentTarget.style.background = "transparent"; }}'
);

// Action buttons (Cancel, Apply)
code = code.replace(
  /borderRadius: '6px', border: '1px solid var\(--element-border\)', background: 'transparent'/g,
  'borderRadius: "999px", border: "1px solid var(--border-main)", background: "var(--element-bg)", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s"'
);
code = code.replace(
  /borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', background: 'var\(--primary-color\)', color: 'white', border: 'none'/g,
  'borderRadius: "999px", fontWeight: "bold", cursor: "pointer", background: "var(--gradient-primary)", color: "white", border: "none", boxShadow: "0 4px 12px rgba(168,85,247,0.3)", transition: "all 0.2s"'
);

fs.writeFileSync('components/HebrewDatePicker.js', code);
console.log('Modified HebrewDatePicker.js successfully');
