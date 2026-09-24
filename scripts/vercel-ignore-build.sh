#!/bin/bash
# "Ignored Build Step" של Vercel (מוגדר ב-vercel.json -> ignoreCommand), משותף לשני
# פרויקטי Vercel של הריפו (הגמח הראשי gemach-app-uyh4 + נווה יעקב gmach-neve-yaakov).
# קוד יציאה: 0 = לדלג על ה-build, 1 = לבנות (כל קוד אחר נחשב "לבנות").
#
# למה: על תוכנית Hobby יש תקרה של 100 deployments ליום לכל החשבון, ושני הפרויקטים בונים
# כל push (פעמיים!) - כולל קומיט תיעוד בלבד וענפי-תיקון של הבוט שמיועדים לגמח אחד בלבד.
# ר' docs/vercel-resource-audit-2026-09-20.md. ברירת המחדל תמיד "לבנות" - הדילוג רק
# כשבטוח שאין מה לבנות.
#
# לכפות build בכל זאת (למשל retry אחרי rate-limit): להוסיף [force-deploy] להודעת הקומיט.

ref="${VERCEL_GIT_COMMIT_REF:-}"
msg="${VERCEL_GIT_COMMIT_MESSAGE:-}"
# מזהה הפרויקט: ה-production URL/URL של כל פרויקט מכיל את שמו (uyh4 = הגמח הראשי).
ident="${VERCEL_PROJECT_PRODUCTION_URL:-}${VERCEL_URL:-}"

if [[ "$msg" == *"[force-deploy]"* ]]; then
  echo "ignore-build: [force-deploy] in commit message -> build"
  exit 1
fi

# 0. ענפי redesign/* (פרויקט העיצוב-מחדש v3) - לא בונים אוטומטית, כדי לא לשרוף את מכסת ה-100 deploys ליום.
#    לפריוויו: [force-deploy] בהודעת הקומיט.
if [[ "$ref" == redesign/site-v3-* ]]; then
  echo "ignore-build: redesign v3 branch ($ref) -> skip (use [force-deploy] for a preview)"
  exit 0
fi

# 1. ענף-תיקון של סוכן התיקון האוטומטי שמיועד לנווה יעקב (fix-reports/org2-*) - Preview רלוונטי רק
#    בפרויקט של נווה יעקב. על main שני הפרויקטים ממשיכים לבנות כרגיל (קוד משותף).
if [[ "$ref" == fix-reports/org2-* && "$ident" == *uyh4* ]]; then
  echo "ignore-build: org2 fix branch ($ref) on the main-gemach project -> skip"
  exit 0
fi

# 2. קומיט שלא נגע בשום דבר שנכנס ל-build (תיעוד, scripts, .github, .claude, docs...) - דילוג.
#    app/version.json ו-package.json מתעדכנים אוטומטית בכל קומיט (scripts/update_build_time.js),
#    לכן app/version.json מוחרג במפורש, ו-package.json לא ברשימה (שינוי תלויות עובר דרך package-lock.json).
if git rev-parse --verify -q HEAD^ >/dev/null 2>&1; then
  if git diff --quiet HEAD^ HEAD -- app components lib prisma public package-lock.json next.config.mjs middleware.js jsconfig.json vercel.json ':(exclude)app/version.json'; then
    echo "ignore-build: no build-relevant files changed in HEAD -> skip"
    exit 0
  fi
fi

echo "ignore-build: build-relevant change -> build"
exit 1
