import { NextResponse } from 'next/server';

import { cookies } from 'next/headers';

import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  let employeeId = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (token && token.value) {
      employeeId = token.value;
    }
  } catch(e) {}

  let queryText = '';

  try {
    const { query, params = [] } = await request.json();
    queryText = query;
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Execute raw SQL query. 
    // Notice: $queryRawUnsafe is used because the query string is fully dynamic.
    const result = await prisma.$queryRawUnsafe(query, ...params);
    
    // Log success
    try {
      await prisma.queryLog.create({
        data: {
          query: queryText,
          success: true,
          employeeId: employeeId
        }
      });
    } catch(err) { console.error('Failed to log query:', err); }

    // Some PRISMA queries (like PRAGMA) might return bigints. Convert bigints to strings to avoid JSON serialization errors.
    const serializedResult = JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    
    return new NextResponse(serializedResult, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('SQL Query Error:', error);
    
    // Log error
    if (queryText) {
      try {
        await prisma.queryLog.create({
          data: {
            query: queryText,
            success: false,
            errorMsg: error.message,
            employeeId: employeeId
          }
        });
      } catch(err) { console.error('Failed to log query error:', err); }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
