import VerifySignupClient from './VerifySignupClient';

export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const raw = resolvedSearchParams?.token;
  const token = Array.isArray(raw) ? raw[0] : raw || null;

  return <VerifySignupClient token={token} />;
}
