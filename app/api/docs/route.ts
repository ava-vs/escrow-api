import { getApiDocs } from '@/lib/swagger';
import { NextResponse } from 'next/server';
import { withCors, corsResponse } from '@/lib/cors';

/**
 * API endpoint to serve Swagger specification
 */
export const GET = withCors(async function GET() {
  return corsResponse(getApiDocs());
});
