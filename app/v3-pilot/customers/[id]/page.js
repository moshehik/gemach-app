'use client';
// /v3-pilot/customers/[id] — פיילוט v3 (A2) של כרטיס הלקוח. `id` = UUID של הלקוח (כמו /customers/[id]); 'new' = יצירה.
// כל הלוגיקה: app/v3/pilot/customer/CustomerCardV3.js. אותם endpoints ו-payloads כמו העמוד הקיים.
import { use } from 'react';
import CustomerCardV3 from '@/app/v3/pilot/customer/CustomerCardV3';

export default function V3PilotCustomerPage({ params }) {
  const { id } = use(params);
  return <CustomerCardV3 key={id} id={id} />;
}
