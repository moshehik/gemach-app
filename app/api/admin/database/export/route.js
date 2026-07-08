import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma'; // Assuming standard path

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. Fetch data from all major tables
    const customers = await prisma.customer.findMany();
    const orders = await prisma.order.findMany();
    const orderItems = await prisma.orderItem.findMany();
    const payments = await prisma.payment.findMany();
    const paymentObligations = await prisma.paymentObligation.findMany();
    const dressModels = await prisma.dressModel.findMany();
    const dressItems = await prisma.dressItem.findMany();
    const employees = await prisma.employee.findMany();
    const shifts = await prisma.shift.findMany();
    const systemSettings = await prisma.systemSetting.findMany();
    const priceLists = await prisma.priceList.findMany();
    const priceRules = await prisma.priceRule.findMany();

    // 2. Assemble into a single backup object
    const backupData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        dbMode: globalThis.activeDbMode || "production"
      },
      data: {
        customers,
        orders,
        orderItems,
        payments,
        paymentObligations,
        dressModels,
        dressItems,
        employees,
        shifts,
        systemSettings,
        priceLists,
        priceRules
      }
    };

    // 3. Stringify the data
    const jsonString = JSON.stringify(backupData, null, 2);

    // 4. Return as a downloadable file
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `gemach_backup_${dateStr}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting database:', error);
    return NextResponse.json({ error: 'Failed to export database' }, { status: 500 });
  }
}
