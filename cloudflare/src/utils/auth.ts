// Auth utilities for Cloudflare Workers

export interface JwtPayload {
  sub: string;
  email: string;
  type: string;
}

export function getUserFromContext(c: any): JwtPayload {
  const jwtPayload = c.get('jwtPayload') as JwtPayload;
  return jwtPayload;
}