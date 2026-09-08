# System Changes Log

## 2026-09-08: DB Connection & Missing Schema Fix

- **Issue:** The production application was failing to load orders with a `500` error (`P2022: The column Order.extraDay does not exist in the current database`). Also, it was returning only 65 settings instead of 121, indicating it was connected to an older branch of the Neon DB.
- **Cause:** Vercel's `DATABASE_URL` env var was manually overwritten on August 26, pointing to a preview branch that lacked the newest seeded settings. When updated to point back to the correct branch (`ep-rough-dawn-b1bepx3d`), the app still failed because that correct branch had never received the Prisma schema push for the recently added `extraDay` column on the `Order` model.
- **Resolution:**
  1. Updated `DATABASE_URL` in Vercel to point to `ep-rough-dawn-b1bepx3d` for Production & Preview.
  2. Triggered a manual deployment on Vercel to load the new config.
  3. Ran `npx prisma db push` against the `ep-rough-dawn-b1bepx3d` DB to sync the Prisma schema and create the missing `extraDay` column.
- **Result:** API and order pages are functioning normally again, and all 121 settings are correctly loaded.
