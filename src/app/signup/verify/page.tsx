import VerifySignupClient from './VerifySignupClient';

export default function VerifySignupPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.token;
  const token = Array.isArray(raw) ? raw[0] : raw || null;

  return <VerifySignupClient token={token} />;
}
