import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'הגדרות מערכת',
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 dir-rtl" style={{ background: 'var(--bg-color)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>הגדרות מערכת (ניהול הנהלה)</h1>
            <p style={{ color: 'var(--text-muted)' }}>שליטה באפשרויות והתנהגות המערכת השוטפת</p>
          </div>
        </div>
        
        <SettingsClient />
      </div>
    </div>
  );
}
