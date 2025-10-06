"use client";

import React, { useEffect, useMemo, useState } from 'react';
import type { IMember } from '@/entities/Member';
import { computeMemberAvatar } from '@/store/MemberStore';

const PALETTE = [
  '#2563EB',
  '#7C3AED',
  '#F97316',
  '#DC2626',
  '#16A34A',
  '#0EA5E9',
  '#9333EA',
  '#F59E0B',
  '#14B8A6',
  '#6366F1',
];

const pickColor = (key: string): string => {
  if (!key) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
};

interface MemberAvatarProps {
  member?: IMember | null;
  size?: number;
  fallbackName?: string;
  fallbackEmail?: string;
  className?: string;
}

export default function MemberAvatar({
  member,
  size = 40,
  fallbackName = '',
  fallbackEmail = '',
  className = '',
}: MemberAvatarProps) {
  const [gravatarFailed, setGravatarFailed] = useState(false);

  const avatar = useMemo(
    () =>
      computeMemberAvatar(member, {
        size,
        includeUploaded: true,
        fallbackName,
        fallbackEmail,
      }),
    [member, size, fallbackName, fallbackEmail]
  );

  useEffect(() => {
    setGravatarFailed(false);
  }, [member?.id, member?.email, size]);

  const dimension = { width: size, height: size };
  const baseClasses = `rounded-full overflow-hidden flex items-center justify-center font-semibold transition-colors duration-200`; // tailwind not enforced but class names for existing styles

  if (avatar.type === 'uploaded') {
    return (
      <div className={`${baseClasses} ${className}`} style={dimension}>
        <img src={avatar.url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (avatar.type === 'gravatar' && !gravatarFailed) {
    try {
      const url = new URL(avatar.url);
      url.searchParams.set('d', '404');
      url.searchParams.set('s', String(size));
      return (
        <div className={`${baseClasses} ${className}`} style={dimension}>
          <img
            src={url.toString()}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setGravatarFailed(true)}
          />
        </div>
      );
    } catch {
      // fall through
    }
  }

  const initialsSource = member?.displayName || member?.firstName || fallbackName || member?.email || fallbackEmail || '';
  const initials = initialsSource
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
  const color = pickColor(initialsSource);
  const fallbackStyle: React.CSSProperties = {
    ...dimension,
    background: `linear-gradient(135deg, ${color}33, ${color})`,
    color: '#fff',
  };

  return (
    <div className={`${baseClasses} ${className}`} style={fallbackStyle}>
      <span className="font-semibold" style={{ fontSize: size * 0.4 }}>{initials || '?'}</span>
    </div>
  );
}
