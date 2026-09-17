// העלאה ישירה מהדפדפן ל-Vercel Blob (ר' app/api/upload/client-token/route.js
// להנפקת הטוקן) - צד לקוח בלבד. משמש הן את AIFloatingWidget והן את
// ErrorReportButton להעלאת הקלטת מסך (useScreenRecorder.js).
export async function uploadScreenRecording(blob) {
  const { upload } = await import('@vercel/blob/client');
  const fileName = `recording-${Date.now()}.webm`;
  const result = await upload(fileName, blob, {
    access: 'public',
    handleUploadUrl: '/api/upload/client-token',
    contentType: 'video/webm',
  });
  return result.url;
}
