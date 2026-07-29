'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy loading all 10 Windows 11 style variations
const Win_Classic = dynamic(() => import('./components/Win_Classic').catch(() => () => <div>בבנייה... (Win_Classic)</div>), { ssr: false });
const Win_Dark = dynamic(() => import('./components/Win_Dark').catch(() => () => <div>בבנייה... (Win_Dark)</div>), { ssr: false });
const Win_Grouped = dynamic(() => import('./components/Win_Grouped').catch(() => () => <div>בבנייה... (Win_Grouped)</div>), { ssr: false });
const Win_Elevated = dynamic(() => import('./components/Win_Elevated').catch(() => () => <div>בבנייה... (Win_Elevated)</div>), { ssr: false });
const Win_Fluent = dynamic(() => import('./components/Win_Fluent').catch(() => () => <div>בבנייה... (Win_Fluent)</div>), { ssr: false });
const Win_Compact = dynamic(() => import('./components/Win_Compact').catch(() => () => <div>בבנייה... (Win_Compact)</div>), { ssr: false });
const Win_Accent = dynamic(() => import('./components/Win_Accent').catch(() => () => <div>בבנייה... (Win_Accent)</div>), { ssr: false });
const Win_NoSidebar = dynamic(() => import('./components/Win_NoSidebar').catch(() => () => <div>בבנייה... (Win_NoSidebar)</div>), { ssr: false });
const Win_HighContrast = dynamic(() => import('./components/Win_HighContrast').catch(() => () => <div>בבנייה... (Win_HighContrast)</div>), { ssr: false });
const Win_Soft = dynamic(() => import('./components/Win_Soft').catch(() => () => <div>בבנייה... (Win_Soft)</div>), { ssr: false });

const TABS = [
  { id: 'win_classic', name: 'Win11 קלאסי (תואם מסך)', component: Win_Classic },
  { id: 'win_dark', name: 'Win11 מצב כהה (Dark)', component: Win_Dark },
  { id: 'win_grouped', name: 'Win11 מקובץ (Grouped)', component: Win_Grouped },
  { id: 'win_elevated', name: 'Win11 צללים (Elevated)', component: Win_Elevated },
  { id: 'win_fluent', name: 'Win11 זכוכית (Fluent)', component: Win_Fluent },
  { id: 'win_compact', name: 'Win11 צפוף (Compact)', component: Win_Compact },
  { id: 'win_accent', name: 'Win11 הדגשות צבע', component: Win_Accent },
  { id: 'win_nosidebar', name: 'Win11 ללא סרגל צד', component: Win_NoSidebar },
  { id: 'win_highcontrast', name: 'Win11 קונטרסט גבוה', component: Win_HighContrast },
  { id: 'win_soft', name: 'Win11 רך ועגול', component: Win_Soft },
];

export default function PreviewPage() {
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);

  const ActiveComponent = TABS.find(t => t.id === activeTabId)?.component || Win_Classic;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" dir="rtl">
      
      {/* Top Preview Control Bar */}
      <div className="bg-white border-b border-slate-300 p-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex flex-col gap-4">
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-slate-800">מעבדת תצוגה - סגנון Windows 11</h1>
              <p className="text-sm text-slate-500">נבחרו 10 סגנונות חדשים בהשראת מסך ההגדרות של ווינדוס</p>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium border border-blue-200 text-blue-800">
              מסך נוכחי: <span className="font-bold">{TABS.find(t => t.id === activeTabId)?.name}</span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`
                  px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border
                  ${activeTabId === tab.id 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}
                `}
              >
                {tab.name}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Component Render Area */}
      <div className="relative isolate">
        <div className="w-full min-h-[calc(100vh-140px)] bg-slate-50">
          <ActiveComponent />
        </div>
      </div>

    </div>
  );
}
