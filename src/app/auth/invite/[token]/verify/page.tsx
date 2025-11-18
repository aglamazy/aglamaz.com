import InviteVerifyClient from './InviteVerifyClient';

interface InviteVerifyPageParams {
  params: Promise<{
    token: string;
  }>;
}

export default async function InviteVerifyPage({ params }: InviteVerifyPageParams) {
  const { token } = await params;

  return <InviteVerifyClient token={token} />;
}
