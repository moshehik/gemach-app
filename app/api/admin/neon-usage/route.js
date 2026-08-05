import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

// Proxies the Neon control-plane API so the NEON_API_KEY never reaches the
// client. Returns current billing-period consumption plus a cost estimate
// under the Launch plan's usage-based pricing.
const NEON_API = 'https://console.neon.tech/api/v2';

// Launch-plan pricing, USD (as shown in the Neon console, 2026-08)
const PRICING = {
  cuHour: 0.106,             // $ per CU-hour of compute
  storageGbMonth: 0.35,      // $ per GB-month of storage
  restoreGbMonth: 0.20,      // $ per GB-month of instant restore
  includedTransferGb: 500,   // GB public network transfer included per project (Launch)
  freeTransferGb: 5          // GB transfer on the Free plan
};

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const key = process.env.NEON_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'NEON_API_KEY אינו מוגדר בקובץ הסביבה של השרת' }, { status: 500 });
  }
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };

  try {
    const projectsRes = await fetch(`${NEON_API}/projects`, { headers, cache: 'no-store' });
    if (!projectsRes.ok) {
      throw new Error(`Neon API החזיר ${projectsRes.status}`);
    }
    const { projects } = await projectsRes.json();
    const project = projects?.[0];
    if (!project) {
      return NextResponse.json({ error: 'לא נמצא פרויקט Neon בחשבון' }, { status: 404 });
    }

    const [detailRes, endpointsRes, branchesRes] = await Promise.all([
      fetch(`${NEON_API}/projects/${project.id}`, { headers, cache: 'no-store' }),
      fetch(`${NEON_API}/projects/${project.id}/endpoints`, { headers, cache: 'no-store' }),
      fetch(`${NEON_API}/projects/${project.id}/branches`, { headers, cache: 'no-store' })
    ]);
    const detail = (await detailRes.json()).project || {};
    const endpoints = (await endpointsRes.json()).endpoints || [];
    const branches = (await branchesRes.json()).branches || [];
    const branchName = Object.fromEntries(branches.map(b => [b.id, b.name]));

    const computeCuHours = (detail.compute_time_seconds || 0) / 3600;
    const activeHours = (detail.active_time_seconds || 0) / 3600;
    const transferGb = (detail.data_transfer_bytes || 0) / 1e9;
    const writtenGb = (detail.written_data_bytes || 0) / 1e9;
    const storageGb = (detail.synthetic_storage_size || 0) / 1e9;

    // Billing period boundaries; fall back to the calendar month
    const now = new Date();
    const periodStart = detail.consumption_period_start
      ? new Date(detail.consumption_period_start)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = detail.consumption_period_end
      ? new Date(detail.consumption_period_end)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const elapsedDays = Math.max((now - periodStart) / 86400000, 0.04);
    const totalDays = Math.max((periodEnd - periodStart) / 86400000, 1);
    const projectionFactor = Math.max(totalDays / elapsedDays, 1);

    // Compute scales with usage; storage is billed per GB-month so the current
    // size is already the monthly rate.
    const computeCost = computeCuHours * PRICING.cuHour;
    const storageCost = storageGb * PRICING.storageGbMonth;
    const costSoFar = computeCost + storageCost * (elapsedDays / totalDays);
    const projectedMonthly = computeCost * projectionFactor + storageCost;

    return NextResponse.json({
      project: { id: project.id, name: project.name, region: project.region_id },
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        elapsedDays: Math.round(elapsedDays * 10) / 10,
        totalDays: Math.round(totalDays)
      },
      usage: {
        computeCuHours: Math.round(computeCuHours * 100) / 100,
        activeHours: Math.round(activeHours * 100) / 100,
        transferGb: Math.round(transferGb * 1000) / 1000,
        writtenGb: Math.round(writtenGb * 1000) / 1000,
        storageGb: Math.round(storageGb * 100) / 100
      },
      endpoints: endpoints.map(e => ({
        id: e.id,
        branch: branchName[e.branch_id] || e.branch_id,
        minCu: e.autoscaling_limit_min_cu,
        maxCu: e.autoscaling_limit_max_cu,
        state: e.current_state,
        suspendTimeoutSeconds: e.suspend_timeout_seconds
      })),
      pricing: PRICING,
      cost: {
        computeCost: Math.round(computeCost * 100) / 100,
        storageCost: Math.round(storageCost * 100) / 100,
        costSoFar: Math.round(costSoFar * 100) / 100,
        projectedMonthly: Math.round(projectedMonthly * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error fetching Neon usage:', error);
    return NextResponse.json({ error: 'שגיאה בשליפת נתוני הצריכה מ-Neon: ' + error.message }, { status: 502 });
  }
}
