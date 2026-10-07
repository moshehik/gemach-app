// מפת שלב -> רכיב התצוגה שלו. מקור יחיד לשתי צורות הטופס (אשף שלבים: NewOrderA5; טופס רציף: LayoutContinuous) - אותם רכיבי שלב,
// אותו controller, אותם חלונות. אין תצוגה נפרדת לצורה זו או אחרת.
import StepCustomer from './StepCustomer';
import StepDates from './StepDates';
import StepDelivery from './StepDelivery';
import StepItems from './StepItems';
import StepSummary from './StepSummary';
import StepPayment from './StepPayment';

export const STEP_VIEW = { customer: StepCustomer, dates: StepDates, delivery: StepDelivery, items: StepItems, summary: StepSummary, payment: StepPayment };
