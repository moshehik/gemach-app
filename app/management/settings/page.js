import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'ניהול הגדרות מנהל',
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 dir-rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ניהול הגדרות מערכת</h1>
            <p className="text-gray-600">שליטה באפשרויות והתנהגות המערכת השוטפת</p>
          </div>
        </div>
        
        <SettingsClient />
      </div>
    </div>
  );
}
