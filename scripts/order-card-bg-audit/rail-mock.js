// תרחישי הרייל וחלונות השמירה של הכרטיס החדש (W5) - מצבי טיוטה שמשוחזרים בלחיצה אחת, כך שהרייל מקבל שינויים אמיתיים בלי הלשוניות של
// הזרמים האחרים. כל תרחיש מתאים למצב שהעיצוב מגיע אליו בלחיצה על sim-add / sim-rm / עריכת הערות:
//   railadd   = sim-add: נוסף פריט 4519 מידה 38 (חיוב ממתין ₪150)        railrm = sim-rm: הוסר פריט 3087 (זיכוי ממתין ₪80, דמי ביטול ₪40)
//   railnotes = רק הערות (סכום 0, בלי D1) → "שמור" → D6              railbanner = באנר הטיוטה של שכבת הסקירה (3 שורות + אזהרת דריסה)
// draft*: מה שהטיוטה מחזירה (items/obligations/order), previewExtra/previewDrop: מה ש-preview-pricing מחזיר מעבר לחיובים האוטומטיים הקיימים.
export function railScenarios({ ITEMS, OBL, ORG2, ORDER }) {
  const noSummary = ORG2.filter(([k]) => k !== 'enable_order_edit_summary_confirm');
  const newItem = {
    _localId: 'l-4519', dressItem: { id: 'di-n', dressModelId: 'm-4519', dress: { id: 'm-4519', name: '4519' } }, sizeText: '38',
    price: 150, finalPrice: 150, isDeleted: false, isTaken: false, isReturned: false,
  };
  const addRow = { amount: 150, description: 'השכרת שמלה דגם 4519 מידה 38', isManual: false, isDeleted: false };
  const feeRow = { amount: 40, description: 'דמי ביטול דגם 3087', isManual: false, isDeleted: false };
  const sameNotes = { notes: ORDER.notes };
  return {
    railadd: { draft: true, draftOrder: sameNotes, draftItems: [...ITEMS, newItem], draftObligations: [...OBL, { ...addRow, isPreview: true, _localId: 'p-add' }], previewExtra: [addRow] },
    railrm: {
      draft: true, draftOrder: sameNotes, draftItems: ITEMS.map((i) => (i.id === 'a2' ? { ...i, isDeleted: true } : i)),
      draftObligations: [...OBL, { ...feeRow, isPreview: true, _localId: 'p-fee' }], previewDrop: ['ob2'], previewExtra: [feeRow],
    },
    railnotes: { draft: true, settings: noSummary },
    // הערות בלבד על הזמנה עם חוב קיים (בלי תשלומים): הלחצן הראשי "תשלום" = שמירה (PUT יחיד) ואז חלון התשלום של W4 - בלי שמירה שנייה (אינטגרציה)
    railpaydebt: { draft: true, settings: noSummary, payments: [] },
    railbanner: {
      draft: true, draftBase: '2026-09-30T00:00:00.000Z',
      draftRows: [{ icon: '#i-dress', text: 'נוספה דגם 4519 · מידה 38' }, { icon: '#i-note', text: 'הערות עודכנו' }, { icon: '#i-calendar', text: 'תאריך האירוע: כ״ו תשרי ← כ״ז תשרי' }],
    },
  };
}
