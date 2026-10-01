// דף הבית: מעטפת דקה שבוחרת בין הדף הנוכחי (LegacyHome — הועבר 1:1 מהקובץ הזה) לדף הבית החדש (HomeA5)
// לפי הדגל ui_variant_home (useUiVariant('home')). ברירת מחדל 'legacy' = האתר זהה לקודם.
import HomeSwitch from './components/home/HomeSwitch';

export default function HomePage() {
  return <HomeSwitch />;
}
