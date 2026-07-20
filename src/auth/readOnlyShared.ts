import type { TokenClaims } from './tokens';

export const READ_ONLY_ACCESS_TOKEN = 'read_only_access_token';
export const READ_ONLY_AUDIENCE = 'famcircle-read-only';
export const READ_ONLY_TOKEN_TTL_SECONDS = 4 * 60 * 60;

export interface ReadOnlyAccessTokenClaims extends TokenClaims {
  memberId: string;
  scope: 'read-only';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isReadOnlyAccessTokenClaims(payload: TokenClaims): payload is ReadOnlyAccessTokenClaims {
  const typed = payload as ReadOnlyAccessTokenClaims;
  return (
    isNonEmptyString(typed.userId) &&
    isNonEmptyString(typed.siteId) &&
    isNonEmptyString(typed.memberId) &&
    typed.sub === typed.memberId &&
    typed.userId === typed.memberId &&
    typed.scope === 'read-only' &&
    typed.aud === READ_ONLY_AUDIENCE
  );
}

