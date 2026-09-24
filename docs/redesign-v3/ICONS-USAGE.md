# שימוש באיקונים (v3)

## הרכבה (פעם אחת ב-layout)
```jsx
import IconSprite from '@/app/components/IconSprite';   // הקיים — 62 סמלים
import { IconSpriteV3 } from '@/app/v3/ui';              // ההשלמה — 12 סמלים חדשים
<IconSprite /><IconSpriteV3 />
```
`icons.css` נטען אוטומטית מ-`Icon.js`. `tokens.css` + `components.css` (`.v3-ic`) חייבים להיות טעונים.

## שימוש
```jsx
import { Icon } from '@/app/v3/ui';
<button className="v3-btn"><Icon name="send" /> שליחה</button>   {/* מונפש בריחוף/מיקוד הכפתור */}
<Icon name="success" size="lg" enter />                          {/* קפיצת כניסה בטעינה */}
<Icon name="refresh" loop />                                     {/* רציף בזמן טעינה */}
<Icon name="alert" anim="pulse" title="שגיאה" />                 {/* דריסה + תווית נגישה */}
<Icon name="close" anim={false} />                               {/* בלי אנימציה */}
```
- `name`: id בספרייט, או כינוי (`close`→x, `success`→check-circle, `error`→x-circle, `warning`→alert-tri, `delivery`→truck, `back`/`next`→chevrons, `location`→pin, `pin-fixed`→thumbtack, `print`, `add`, `delete`, `view`, `dress`, `ai`, `stats`, `offline`...). קידומת `i-`/`ic-` אופציונלית.
- `size`: `xs 12` · `sm 16` · `md 20` (ברירת מחדל, `--v3-ic`) · `lg 24` · `xl 32` · `2xl 48`.
- מחוץ ל-React: `<svg class="v3-ic" data-anim="pop"><use href="#i-check"/></svg>`.

## אנימציות
`pop draw shake wiggle ring bounce drive nudge nudge-back nudge-diag spin spin90 rewind pulse tilt flip flip-y flip180 drop rise swing snip blink fly`.
- מופעלות בריחוף/מיקוד של `.v3-btn`, `.v3-ibtn`, `button`, `a`, `[data-v3-anim-host]` או האיקון עצמו; `data-play="true"` מפעיל ידנית.
- כפתור מושבת — ללא אנימציה. `aria-busy="true"` על ההורה מריץ `spin`/`pulse` ברצף.
- טרנספורם בלבד, עקומה `--v3-ease`, משכים מ-`--v3-dur-*`. `prefers-reduced-motion` מכבה הכול.
- RTL: `nudge`/`drive`/`shake` מתהפכים אוטומטית דרך `--v3-dir`.
- `draw` בפועל הוא "ציור-קפיצה" (scale+rotate) ולא stroke-dashoffset, כי `pathLength` לא עובר דרך `<use>`.
- הדפסה (`app/print/**`) — סטטית בכוונה.

## הערות
- `i-unlock` היה חסר בספרייט המקורי — נוסף ב-`IconSpriteV3`. סמלים חדשים: send, sparkles, chart, loader, sun, moon, wifi-off, shirt, ruler, unlock, server, flask.
- ההחלפה של lucide-react והאמוג'י (ICON-INVENTORY סעיפים 4-6) — בשלב ההגירה של העמודים.
