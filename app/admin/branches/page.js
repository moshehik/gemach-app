import BranchesManager from '@/app/components/branches/BranchesManager';

export const metadata = { title: 'סניפים' };

// /admin/branches - ניהול סניפים (הנהלה ראשית / מתכנת: השער ב-app/admin/layout.js). docs/branches-plan.md, שלב א.
export default function BranchesPage() {
  return <BranchesManager />;
}
