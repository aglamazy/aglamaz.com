interface MemberInfoResponse {
  member?: { defaultLocale?: string | null };
}

export async function fetchMemberPreferredLocale(siteId: string | null): Promise<string | undefined> {
  if (!siteId) return undefined;

  try {
    const response = await fetch(`/api/user/member-info?siteId=${encodeURIComponent(siteId)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as MemberInfoResponse;
    const locale = data?.member?.defaultLocale;
    return typeof locale === 'string' ? locale : undefined;
  } catch (error) {
    console.error('[fetchMemberPreferredLocale] failed', error);
    return undefined;
  }
}
