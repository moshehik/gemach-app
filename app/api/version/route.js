import { NextResponse } from 'next/server';
import packageJson from '../../../package.json';

export async function GET() {
  return NextResponse.json({
    version: packageJson.version,
    lastUpdated: packageJson.lastUpdated,
    timestamp: new Date().toISOString()
  });
}
