'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Loader from '@/components/ui/Loader';
import { useSiteStore } from "@/store/SiteStore";
import { useMemberStore } from "@/store/MemberStore";
import { useUserStore } from "@/store/UserStore";

type AuthStatus = 'refreshing' | 'success' | 'error';

export default function AuthGate() {
  const router = useRouter();
  const { t } = useTranslation();

  const { checkAuth } = useUserStore();
  const { fetchMember } = useMemberStore();
  const siteId = useSiteStore((s) => s.siteInfo?.id);

  const [status, setStatus] = useState<AuthStatus>('refreshing');
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(2);
  const originalUrlRef = useRef('/');

  useEffect(() => {
    let cancelled = false;

    const performRefresh = async () => {
      originalUrlRef.current =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/';

      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          if (!cancelled) {
            setStatus('error');
            setRedirectTarget('/app?login=1');
          }
          return;
        }

        await checkAuth();
        const user = useUserStore.getState().user;
        if (user?.user_id && siteId) {
          await fetchMember(user.user_id, siteId);
        }

        if (!cancelled) {
          setStatus('success');
          setRedirectTarget(originalUrlRef.current);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setRedirectTarget('/app?login=1');
        }
        throw err;
      }
    };

    performRefresh();

    return () => {
      cancelled = true;
    };
  }, [checkAuth, fetchMember, router, siteId]);

  useEffect(() => {
    if (!redirectTarget) {
      return;
    }

    setCountdown(2);
    const tick = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(tick);
  }, [redirectTarget]);

  useEffect(() => {
    if (!redirectTarget) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(redirectTarget);
    }, 1600);

    return () => clearTimeout(timer);
  }, [redirectTarget, router]);

  const statusContent = useMemo(() => {
    if (status === 'refreshing') {
      return {
        title: t('authGateReauthenticating') as string,
        description: t('authGateReauthenticatingHint') as string,
        icon: null,
        iconClasses: '',
      };
    }

    if (status === 'success') {
      return {
        title: t('authGateSuccessTitle') as string,
        description: t('authGateSuccessMessage') as string,
        icon: <CheckCircle2 className="h-10 w-10" />,
        iconClasses: 'bg-emerald-50 text-emerald-600',
      };
    }

    return {
      title: t('authGateErrorTitle') as string,
      description: t('authGateErrorMessage') as string,
      icon: <ShieldAlert className="h-10 w-10" />,
      iconClasses: 'bg-rose-50 text-rose-600',
    };
  }, [status, t]);

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center space-y-5">
        {status === 'refreshing' ? (
          <>
            <Loader text={statusContent.title} />
            <p className="text-sm text-slate-500">{statusContent.description}</p>
          </>
        ) : (
          <>
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${statusContent.iconClasses}`}>
              {statusContent.icon}
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-slate-900">{statusContent.title}</h1>
              <p className="text-sm text-slate-500">{statusContent.description}</p>
            </div>
            <p className="text-xs text-slate-400">
              {t('redirectingInSeconds', { count: countdown }) as string}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

