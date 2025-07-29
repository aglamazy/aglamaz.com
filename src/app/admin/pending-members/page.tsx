'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/store/UserStore';
import { useSiteStore } from '@/store/SiteStore';
import type { IUser } from '@/entities/User';
import type { ISite } from '@/entities/Site';

interface PendingMember {
  id: string;
  firstName: string;
  email: string;
  status: 'pending_verification' | 'pending';
  requestedAt: string;
  verifiedAt?: string;
}

export default function PendingMembersPage() {
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = useUserStore((state) => state.user) as IUser | null;
  const site = useSiteStore((state) => state.siteInfo) as ISite | null;

  useEffect(() => {
    fetchPendingMembers();
  }, []);

  const fetchPendingMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/${user?.user_id}/pending-members/${site?.id}`, {
        headers: {
          'Authorization': `Bearer ${document.cookie.match(/token=([^;]*)/)?.[1] || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending members');
      }

      const data = await response.json();
      setPendingMembers(data.data || []);
    } catch (error) {
      setError('Failed to load pending members');
    } finally {
      setLoading(false);
    }
  };

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

      const body = action === 'approve'
        ? { signupRequestId: memberId }
        : { memberId, siteId: 'default-site' };

      const response = await fetch(`/api/user/${user?.user_id}/${action}-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.match(/token=([^;]*)/)?.[1] || ''}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: action === 'approve' ? 'Member approved successfully' : 'Member rejected successfully'
        });
        // Remove the member from the list
        setPendingMembers(prev => prev.filter(member => member.id !== memberId));
      } else {
        setMessage({
          type: 'error',
          text: data.error || `Failed to ${action} member`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to ${action} member`
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          <span className="text-sage-600">Loading pending members...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Users size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">Pending Members</h1>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <div className="flex items-center gap-2">
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
                <p>No pending members</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingMembers.map((member) => (
              <Card key={member.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{member.firstName}</h3>
                      <p className="text-gray-600">{member.email}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Requested: {new Date(member.requestedAt).toLocaleDateString()}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.status === 'pending_verification' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {member.status === 'pending_verification' ? 'Awaiting Email Verification' : 'Pending Approval'}
                        </span>
                        {member.verifiedAt && (
                          <span className="text-green-600">
                            ✓ Verified: {new Date(member.verifiedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
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