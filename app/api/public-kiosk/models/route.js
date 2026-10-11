// GET /api/public-kiosk/models?q=&category=&size=&eventDate=YYYY-MM-DD - ציבורי, קריאה בלבד. allow-list של שדות (lib/publicKiosk/catalog.js).
// eventDate נקרא רק כש-kiosk_public_show_inventory דלוק; אחרת מתעלמים ממנו ואין בתשובה שום מידע מלאי/זמינות.
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import { buildPublicModelsResponse, parseEventDateKey } from '@/lib/publicKiosk/catalog';
import { publicJson, rateLimited } from '@/lib/publicKiosk/http';

export const dynamic = 'force-dynamic';

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

export async function GET(request) {
  const limited = rateLimited(request, 'models');
  if (limited) return limited;
  const cfg = await loadPublicKioskConfig();
  if (!cfg.linkEnabled) return publicJson({ ok: false, code: 'unavailable', error: 'העמדה אינה זמינה' }, 404);
  try {
    const sp = new URL(request.url).searchParams;
    const eventDateKey = cfg.showInventory ? parseEventDateKey(sp.get('eventDate')) : null;
    if (cfg.showInventory && sp.get('eventDate') && !eventDateKey) return publicJson({ ok: false, code: 'bad_date', error: 'תאריך לא תקין' }, 400);
    const body = await buildPublicModelsResponse(cfg, {
      q: clean(sp.get('q'), 60),
      category: clean(sp.get('category'), 60),
      size: clean(sp.get('size'), 30),
      eventDateKey,
    });
    return publicJson({ ok: true, ...body }, 200, { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' });
  } catch (e) {
    console.error('public-kiosk models failed:', e && e.message ? e.message : e);
    return publicJson({ ok: false, code: 'server_error', error: 'שגיאה זמנית' }, 500);
  }
}
