"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { useSiteStore } from '@/store/SiteStore';
import type { ISite } from '@/entities/Site';
import type { IMember } from '@/entities/Member';
import { apiFetch } from '@/utils/apiFetch';

function formatDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
  if (typeof ts === 'object' && ts._seconds)
    return new Date(ts._seconds * 1000).toLocaleDateString();
  return '';
}

export default function SiteMembersPage() {
  const site = useSiteStore((state) => state.siteInfo) as ISite | null;
  const [members, setMembers] = useState<IMember[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof IMember>('displayName');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!site?.id) return;
    apiFetch(`/api/site/${site.id}/members`)
      .then(res => res.json())
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Users size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">Site Members</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-sage-200 rounded-lg">
                <thead>
                  <tr>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('displayName')}>Name</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('email')}>Email</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('role')}>Role</th>
                    <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('createdAt')}>Created At</th>
                  </tr>
                  <tr>
                    <th className="px-4 py-1">
                      <input
                        type="text"
                        placeholder="Filter name..."
                        value={nameFilter}
                        onChange={e => setNameFilter(e.target.value)}
                        className="w-full border border-sage-200 rounded px-2 py-1 text-sm"
                      />
                    </th>
                    <th className="px-4 py-1">
                      <input
                        type="text"
                        placeholder="Filter email..."
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
                        <option value="">All</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(member => (
                    <tr key={member.id} className="border-t border-sage-100 hover:bg-sage-50">
                      <td className="px-4 py-2">{member.displayName}</td>
                      <td className="px-4 py-2">{member.email}</td>
                      <td className="px-4 py-2 capitalize">{member.role}</td>
                      <td className="px-4 py-2">{formatDate(member.createdAt)}</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-400 py-8">No members found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 