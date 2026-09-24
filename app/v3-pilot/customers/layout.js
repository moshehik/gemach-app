import PageGate from '@/app/components/PageGate';
import PilotProviders from '@/app/v3/pilot/PilotProviders';

// פיילוט v3 של כרטיס הלקוח (לא מקושר מהניווט; לא מחליף את /customers/[id]).
// אותו שער הרשאה בדיוק כמו app/customers/layout.js — "page:customers" מקטלוג ההרשאות.
export default async function V3PilotCustomersLayout({ children }) {
  return (
    <PageGate pageKey="page:customers">
      <PilotProviders>{children}</PilotProviders>
    </PageGate>
  );
}
