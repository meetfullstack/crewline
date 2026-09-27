import type { Role } from '../generated/prisma/enums.js';

/** Claims carried in the access token. */
export interface AccessTokenPayload {
  sub: string;
  org: string;
  role: Role;
}

/** The authenticated caller, attached to `req.user` by the JWT strategy. */
export interface AuthUser {
  id: string;
  organizationId: string;
  role: Role;
}

export const ACCESS_COOKIE = 'cl_access';
export const REFRESH_COOKIE = 'cl_refresh';
/** Non-secret hint readable by the web proxy: "a session probably exists". */
export const SESSION_HINT_COOKIE = 'cl_session';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;
