import { TokenClaims } from '@/auth/tokens';
export interface RouteParams {
  siteId?: string;
}

export interface MemberDoc {
  uid: string;
  siteId: string;
  role?: string;
  [k: string]: unknown;
}

export interface GuardContext {
  params?: RouteParams;
  decoded_payload?: TokenClaims;
  member?: MemberDoc;
}

export type RouteHandler = (request: Request, context: GuardContext) => Response | Promise<Response>;
