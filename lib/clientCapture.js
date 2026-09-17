// עטיפה סביב html2canvas-pro לצילום אלמנט בודד או אזור התצוגה הנראה (viewport) -
// צד לקוח בלבד, ייבוא דינמי כדי לא לנפח את ה-bundle הראשי עם קוד שרוב הכניסות
// לאתר לא צריכות בכלל. משמש הן את חלונית ה-AI (AIFloatingWidget) והן את מערכת
// דיווחי השגיאות (ErrorReportButton) - שני הצרכנים היחידים.
//
// html2canvas-pro (fork של html2canvas) ולא html2canvas המקורי - הספרייה
// המקורית נכשלת עם "Attempting to parse an unsupported color function color"
// על כל צילום באתר הזה בפועל, כי מערכת הפלטות (lib/palette*, CSS vars) משתמשת
// בפונקציות צבע מודרניות (oklch/color()) שה-html2canvas הישן לא תומך בהן.
//
// ידוע: עדיין יש מגבלות עם backdrop-filter/גרדיאנטים מסוימים/iframes - אם
// צילום בתוך מודל פתוח יוצא לא טוב, זה כנראה מכאן, לא מבאג בקוד הזה.

async function getHtml2Canvas() {
  const mod = await import('html2canvas-pro');
  return mod.default || mod;
}

async function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * מצלם אלמנט DOM ספציפי (קרופ מדויק לגבולות שלו).
 * מחזיר { dataUrl, width, height } או null אם הצילום נכשל.
 */
export async function captureElement(el) {
  if (!el) return null;
  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true, logging: false });
    return { dataUrl: await canvasToDataUrl(canvas), width: canvas.width, height: canvas.height };
  } catch (e) {
    console.error('captureElement failed:', e);
    return null;
  }
}

/**
 * מצלם רק את מה שנראה כרגע בחלון (viewport) - לא את כל העמוד הגלילי.
 */
export async function captureViewport() {
  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(document.body, {
      backgroundColor: null,
      useCORS: true,
      logging: false,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });
    return { dataUrl: await canvasToDataUrl(canvas), width: canvas.width, height: canvas.height };
  } catch (e) {
    console.error('captureViewport failed:', e);
    return null;
  }
}

/** ממיר data URL (data:image/png;base64,....) ל-{ mimeType, data } לשליחה ל-API. */
export function dataUrlToParts(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}
