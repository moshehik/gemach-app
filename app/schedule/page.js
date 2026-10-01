import ScheduleDay from '@/app/components/schedule/ScheduleDay';

// הלו״ז היומי - הדף עצמו הוא רכיב לקוח שמושך GET /api/schedule (ר' app/components/schedule/ScheduleDay.js).
export default function SchedulePage() {
  return <ScheduleDay />;
}
