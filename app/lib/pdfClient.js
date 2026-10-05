'use client';

// Thin client for the server-side PDF route (app/api/pdf/route.js). Replaces the old
// client-side, image-based PDF mechanisms (app/lib/htmlToPdf.js's html-to-image+jsPDF,
// and html2pdf.js previously used inline in app/print/alterations/page.js) - both
// rasterized the DOM to a PNG and embedded that single image into a PDF, with no real
// pagination or selectable text. This module never builds a PDF itself; it just calls the
// route and hands back a Blob/base64 string.

// First non-empty line of the server's `detail`, capped - toasts/alerts must stay readable.
export function shortDetail(detail, max = 160) {
  if (typeof detail !== 'string') return '';
  const line = detail.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

async function requestPdf(payload) {
  const res = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = 'שגיאה ביצירת ה-PDF';
    let full = '';
    let stage = '';
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      // The server's technical reason (e.g. "Failed to launch the browser process") is appended - short, one
      // line - so a failed click shows the real cause instead of only the generic Hebrew sentence.
      const detail = shortDetail(data?.detail);
      stage = typeof data?.stage === 'string' ? data.stage : '';
      if (typeof data?.detail === 'string') full = data.detail;
      if (detail) message += ` (${stage ? `${stage}: ` : ''}${detail})`;
    } catch {
      // response wasn't JSON (e.g. a platform-level error page) - keep the default message
    }
    const error = new Error(message);
    error.status = res.status;
    if (full) error.detail = full; // the whole server-side reason (not shortened) for logs / diagnostics
    if (stage) error.stage = stage;
    throw error;
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
