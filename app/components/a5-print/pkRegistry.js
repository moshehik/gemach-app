// pkRegistry.js - רישום מסמכי ההדפסה / ה-PDF. הוספת מסך חדש (הזמנות, לקוחות...) = בונה מסמך אחד ב-pkSpecs.js (או קובץ חדש) + שורה אחת כאן
// + שם משטח (surface) ב-lib/printAccessKeys.js (PDF_HTML_SURFACE_KEYS) עם מפתחות ההרשאה של הדף, שבלעדיו POST /api/pdf דוחה את ההורדה.
//
//   id        מזהה המסמך (openPrintPreview({ doc: id, ... }))
//   build     (data, ctx) -> מודל מסמך (ר' pkSpecs.js)
//   surface   שם המשטח בשרת (הרשאת ה-PDF); חייב להופיע ב-PDF_HTML_SURFACE_KEYS
import {
  customersListDoc, employeesListDoc, modelCardDoc, modelItemsDoc, modelLabelsDoc, modelRentalsDoc, modelsListDoc, ordersListDoc,
} from './pkSpecs.js';

export const PRINT_DOCS = {
  'employees-list': { build: employeesListDoc, surface: 'a5-employees-list' },
  'models-list': { build: modelsListDoc, surface: 'a5-models-list' },
  'model-card': { build: modelCardDoc, surface: 'a5-model-card' },
  'model-items': { build: modelItemsDoc, surface: 'a5-model-card' },
  'model-rentals': { build: modelRentalsDoc, surface: 'a5-model-card' },
  'model-labels': { build: modelLabelsDoc, surface: 'a5-model-card' },
  'orders-list': { build: ordersListDoc, surface: 'a5-orders-list' },
  'customers-list': { build: customersListDoc, surface: 'a5-customers-list' },
};
