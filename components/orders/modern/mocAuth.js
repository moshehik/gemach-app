'use client';

// אימות עובד/מנהל/מתכנת מול השרת. מחזיר את פרטי המאשר או null אם בוטל/נכשל.
export const verifyPin = async (message, level) => {
  const authResult = await window.customAuthPrompt(message, level);
  if (!authResult || !authResult.pin) return null;
  try {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: level })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
      return null;
    }
    return authResult;
  } catch (err) {
    alert('שגיאה באימות מול השרת.');
    return null;
  }
};
