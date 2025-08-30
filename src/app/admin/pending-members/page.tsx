'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/store/UserStore';
import { useSiteStore } from '@/store/SiteStore';
import type { IUser } from '@/entities/User';
import type { ISite } from '@/entities/Site';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';

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

  useEffect(() => {
    const load = async (uid: string, sid: string) => {
      try {
        setLoading(true);
        setError('');
        const data = await apiFetch<{data: PendingMember[]}>(`/api/user/${uid}/pending-members/${sid}`);
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

  const handleApprove = async (memberId: string) => {
    await handleAction(memberId, 'approve');
  };

  const handleReject = async (memberId: string) => {
    await handleAction(memberId, 'reject');
  };

  const handleAction = async (memberId: string, action: 'approve' | 'reject') => {
    try {
      setActionLoading(memberId);
      setMessage(null);
      await apiFetch<void>(`/api/user/${user?.user_id}/${action}-member?siteId=${site?.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signupRequestId: memberId }),
      });

      setMessage({
        type: 'success',
        text: action === 'approve' ? t('memberApproved') : t('memberRejected'),
      });
      // Remove the member from the list
      setPendingMembers(prev => prev.filter(member => member.id !== memberId));
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
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (seconds) {
      return new Date(seconds * 1000).toLocaleDateString();
    }
    return '';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className={`flex items-center justify-center gap-3 ${i18n.dir() === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          <span className="text-sage-600">{t('loadingPendingMembers')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className={`flex items-center gap-3 mb-8 ${i18n.dir() === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Users size={32} className="text-sage-600" />
            <h1 className="text-3xl font-bold text-sage-700">{t('pendingMembers')}</h1>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            } ${i18n.dir() === 'rtl' ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center gap-2 ${i18n.dir() === 'rtl' ? 'flex-row-reverse' : ''}`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span>{message.text}</span>
              </div>
            </div>
          )}

          {error && (
            <div className={`mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 ${i18n.dir() === 'rtl' ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center gap-2 ${i18n.dir() === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {pendingMembers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('noPendingMembers')}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingMembers.map((member) => (
                <Card key={member.id}>
                  <CardContent className="pt-6">
                    <div className={`flex items-center justify-between ${i18n.dir() === 'rtl' ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex-1 ${i18n.dir() === 'rtl' ? 'text-right' : 'text-left'}`}>
                        <h3 className="font-semibold text-gray-900">{member.firstName}</h3>
                        <p className="text-gray-600">{member.email}</p>
                        <div className={`flex items-center gap-4 text-sm text-gray-500 ${i18n.dir() === 'rtl' ? 'flex-row-reverse justify-end' : ''}`}>
                          <span>{t('requested')}: {formatDate(member.createdAt)}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.status === 'pending_verification'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {member.status === 'pending_verification' ? t('awaitingEmailVerification') : t('pendingApprovalStatus')}
                          </span>
                          {member.verifiedAt && (
                            <span className="text-green-600">
                              ✓ {t('verified')}: {formatDate(member.verifiedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex gap-2 ${i18n.dir() === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Button
                          onClick={() => handleApprove(member.id)}
                          disabled={actionLoading === member.id}
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          {actionLoading === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => handleReject(member.id)}
                          disabled={actionLoading === member.id}
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          {actionLoading === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
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
