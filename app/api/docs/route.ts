import { getApiDocs } from '@/lib/swagger';
import { NextResponse } from 'next/server';

/**
 * API endpoint to serve Swagger specification
 */
export async function GET() {
  return NextResponse.json(getApiDocs());
}
