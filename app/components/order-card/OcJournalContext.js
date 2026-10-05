'use client';

// OcJournalContext - תשובת GET /api/orders/[id]/journal שנטענת פעם אחת בכרטיס (OrderCardA5 → useOrderJournalData) ומשותפת לציר העליון (OcStepper)
// ולשורות הפריטים ("מי לקח / מי החזיר", data.itemActors) - בלי שאילתה נוספת. null = לא נטען / נכשל (השורות מציגות רק תאריך).
import { createContext, useContext } from 'react';

export const OcJournalContext = createContext(null);
export const useOcJournal = () => useContext(OcJournalContext);
