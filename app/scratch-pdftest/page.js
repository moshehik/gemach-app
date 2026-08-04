'use client';

import { useState } from 'react';

export default function ScratchPdfTest() {
  const [log, setLog] = useState([]);
  const [realHtml, setRealHtml] = useState(null);

  const append = (msg) => setLog((l) => [...l, `${Date.now()}: ${msg}`]);

  const fetchReal = async () => {
    append('fetching html...');
    const res = await fetch('/api/orders/26097/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', type: 'order', returnHtmlOnly: true })
    });
    const data = await res.json();
    setRealHtml(data.html || null);
    append('html fetched, len=' + (data.html ? data.html.length : 0));
  };

  const runNew = async () => {
    try {
      append('importing html-to-image...');
      const htmlToImage = await import('html-to-image');
      append('imported html-to-image OK');
      append('importing jspdf...');
      const { jsPDF } = await import('jspdf');
      append('imported jspdf OK');

      const element = document.createElement('div');
      element.innerHTML = realHtml;
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.zIndex = '-1';
      element.style.pointerEvents = 'none';
      document.body.appendChild(element);
      append('element appended, offsetWidth=' + element.offsetWidth + ' offsetHeight=' + element.offsetHeight);

      append('calling toPng...');
      const t0 = Date.now();
      const dataUrl = await htmlToImage.toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff' });
      append('toPng done in ' + (Date.now() - t0) + 'ms, dataUrl len=' + dataUrl.length);

      const cssWidth = element.offsetWidth;
      const cssHeight = element.offsetHeight;
      document.body.removeChild(element);

      append('building pdf...');
      const pdf = new jsPDF({ unit: 'px', format: [cssWidth, cssHeight], hotfixes: ['px_scaling'] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, cssWidth, cssHeight);
      const pdfBase64DataUri = pdf.output('datauristring');
      append('pdf built, len=' + pdfBase64DataUri.length);
    } catch (e) {
      append('ERROR: ' + (e && e.stack ? e.stack : String(e)));
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>PDF capture test v2</h1>
      <button onClick={fetchReal} data-testid="fetch-real">Fetch real order HTML</button>
      <div data-testid="real-html-len">{realHtml ? realHtml.length : 'not loaded'}</div>
      <button onClick={runNew} data-testid="run-new">Run NEW (html-to-image + jspdf)</button>
      <pre data-testid="log">{log.join('\n')}</pre>
    </div>
  );
}
