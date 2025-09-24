import { TokenClaims } from '@/auth/tokens';
export interface RouteParams {
  siteId?: string;
  id?: string;
  token?: string;
}

export interface MemberDoc {
  uid: string;
  siteId: string;
  role?: string;
  [k: string]: unknown;
}

export interface GuardContext {
  params?: RouteParams;
  user?: TokenClaims;
  member?: MemberDoc;
}

export type RouteHandler = (request: Request, context: GuardContext) => Response | Promise<Response>;
