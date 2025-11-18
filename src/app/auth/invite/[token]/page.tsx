import InviteSignupModal from './InviteSignupModal';

interface InvitePageParams {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageParams) {
  const { token } = await params;

  return <InviteSignupModal token={token} />;
}
