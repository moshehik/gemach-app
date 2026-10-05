'use client';

import { useUiVariant } from '../UiVariantContext';

// חלון "אין הרשאה" של /board לפי המתג (BD-O1): בגרסה הישנה - NoAccessMessage הקיים (כמו ב-main), בחדשה - BoardGate.
// שני הצמתים נבנים בשרת (layout.js) ומועברים כ-props; כאן נבחר רק איזה מהם מוצג.
export default function BoardGateSwitch({ legacy, next }) {
  return useUiVariant('board') === 'a5' ? next : legacy;
}
