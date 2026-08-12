export interface JwtRegisteredClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

export interface AppClaims {
  userId: string;
  siteId: string;
  role: string;
  firstName: string;
  lastName?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  needsCredentialSetup?: boolean;
}

/**
 * Who is actually driving this request (dasi#1 v2, agentic-access-actor-model-SPEC).
 * `sub`/`AppClaims.userId` stays the PRINCIPAL — whose data/permissions this
 * token acts under. `actor` is a separate question: WHAT process is holding
 * the token right now. A human logged in via Google/Firebase OAuth is
 * `{kind: 'human'}`; an agent acting via `signAgentAccessToken` (never through
 * the human OAuth flow) is `{kind: 'agent', id: '<lane name>'}`. Optional so
 * every pre-existing token (and every consumer that doesn't care) keeps
 * working unchanged — absent `actor` is treated as human by any caller that
 * chooses to default it, never assumed agent.
 */
export interface ActorClaims {
  actor?: {
    kind: 'human' | 'agent';
    /** Required when kind is 'agent' — the fleet lane name (e.g. "Shofar", "Librarian"). Omitted for 'human'. */
    id?: string;
  };
}

export type TokenClaims = JwtRegisteredClaims & AppClaims & ActorClaims;

/**
 * Derive a write-path actor `{kind, id}` from verified token claims — the one
 * place this mapping happens, so every route/service agrees on it. Absent
 * `actor` (every pre-agent-mint token, and any human token that never set
 * it) defaults to human/`sub`, never agent — an agent identity must be
 * explicit, never inferred.
 */
export function actorFromClaims(claims: Pick<TokenClaims, 'sub' | 'actor'>): { kind: 'human' | 'agent'; id: string } {
  if (claims.actor?.kind === 'agent' && claims.actor.id) {
    return { kind: 'agent', id: claims.actor.id };
  }
  if (!claims.sub) {
    throw new Error('actorFromClaims: token has neither actor.id (agent) nor sub (human) — cannot attribute a write');
  }
  return { kind: 'human', id: claims.sub };
}

/** Build claims for an AGENT-minted access token — see {@link ActorClaims}. */
export function buildAgentAccessClaims(app: AppClaims, actorId: string, ttlSec: number): TokenClaims {
  return {
    sub: app.userId,
    aud: 'FamilyNet',
    iat: nowSeconds(),
    exp: inSeconds(ttlSec),
    ...app,
    actor: { kind: 'agent', id: actorId },
  };
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const inSeconds = (sec: number) => nowSeconds() + sec;

/** Build claims for access tokens. */
export function buildAccessClaims(app: AppClaims, ttlSec: number): TokenClaims {
  return {
    sub: app.userId,
    aud: "FamilyNet",
    iat: nowSeconds(),
    exp: inSeconds(ttlSec),
    ...app,
  };
}

/** Build claims for refresh tokens. */
export function buildRefreshClaims(app: AppClaims, days = 30, jti: string): TokenClaims {
  return {
    iss: process.env.JWT_ISSUER,
    sub: app.userId,
    aud: "refresh",
    iat: nowSeconds(),
    exp: inSeconds(days * 24 * 60 * 60),
    jti,
    ...app,
  };
}
