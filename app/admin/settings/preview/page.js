'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Placeholder shown when a variation component fails to load (still under construction).
function buildingPlaceholder(label) {
  function BuildingPlaceholder() {
    return <div>בבנייה... ({label})</div>;
  }
  BuildingPlaceholder.displayName = `BuildingPlaceholder(${label})`;
  return BuildingPlaceholder;
}

// Lazy loading all 10 Windows 11 style variations
const Win_Classic = dynamic(() => import('./components/Win_Classic').catch(() => buildingPlaceholder('Win_Classic')), { ssr: false });
const Win_Dark = dynamic(() => import('./components/Win_Dark').catch(() => buildingPlaceholder('Win_Dark')), { ssr: false });
const Win_Grouped = dynamic(() => import('./components/Win_Grouped').catch(() => buildingPlaceholder('Win_Grouped')), { ssr: false });
const Win_Elevated = dynamic(() => import('./components/Win_Elevated').catch(() => buildingPlaceholder('Win_Elevated')), { ssr: false });
const Win_Fluent = dynamic(() => import('./components/Win_Fluent').catch(() => buildingPlaceholder('Win_Fluent')), { ssr: false });
const Win_Compact = dynamic(() => import('./components/Win_Compact').catch(() => buildingPlaceholder('Win_Compact')), { ssr: false });
const Win_Accent = dynamic(() => import('./components/Win_Accent').catch(() => buildingPlaceholder('Win_Accent')), { ssr: false });
const Win_NoSidebar = dynamic(() => import('./components/Win_NoSidebar').catch(() => buildingPlaceholder('Win_NoSidebar')), { ssr: false });
const Win_HighContrast = dynamic(() => import('./components/Win_HighContrast').catch(() => buildingPlaceholder('Win_HighContrast')), { ssr: false });
const Win_Soft = dynamic(() => import('./components/Win_Soft').catch(() => buildingPlaceholder('Win_Soft')), { ssr: false });

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

  const activeTabInfo = TABS.find(t => t.id === activeTabId) || TABS[0];
  const ActiveComponent = activeTabInfo.component;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>מעבדת תצוגה - סגנון Windows 11</h1>
          <div className="page-desc">נבחרו 10 סגנונות חדשים בהשראת מסך ההגדרות של ווינדוס</div>
        </div>
        <div className="page-actions">
          <span className="badge badge-primary">מסך נוכחי: <strong>{activeTabInfo.name}</strong></span>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        <div className="pill-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={activeTabId === tab.id ? 'pill-tab active' : 'pill-tab'}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      <div className="callout callout-info" style={{ marginBottom: '20px' }}>
        <svg className="icon"><use href="#i-info" /></svg>
        מסך תצוגה מקדימה בלבד — כל לשונית מציגה חלופת עיצוב מלאה למסך אחר באפליקציה; דגימות התוכן בכל חלופה עדיין בבנייה.
      </div>

      <div className="table-wrap">
        <ActiveComponent />
      </div>
    </>
  );
}
