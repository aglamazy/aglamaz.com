"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Link2, Users } from 'lucide-react';
import { useSiteStore } from '@/store/SiteStore';
import type { ISite } from '@/entities/Site';
import type { IMember } from '@/entities/Member';
import { apiFetch } from '@/utils/apiFetch';
import MemberAvatar from '@/components/MemberAvatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

function formatDateTime(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function InviteLinkGenerator() {
  const { t } = useTranslation();
  const site = useSiteStore((state) => state.siteInfo) as ISite | null;
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generateInvite = async () => {
    if (!site?.id) return;
    setIsGenerating(true);
    setError('');
    setCopied(false);
    try {
      const response = await apiFetch<{ invite: { expiresAt: string }; url: string }>(`/api/site/${site.id}/invites`, {
        method: 'POST',
      });
      setInviteUrl(response.url);
      setExpiresAt(response.invite.expiresAt);
    } catch (err) {
      console.error(err);
      setError(t('inviteLinkCreateError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setError('');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error(err);
      setError(t('inviteLinkCopyError'));
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-full bg-sage-100 text-sage-600">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sage-700">{t('inviteMembers')}</h2>
            <p className="text-sm text-sage-600">{t('inviteLinkDescription')}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={generateInvite} disabled={isGenerating || !site?.id}>
            {isGenerating ? t('generatingInviteLink') : t('generateInviteLink')}
          </Button>
          {inviteUrl && (
            <Button
              onClick={copyInvite}
              className="bg-white text-sage-700 border border-sage-300 hover:bg-sage-50"
              type="button"
            >
              <Copy className="w-4 h-4" />
              {t('copyLink')}
            </Button>
          )}
        </div>
        {inviteUrl && (
          <div className="mt-4 space-y-2">
            <div className="bg-sage-50 border border-sage-200 rounded-lg p-3 text-sm break-all">
              {inviteUrl}
            </div>
            {expiresAt && (
              <p className="text-sm text-sage-600">{t('linkExpiresAt', { time: formatDateTime(expiresAt) })}</p>
            )}
            {copied && <p className="text-sm text-emerald-600">{t('inviteLinkCopied')}</p>}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function formatDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
  if (typeof ts === 'object' && ts._seconds)
    return new Date(ts._seconds * 1000).toLocaleDateString();
  return '';
}

export default function SiteMembersPage() {
  const { t } = useTranslation();
  const site = useSiteStore((state) => state.siteInfo) as ISite | null;
  const [members, setMembers] = useState<IMember[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof IMember>('displayName');
  const [sortAsc, setSortAsc] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!site?.id) return;
    apiFetch<{ members: IMember[] }>(`/api/site/${site.id}/members`)
      .then(data => setMembers(data.members || []));
  }, [site?.id]);

  const filtered = members.filter(m =>
    (m.displayName?.toLowerCase() || '').includes(nameFilter.toLowerCase()) &&
    (m.email?.toLowerCase() || '').includes(emailFilter.toLowerCase()) &&
    (roleFilter ? m.role === roleFilter : true)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return sortAsc ? -1 : 1;
    if (a[sortKey] > b[sortKey]) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof IMember) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const updateMember = async (member: IMember, changes: Partial<IMember>) => {
    if (!site?.id) return;
    setSavingId(member.id);
    setError('');
    try {
      await apiFetch(`/api/site/${site.id}/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });
      setMembers((prev) => prev.map(m => m.id === member.id ? { ...m, ...changes } : m));
      return true;
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update member');
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const openConfirmDelete = (member: IMember) => {
    setDeleteError('');
    setDeleteTarget(member);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!site?.id || !deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/site/${site.id}/members/${deleteTarget.id}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter(m => m.id !== deleteTarget.id));
      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      console.error(e);
      setDeleteError(e?.message || 'Failed to delete member');
      // Rethrow is not necessary for UI but keeping local error visible
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Users size={32} className="text-sage-600" />
            <h1 className="text-3xl font-bold text-sage-700">{t('siteMembers')}</h1>
          </div>
          <InviteLinkGenerator />
          <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-sage-200 rounded-lg">
                <thead>
                  <tr>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('displayName')}>{t('name')}</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('email')}>{t('email')}</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('role')}>{t('role') as string}</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('createdAt')}>{t('createdAt') as string}</th>
                    <th className="px-4 py-2">{t('blog') as string}</th>
                  </tr>
                  <tr>
                    <th className="px-4 py-1">
                      <input
                        type="text"
                        placeholder={t('filterName') as string}
                        value={nameFilter}
                        onChange={e => setNameFilter(e.target.value)}
                        className="w-full border border-sage-200 rounded px-2 py-1 text-sm"
                      />
                    </th>
                    <th className="px-4 py-1">
                      <input
                        type="text"
                        placeholder={t('filterEmail') as string}
                        value={emailFilter}
                        onChange={e => setEmailFilter(e.target.value)}
                        className="w-full border border-sage-200 rounded px-2 py-1 text-sm"
                      />
                    </th>
                    <th className="px-4 py-1">
                      <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="w-full border border-sage-200 rounded px-2 py-1 text-sm"
                      >
                        <option value="">{t('all') as string}</option>
                        <option value="admin">{t('admin') as string}</option>
                        <option value="member">{t('member') as string}</option>
                      </select>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(member => (
                    <tr key={member.id} className="border-t border-sage-100 hover:bg-sage-50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <MemberAvatar member={member} size={40} fallbackName={member.displayName || member.firstName} fallbackEmail={member.email} />
                          <div className="flex-1">
                          <input
                            className="border rounded px-2 py-1 text-sm w-full"
                            value={member.displayName || ''}
                            onChange={(e) => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, displayName: e.target.value } : m))}
                            onBlur={(e) => updateMember(member, { displayName: e.target.value })}
                            disabled={savingId === member.id}
                          />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">{member.email}</td>
                      <td className="px-4 py-2 capitalize">
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={member.role}
                          onChange={(e) => updateMember(member, { role: e.target.value as any })}
                          disabled={savingId === member.id}
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">{formatDate(member.createdAt)}</td>
                      <td className="px-4 py-2">
                        {(member as any).blogEnabled && (member as any).blogHandle ? (
                          <a
                            className="text-blue-600 hover:underline"
                            href={`/blog/author/${(member as any).blogHandle}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('viewBlog') as string}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          className="bg-red-500 hover:bg-red-600"
                          disabled={savingId === member.id}
                          onClick={() => openConfirmDelete(member)}
                        >
                          {t('delete') as string}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-400 py-8">{t('noMembersFound') as string}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {error && <div className="text-red-600 mt-2">{error}</div>}
            </div>
            <ConfirmDialog
              isOpen={confirmOpen}
              title={t('deleteMemberQuestion') as string}
              message={deleteTarget ? `${deleteTarget.displayName || ''} (${deleteTarget.email || ''})` : ''}
              confirmLabel={t('delete') as string}
              cancelLabel={t('cancel') as string}
              destructive
              loading={deleting}
              error={deleteError}
              onConfirm={handleConfirmDelete}
              onCancel={() => {
                if (deleting) return;
                setConfirmOpen(false);
                setDeleteTarget(null);
                setDeleteError('');
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
