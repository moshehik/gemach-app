// העלאת הקלטת מסך (צד לקוח בלבד) - משמש AIFloatingWidget (useScreenRecorder.js).
// עובר דרך app/api/upload/route.js (אותו נתיב שמשמש תמונות דגם) - sharp פשוט
// לא מפענח וידאו ונופל לשמירת הקובץ המקורי כמו שהוא ב-DB (ר' lib/dressImageStorage.js).
export async function uploadScreenRecording(blob) {
  const fileName = `recording-${Date.now()}.webm`;
  const formData = new FormData();
  formData.append('file', new File([blob], fileName, { type: 'video/webm' }));
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'שגיאת העלאה');
  return data.imageUrl;
}
