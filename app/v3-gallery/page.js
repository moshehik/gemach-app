// גלריית רכיבי v3 — לפיתוח בלבד (404 בפרודקשן).
import { notFound } from 'next/navigation';
import Gallery from './Gallery';

export const metadata = { title: 'v3 gallery' };

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery />;
}
