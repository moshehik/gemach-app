'use client';

// OcScanBarWithSequence — SLOTS.ScanBar של W2b: שורת הסריקה של W3 (parts/OcScanBar.js) עם פאנל "רצף ברקודים" (R49) כ-prop SequencePanel.
// כש-enable_barcode_sequence_mode דלוק (oc.settings.enableBarcodeSequenceMode) W3 מציג את הפאנל בתוך #sbar במקום השדה; כבוי = השדה הרגיל.
// (REQUESTS-W3.md סעיף 4: W2b / האינטגרטור מחבר אותו - שורה אחת ב-slots.)
import OcScanBar from './OcScanBar';
import OcBarcodeSequencePanel from './OcBarcodeSequencePanel';

export default function OcScanBarWithSequence(props) {
  return <OcScanBar {...props} SequencePanel={OcBarcodeSequencePanel} />;
}
