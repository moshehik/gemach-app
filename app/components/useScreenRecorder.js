'use client';

import { useState, useRef, useCallback } from 'react';

const MAX_SECONDS = 90; // ר' תוכנית Phase 4 - עצירה אוטומטית לשליטה בעלות/גודל מול Gemini

// הקלטת מסך (getDisplayMedia + MediaRecorder) - נצרך גם ע"י AIFloatingWidget וגם
// ע"י ErrorReportButton. לא מבצע העלאה בעצמו - מחזיר Blob מוכן ל-uploadRecording
// (app/lib/uploadScreenRecording.js, העלאה ישירה ל-Vercel Blob).
export default function useScreenRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const resolveRef = useRef(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setSeconds(0);
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // מחזיר Promise<Blob|null> - נפתר כשההקלטה מסתיימת (עצירה ידנית, עצירה
  // אוטומטית ב-MAX_SECONDS, או שהמשתמש ביטל את שיתוף המסך מתפריט הדפדפן עצמו).
  const start = useCallback(() => {
    return new Promise(async (resolve) => {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('הדפדפן שלך אינו תומך בהקלטת מסך.');
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        streamRef.current = stream;
        chunksRef.current = [];

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: 'video/webm' }) : null;
          cleanup();
          resolveRef.current?.(blob);
          resolveRef.current = null;
        };
        // המשתמש עצר את השיתוף מתפריט הדפדפן (לא מהכפתור שלנו) - מסתכם כמו stop() רגיל.
        stream.getVideoTracks()[0].addEventListener('ended', () => stop());

        recorder.start();
        setIsRecording(true);
        setSeconds(0);
        intervalRef.current = setInterval(() => {
          setSeconds((s) => {
            const next = s + 1;
            if (next >= MAX_SECONDS) stop();
            return next;
          });
        }, 1000);
      } catch (e) {
        // המשתמש ביטל את בקשת ההרשאה לשיתוף מסך - לא שגיאה אמיתית, פשוט לא מקליטים.
        cleanup();
        resolve(null);
      }
    });
  }, [cleanup, stop]);

  return { isRecording, seconds, maxSeconds: MAX_SECONDS, start, stop };
}
