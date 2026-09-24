'use client';
// v3: עוטף את V3NotifyProvider כך שכפתור "פתח" בשורת ההתראה ינווט client-side (router.push) ולא בטעינה מלאה.
// layout.js הוא Server Component ולכן אינו יכול להעביר פונקציית onNavigate ישירות.
import { useRouter } from 'next/navigation';
import { V3NotifyProvider, V3MessagesToast } from '../v3/notify';

export default function V3NotifyHost({ children }) {
  const router = useRouter();
  return (
    <V3NotifyProvider onNavigate={(href) => router.push(href)}>
      {children}
      <V3MessagesToast />
    </V3NotifyProvider>
  );
}
