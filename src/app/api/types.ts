import { IToken } from "src/entities/Token";
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
  decoded_payload?: IToken;
  member?: MemberDoc;
}

export type RouteHandler = (request: Request, context: GuardContext) => Response | Promise<Response>;
