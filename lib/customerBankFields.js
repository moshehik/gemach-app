// נקודת כניסה אחת לשרת (POST /api/customers, PUT /api/customers/[id]) לשדות הבנק של הלקוח (customer_bank_fields_enabled).
// קובץ נפרד כדי שה-routes יצטרכו שורת import אחת חדשה בלבד (פחות התנגשויות מיזוג עם שינויים אחרים באותם routes).
export { customerBankFieldsEnabled, CUSTOMER_BANK_FIELD_KEYS } from './customerRequiredFields.js';
export { validateCustomerBankFields } from './customerValidation.js';
