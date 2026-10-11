'use client';

// הגרסה הישנה של מסך "דגם חדש" (/dashboard/dresses/new), קפואה: האשף עצמו - components/dresses/modern/ModernNewDressWizard.js - נשאר בלי שינוי
// (byte-identical ל-main); כאן רק העטיפה שהייתה בענף isNewModel של app/dashboard/dresses/[id]/page.js: טעינת ההגדרות / הקטגוריות / המיקומים
// והניווט אחרי ביטול / יצירה (כולל ה-alert על פריטים שנכשלו - זו ההתנהגות הישנה, בלי לשנות).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ModernNewDressWizard from '../../../components/dresses/modern/ModernNewDressWizard';
import { getSettingsCached } from '@/app/lib/pageCache';

const parseSettings = (data) => {
  const obj = { useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' };
  if (Array.isArray(data)) {
    data.forEach(s => { if (s.key) obj[s.key] = s.value; });
  } else if (data) {
    Object.assign(obj, data);
  }
  return obj;
};

export default function LegacyNewDressPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' });
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState(['חנות', 'רזרבה', 'מחסן']);

  useEffect(() => {
    getSettingsCached()
      .then(data => {
        const obj = parseSettings(data);
        setSettings(obj);
        if (obj.item_locations) setLocations(obj.item_locations.split(',').map(l => l.trim()).filter(Boolean));
      })
      .catch(err => console.error('Failed to load settings', err));
    fetch('/api/pricelists/categories')
      .then(res => res.ok ? res.json() : [])
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load categories', err));
  }, []);

  return (
    <ModernNewDressWizard
      useModelNames={settings.useModelNames !== 'false'}
      showImages={settings.hide_dress_images !== 'true'}
      categories={categories}
      locations={locations}
      onCancel={() => router.push('/dashboard/dresses')}
      onCreated={(created, failedItems) => {
        if (failedItems?.length) {
          alert(`הדגם נוצר, אך חלק מהפריטים נכשלו:\n\n${failedItems.join('\n')}`);
        }
        router.replace(`/dashboard/dresses/${created.id}`);
      }}
    />
  );
}
