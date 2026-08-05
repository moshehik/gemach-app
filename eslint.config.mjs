import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },
  {
    // תוסף היומן ב-app/lib/prisma.js כבר רושם שורת AuditLog לכל create/update/delete.
    // רישום ידני על אותה כתיבה מייצר שורה כפולה בהיסטוריה — באג שחזר על עצמו כמה פעמים.
    // הכלל חוסם רישום ידני כברירת מחדל; לשימושים הלגיטימיים (updateMany, שלא עובר דרך
    // התוסף, או פעולה שאין מאחוריה כתיבה כלל) מוסיפים eslint-disable-next-line עם הסבר.
    files: ["app/**/*.js", "lib/**/*.js", "components/**/*.js"],
    ignores: ["app/lib/prisma.js"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name=/^(create|createMany)$/][callee.object.property.name='auditLog']",
        message: "אין לרשום AuditLog ידנית לצד כתיבה רגילה — התוסף ב-app/lib/prisma.js כבר רושם אותה, והתוצאה היא שורה כפולה. השתמש ב-auditAs(action, args, changes). אם הכתיבה היא updateMany (או שאין כתיבה כלל) — הוסף eslint-disable-next-line no-restricted-syntax עם הסבר."
      }]
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.js",
    "scripts/**",
    "scratch/**",
    // Isolated git worktrees for background agents - not part of this branch's tree.
    ".claude/worktrees/**"
  ]),
]);

export default eslintConfig;
