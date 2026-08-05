'use client';

// Thin client for the server-side PDF route (app/api/pdf/route.js). Replaces the old
// client-side, image-based PDF mechanisms (app/lib/htmlToPdf.js's html-to-image+jsPDF,
// and html2pdf.js previously used inline in app/print/alterations/page.js) - both
// rasterized the DOM to a PNG and embedded that single image into a PDF, with no real
// pagination or selectable text. This module never builds a PDF itself; it just calls the
// route and hands back a Blob/base64 string.

async function requestPdf(payload) {
  const res = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = 'שגיאה ביצירת ה-PDF';
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // response wasn't JSON (e.g. a platform-level error page) - keep the default message
    }
    throw new Error(message);
  }
  return res.blob();
}

// Used where the caller needs the PDF embedded inline (e.g. as a base64 email attachment).
export async function fetchPdfBase64(payload) {
  const blob = await requestPdf(payload);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('נכשלה קריאת ה-PDF שנוצר'));
    reader.readAsDataURL(blob);
  });
}

// Used where the caller wants the browser to save the PDF to disk directly.
export async function downloadPdf(payload, filename = 'document.pdf') {
  const blob = await requestPdf(payload);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a moment to actually start the download before revoking the
    // object URL out from under it.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
