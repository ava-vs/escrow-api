import { getApiDocs } from '@/lib/swagger';
import { NextResponse } from 'next/server';
import { withCors, corsResponse } from '@/lib/cors';
import { withApiAuth } from '@/lib/api-auth';

/**
 * API endpoint to serve Swagger specification
 */
export const GET = withCors(withApiAuth(async function GET() {
  return corsResponse(getApiDocs());
}));
