import ModelNewSwitch from '@/app/components/dress-new/ModelNewSwitch';

// /dashboard/dresses/new - מסך "דגם חדש". נתיב סטטי משלו (קודם הוגש מ-[id]/page.js כענף id === 'new'); Next מעדיף מקטע סטטי על דינמי,
// כך שכרטיס הדגם ([id]) לא צריך לדעת עליו. הבחירה ישן / חדש: ModelNewSwitch.
export default function NewDressPage() {
  return <ModelNewSwitch />;
}
