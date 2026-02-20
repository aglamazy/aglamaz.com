'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, XCircle, Loader2, AlertCircle, Clock, Mail, ShieldCheck } from 'lucide-react';
import { useUserStore } from '@/store/UserStore';
import { useSiteStore } from '@/store/SiteStore';
import type { IUser } from '@/entities/User';
import type { ISite } from '@/entities/Site';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { formatLocalizedDate } from '@/utils/dateFormat';

interface FirestoreTimestamp {
  seconds?: number;
  _seconds?: number;
}

interface PendingMember {
  id: string;
  firstName: string;
  email: string;
  status: 'pending_verification' | 'pending';
  createdAt?: FirestoreTimestamp | string;
  verifiedAt?: FirestoreTimestamp | string;
}

export default function PendingMembersPage() {
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = useUserStore((state) => state.user) as IUser | null;
  const site = useSiteStore((state) => state.siteInfo) as ISite | null;
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();

  useEffect(() => {
    const load = async (_uid: string, sid: string) => {
      try {
        setLoading(true);
        setError('');
        const data = await apiFetch<{ data: PendingMember[] }>(ApiRoute.SITE_PENDING_MEMBERS, {
          pathParams: { siteId: sid },
        });
        setPendingMembers(data?.data || []);
      } catch (error) {
        setError(t('failedToLoadPendingMembers'));
      } finally {
        setLoading(false);
      }
    };
    if (user?.user_id && site?.id) {
      load(user.user_id, site.id);
    }
  }, [user?.user_id, site?.id, t]);

  const handleAction = async (memberId: string, action: 'approve' | 'reject') => {
    try {
      setActionLoading(memberId);
      setMessage(null);
      const route = action === 'approve' ? ApiRoute.SITE_PENDING_MEMBERS_APPROVE : ApiRoute.SITE_PENDING_MEMBERS_REJECT;
      await apiFetch<void>(route, {
        pathParams: { siteId: site?.id || '' },
        method: 'POST',
        body: { signupRequestId: memberId },
      });

      setMessage({
        type: 'success',
        text: action === 'approve' ? t('memberApproved') : t('memberRejected'),
      });
      setPendingMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      setMessage({
        type: 'error',
        text: t(action === 'approve' ? 'failedToApproveMember' : 'failedToRejectMember'),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp?: FirestoreTimestamp | string) => {
    if (!timestamp) return '';
    let date: Date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      const seconds = timestamp.seconds ?? timestamp._seconds;
      if (!seconds) return '';
      date = new Date(seconds * 1000);
    }
    return formatLocalizedDate(date, i18n.language);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          <span className="text-sage-600">{t('loadingPendingMembers')}</span>
        </div>
      </div>
    );
  }

  const isReady = (m: PendingMember) => m.status === 'pending';

  return (
    <div className="container mx-auto px-4 py-8" dir={dir}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Users size={28} className="text-sage-600" />
          <h1 className="text-2xl font-bold text-sage-700">{t('pendingMembers')}</h1>
          {pendingMembers.length > 0 && (
            <span className="bg-sage-100 text-sage-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {pendingMembers.length}
            </span>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {pendingMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>{t('noPendingMembers')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingMembers.map((member) => (
              <Card key={member.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-5">
                    {/* Name & email */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{member.firstName}</h3>
                        <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-0.5">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        isReady(member)
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                      }`}>
                        {isReady(member) ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {isReady(member) ? t('pendingApprovalStatus') : t('awaitingEmailVerification')}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      {member.createdAt && (
                        <span>{t('requested')}: {formatDate(member.createdAt)}</span>
                      )}
                      {member.verifiedAt && (
                        <span className="text-green-600">{t('verified')}: {formatDate(member.verifiedAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex border-t border-gray-100">
                    <button
                      onClick={() => handleAction(member.id, 'approve')}
                      disabled={actionLoading === member.id || !isReady(member)}
                      title={!isReady(member) ? t('awaitingEmailVerification') : undefined}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {actionLoading === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {t('approve')}
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      onClick={() => handleAction(member.id, 'reject')}
                      disabled={actionLoading === member.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {actionLoading === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {t('reject')}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
