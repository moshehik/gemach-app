// pkRegistry.js - רישום מסמכי ההדפסה / ה-PDF. הוספת מסך חדש (הזמנות, לקוחות...) = בונה מסמך אחד ב-pkSpecs.js (או קובץ חדש) + שורה אחת כאן
// + שם משטח (surface) ב-lib/printAccessKeys.js (PDF_HTML_SURFACE_KEYS) עם מפתחות ההרשאה של הדף, שבלעדיו POST /api/pdf דוחה את ההורדה.
//
//   id        מזהה המסמך (openPrintPreview({ doc: id, ... }))
//   build     (data, ctx) -> מודל מסמך (ר' pkSpecs.js)
//   surface   שם המשטח בשרת (הרשאת ה-PDF); חייב להופיע ב-PDF_HTML_SURFACE_KEYS
import {
  customersListDoc, employeesListDoc, modelCardDoc, modelItemsDoc, modelLabelsDoc, modelRentalsDoc, modelsListDoc, ordersListDoc,
} from './pkSpecs.js';
import { departmentsDoc, emailLogDoc } from './pkSpecsAdmin.js';
import { auditLogDoc, visitLogDoc } from './pkSpecsHistory.js';

export const PRINT_DOCS = {
  'employees-list': { build: employeesListDoc, surface: 'a5-employees-list' },
  'models-list': { build: modelsListDoc, surface: 'a5-models-list' },
  'model-card': { build: modelCardDoc, surface: 'a5-model-card' },
  'model-items': { build: modelItemsDoc, surface: 'a5-model-card' },
  'model-rentals': { build: modelRentalsDoc, surface: 'a5-model-card' },
  'model-labels': { build: modelLabelsDoc, surface: 'a5-model-card' },
  'orders-list': { build: ordersListDoc, surface: 'a5-orders-list' },
  'customers-list': { build: customersListDoc, surface: 'a5-customers-list' },
  // יומן שליחת מיילים / מחלקות ועובדים (11.10.2026, pkSpecsAdmin.js): שניהם מאזור הניהול -> אותו משטח כמו האזור (page:admin)
  'email-log': { build: emailLogDoc, surface: 'a5-email-log' },
  'departments-employees': { build: departmentsDoc, surface: 'a5-departments' },
  // יומן שינויים (היסטוריית נתונים) / יומן שאילתות ו-API (pkSpecsHistory.js): שניהם מאזור הניהול -> אותו משטח כמו האזור (page:admin)
  'data-history': { build: auditLogDoc, surface: 'a5-data-history' },
  'visit-log': { build: visitLogDoc, surface: 'a5-management-history' },
};
