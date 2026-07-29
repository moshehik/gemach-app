import React, { useState } from 'react';
import { 
  Settings, Bell, Shield, Monitor, ChevronLeft, 
  Building2, Globe, Clock, Sun, Lock, 
  Users, Box, Paintbrush 
} from 'lucide-react';

export default function Win_Classic() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    businessName: 'גמ"ח שמלות חסד',
    language: 'he',
    theme: 'light',
    notifications: true,
  });

  const categories = [
    { id: 'general', label: 'מערכת', icon: Monitor },
    { id: 'users', label: 'משתמשים ולקוחות', icon: Users },
    { id: 'inventory', label: 'ניהול מלאי', icon: Box },
    { id: 'personalization', label: 'התאמה אישית', icon: Paintbrush },
    { id: 'time', label: 'זמן ושפה', icon: Globe },
    { id: 'privacy', label: 'פרטיות ואבטחה', icon: Shield },
    { id: 'update', label: 'עדכונים', icon: Bell },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
      default:
        return (
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-slate-800 mb-8">מערכת</h2>
            
            <SettingRow 
              icon={Monitor} 
              title="תצוגה" 
              description="צגים, בהירות, פרופיל תצוגה"
            />
            <SettingRow 
              icon={Building2} 
              title="פרטי הגמ״ח" 
              description="שם, כתובת, פרטי התקשרות"
            />
            <SettingRow 
              icon={Bell} 
              title="התראות" 
              description="התראות מאפליקציות, נא לא להפריע"
            />
            <SettingRow 
              icon={Sun} 
              title="צריכת חשמל וסוללה" 
              description="מצב שינה, צריכת חשמל, חיסכון בסוללה"
            />
            <SettingRow 
              icon={Lock} 
              title="אחסון" 
              description="שטח אחסון, כוננים, גיבויים"
            />
          </div>
        );
    }
  };

  return (
    <div dir="rtl" className="flex h-screen bg-[#f3f3f3] font-sans text-slate-800">
      {/* Sidebar */}
      <div className="w-72 bg-transparent pt-8 flex flex-col z-10">
        <div className="flex items-center gap-3 px-6 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-sm">
            ג
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{settings.businessName}</h1>
            <p className="text-sm text-slate-500">התאמה אישית של הגדרות</p>
          </div>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="חיפוש הגדרה..." 
              className="w-full bg-white/70 border-b-2 border-transparent border-b-blue-600 rounded-t-md py-2 px-3 text-sm focus:outline-none focus:bg-white transition-all placeholder:text-slate-500 shadow-sm"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 overflow-y-auto pb-6 mt-2">
          {categories.map((cat) => {
            const isActive = activeTab === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`w-full flex items-center gap-4 px-3 py-2.5 text-sm transition-all rounded-md relative ${
                  isActive 
                    ? 'bg-slate-200/70 font-semibold text-slate-900' 
                    : 'text-slate-700 hover:bg-slate-200/40 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-600 rounded-full" />
                )}
                <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-600'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-[#f3f3f3]">
        <div className="max-w-4xl mx-auto py-10 px-12">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, title, description }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-all cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className="text-slate-500 group-hover:text-blue-600 transition-colors">
          <Icon className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
        <ChevronLeft className="w-5 h-5" />
      </div>
    </div>
  );
}
