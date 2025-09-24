"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { CheckCircle, Clock, ExternalLink, Frown, Loader2, LogIn, ShieldX } from 'lucide-react';

type InviteStatus =
  | 'loading'
  | 'ready'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'not-found'
  | 'accepted'
  | 'already-member'
  | 'error';

interface InviteInfo {
  siteId: string;
  siteName: string | null;
  inviterName: string | null;
  expiresAt: string;
  status: string;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const { t } = useTranslation();
  const router = useRouter();
  const { user, checkAuth } = useUserStore();
  const memberStore = useMemberStore();
  const siteInfo = useSiteStore((state) => state.siteInfo);

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    checkAuth().catch(() => {
      // ignore errors; handled via UI states
    });
  }, [checkAuth]);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const res = await fetch(`/api/invite/${token}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!isActive) return;

        if (!res.ok) {
          if (data?.invite) {
            setInvite(data.invite as InviteInfo);
          }
          switch (data?.code) {
            case 'invite/expired':
              setStatus('expired');
              break;
            case 'invite/used':
              setStatus('used');
              break;
            case 'invite/revoked':
              setStatus('revoked');
              break;
            case 'invite/not-found':
              setStatus('not-found');
              break;
            default:
              setStatus('error');
              setError(typeof data?.error === 'string' ? data.error : t('inviteLoadFailed'));
              break;
          }
          return;
        }

        setInvite(data.invite as InviteInfo);
        setStatus('ready');
      } catch (err) {
        console.error(err);
        if (!isActive) return;
        setStatus('error');
        setError(t('inviteLoadFailed'));
      }
    })();
    return () => {
      isActive = false;
    };
  }, [token, t]);

  const handleLogin = () => {
    router.push(`/login?redirect=/invite/${token}`);
  };

  const handleAccept = async () => {
    if (!user?.user_id) {
      handleLogin();
      return;
    }
    setAccepting(true);
    setError('');
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleLogin();
        return;
      }
      if (!res.ok) {
        switch (data?.code) {
          case 'invite/expired':
            setStatus('expired');
            break;
          case 'invite/used':
            setStatus('used');
            break;
          case 'invite/revoked':
            setStatus('revoked');
            break;
          case 'invite/already-member':
            setStatus('already-member');
            break;
          case 'invite/not-found':
            setStatus('not-found');
            break;
          default:
            setError(typeof data?.error === 'string' ? data.error : t('inviteAcceptFailed'));
            setStatus('error');
            break;
        }
        return;
      }

      setStatus('accepted');
      const member = data?.member;
      const siteId = member?.siteId || invite?.siteId;
      const currentUser = useUserStore.getState().user;
      if (siteId && currentUser?.user_id) {
        await memberStore.fetchMember(currentUser.user_id, siteId);
      }
    } catch (err) {
      console.error(err);
      setError(t('inviteAcceptFailed'));
      setStatus('error');
    } finally {
      setAccepting(false);
    }
  };

  const siteName = useMemo(() => invite?.siteName || siteInfo?.name || '', [invite?.siteName, siteInfo?.name]);

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center gap-4 text-sage-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>{t('inviteChecking')}</p>
        </div>
      );
    }

    if (status === 'accepted') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <CheckCircle className="w-12 h-12 text-emerald-500" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteSuccessTitle', { site: siteName })}</h1>
          <p className="text-sage-600">{t('inviteSuccessDescription')}</p>
          <Button onClick={() => router.push('/app')} className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            {t('goToDashboard')}
          </Button>
        </div>
      );
    }

    if (status === 'already-member') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <CheckCircle className="w-12 h-12 text-sage-500" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteAlreadyMemberTitle')}</h1>
          <p className="text-sage-600">{t('inviteAlreadyMemberMessage')}</p>
          <Button onClick={() => router.push('/app')} className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            {t('goToDashboard')}
          </Button>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <Clock className="w-12 h-12 text-amber-500" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteExpiredTitle')}</h1>
          <p className="text-sage-600">{t('inviteExpiredMessage')}</p>
        </div>
      );
    }

    if (status === 'used') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <LogIn className="w-12 h-12 text-sage-500" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteUsedTitle')}</h1>
          <p className="text-sage-600">{t('inviteUsedMessage')}</p>
        </div>
      );
    }

    if (status === 'revoked') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <ShieldX className="w-12 h-12 text-red-500" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteRevokedTitle')}</h1>
          <p className="text-sage-600">{t('inviteRevokedMessage')}</p>
        </div>
      );
    }

    if (status === 'not-found') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <Frown className="w-12 h-12 text-red-400" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteNotFoundTitle')}</h1>
          <p className="text-sage-600">{t('inviteNotFoundMessage')}</p>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="flex flex-col items-center text-center gap-4">
          <Frown className="w-12 h-12 text-red-400" />
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteErrorTitle')}</h1>
          <p className="text-sage-600">{error || t('inviteErrorMessage')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-sage-700">{t('inviteWelcomeTitle', { site: siteName })}</h1>
          <p className="text-sage-600">{t('inviteWelcomeMessage')}</p>
          {invite?.inviterName && (
            <p className="text-sm text-sage-500">{t('inviteInvitedBy', { name: invite.inviterName })}</p>
          )}
          <p className="text-sm text-sage-500">{t('inviteExpiresAt', { time: formatDateTime(invite?.expiresAt || null) })}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!user?.user_id && (
            <Button onClick={handleLogin} className="bg-white text-sage-700 border border-sage-300 hover:bg-sage-50">
              <LogIn className="w-4 h-4" />
              {t('inviteLoginButton')}
            </Button>
          )}
          <Button onClick={handleAccept} disabled={accepting} className="flex items-center gap-2">
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('inviteAccepting')}
              </>
            ) : (
              <>{t('acceptInvite')}</>
            )}
          </Button>
        </div>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <Card className="shadow-lg border border-sage-100">
          <CardContent className="pt-8 pb-10 px-6">{renderContent()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
