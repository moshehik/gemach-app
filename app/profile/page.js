// /profile — "הפרופיל שלי" של העובד המחובר (עיצוב מאושר 3.10.2026: תצוגות-עיצוב/פרופיל-עובד.html, רכיבי פלטה בלבד).
// הדף נטען בנפרד (dynamic) כדי שקובץ ה-CSS הגדול של הפלטה לא ייכנס ל-bundle של שאר הדפים;
// הלוגיקה והקריאות ל-API: app/components/profile/ProfilePage.js (GET/PUT /api/me/profile, POST /api/employees/<id>/password).
import ProfileSwitch from '@/app/components/profile/ProfileSwitch';

export default function MyProfileRoute() {
  return <ProfileSwitch />;
}
