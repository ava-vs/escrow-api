// Auth utilities for Cloudflare Workers

export interface JwtPayload {
  sub: string;
  email: string;
  type: string;
}

export function getUserFromContext(c: any): JwtPayload {
  const jwtPayload = c.get('user') as JwtPayload;
  if (!jwtPayload) {
    throw new Error('User not found in context');
  }
  return jwtPayload;
}