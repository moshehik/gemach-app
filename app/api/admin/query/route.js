import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { query, params = [] } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Execute raw SQL query. 
    // Notice: $queryRawUnsafe is used because the query string is fully dynamic.
    const result = await prisma.$queryRawUnsafe(query, ...params);
    
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
