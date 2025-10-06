'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useEditUserModalStore } from '@/store/EditUserModalStore';
import { useMemberStore, computeMemberAvatar } from '@/store/MemberStore';
import type { IMember } from '@/entities/Member';
import { useSiteStore } from '@/store/SiteStore';
import { initFirebase, ensureFirebaseSignedIn, auth } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function EditUserDetails() {
  const { user, setUser } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const setMember = useMemberStore((state) => state.setMember);
  const { isOpen, close } = useEditUserModalStore();
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarInitials, setAvatarInitials] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const { t, i18n } = useTranslation();

  const MAX_AVATAR_SIZE = 4 * 1024 * 1024; // 4MB
  const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

  const fallbackName = user?.name || '';
  const fallbackEmail = user?.email || '';

  const updateAvatarPreview = (sourceMember: IMember | null, options?: { includeUploaded?: boolean }) => {
    if (selectedFile) return; // keep preview of selected file until cleared
    const avatar = computeMemberAvatar(sourceMember, {
      fallbackEmail,
      fallbackName,
      size: 128,
      includeUploaded: options?.includeUploaded ?? true,
    });
    if (avatar.type === 'initials') {
      setAvatarPreview(null);
      setAvatarInitials(avatar.initials);
    } else {
      setAvatarPreview(avatar.url);
      setAvatarInitials('');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
      setSelectedFile(null);
      setRemoveExisting(false);
      setAvatarError('');
      return;
    }
    const currentSiteId = member?.siteId || siteInfo?.id;
    if (!currentSiteId) {
      setName(fallbackName);
      setEmail(fallbackEmail);
      updateAvatarPreview(member);
      return;
    }

    setProfileLoading(true);
    setError('');
    void apiFetch<{ member: IMember }>(`/api/user/profile?siteId=${currentSiteId}`)
      .then(({ member: payload }) => {
        const displayName = payload.displayName || payload.firstName || fallbackName;
        setName(displayName || '');
        setEmail(payload.email || fallbackEmail || '');
        setMember(payload);
        setSelectedFile(null);
        setRemoveExisting(false);
        setAvatarError('');
        updateAvatarPreview(payload);
      })
      .catch((err) => {
        console.error('[edit-user] failed to load member profile', err);
        setName(member?.displayName || member?.firstName || fallbackName);
        setEmail(member?.email || fallbackEmail);
        setError(t('failedToLoadMemberProfile', { defaultValue: 'Failed to load profile details' }));
        updateAvatarPreview(member);
      })
      .finally(() => {
        setProfileLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedFile) return;
    updateAvatarPreview(member, { includeUploaded: !removeExisting });
  }, [member?.avatarUrl, member?.email, member?.displayName, removeExisting, isOpen, selectedFile]);

  useEffect(() => () => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
  }, [avatarPreview]);

const parseApiError = async (response: Response) => {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return json.error || text;
  } catch {
    return text || 'unknown_error';
  }
};

async function resizeToWebp(file: File, maxWidth = 800, quality = 0.9): Promise<Blob> {
  const img = document.createElement('img');
  img.decoding = 'async';
  img.src = URL.createObjectURL(file);
  await img.decode();
  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(img.src);
    throw new Error('canvas_unsupported');
  }
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob_failed'))), 'image/webp', quality)
  );
  URL.revokeObjectURL(img.src);
  return blob;
}

const deleteAvatar = async (siteId: string): Promise<IMember> => {
  const res = await fetch(`/api/user/profile/avatar?siteId=${siteId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const code = await parseApiError(res);
    throw new Error(code || 'delete_failed');
  }
  const data = await res.json();
  return data.member as IMember;
};

const uploadAvatar = async (siteId: string): Promise<IMember> => {
  if (!selectedFile) {
    throw new Error('no_file');
  }
  initFirebase();
  await ensureFirebaseSignedIn();
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('firebase_auth');
  }

  const storage = getStorage();
  const blob = await resizeToWebp(selectedFile, 800, 0.9);
  const safeName = selectedFile.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const fileName = `${Date.now()}_${safeName}.webp`;
  const storagePath = `members/${siteId}/${currentUser.uid}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=31536000,immutable',
  });
  const downloadUrl = await getDownloadURL(storageRef);

  const res = await fetch(`/api/user/profile/avatar?siteId=${siteId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl: downloadUrl, avatarStoragePath: storagePath }),
  });
  if (!res.ok) {
    const code = await parseApiError(res);
    throw new Error(code || 'upload_failed');
  }
  const data = await res.json();
  return data.member as IMember;
};

const mapAvatarError = (code: string) => {
  switch (code) {
    case 'invalid_type':
      return t('invalidAvatarType', { defaultValue: 'Please choose a PNG, JPG, or WEBP image.' });
    case 'too_large':
      return t('avatarTooLarge', { defaultValue: 'Image is too large.' });
    case 'canvas_unsupported':
    case 'toBlob_failed':
    case 'firebase_auth':
    case 'invalid_payload':
    case 'missing_avatar':
    case 'storage_bucket_missing':
    case 'upload_failed':
    case 'no_file':
      return t('failedToUploadAvatar', { defaultValue: 'Failed to upload photo.' });
      case 'delete_failed':
        return t('failedToRemoveAvatar', { defaultValue: 'Failed to remove photo.' });
      default:
        return t('failedToUploadAvatar', { defaultValue: 'Failed to upload photo.' });
    }
  };

  const handleAvatarChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setAvatarError(t('invalidAvatarType', { defaultValue: 'Please choose a PNG, JPG, or WEBP image.' }));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError(t('avatarTooLarge', { defaultValue: 'Image is too large.' }));
      event.target.value = '';
      return;
    }
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setAvatarInitials('');
    setSelectedFile(file);
    setRemoveExisting(false);
    setAvatarError('');
  };

  const handleAvatarToggle = () => {
    setAvatarError('');
    if (selectedFile) {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
      setSelectedFile(null);
      updateAvatarPreview(member, { includeUploaded: !removeExisting });
      return;
    }
    if (!member?.avatarUrl) return;
    const nextRemove = !removeExisting;
    setRemoveExisting(nextRemove);
    if (nextRemove) {
      const avatar = computeMemberAvatar(member, {
        fallbackEmail,
        fallbackName,
        size: 128,
        includeUploaded: false,
      });
      if (avatar.type === 'initials') {
        setAvatarPreview(null);
        setAvatarInitials(avatar.initials);
      } else {
        setAvatarPreview(avatar.url);
        setAvatarInitials('');
      }
    } else {
      updateAvatarPreview(member, { includeUploaded: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError(t('pleaseFillAllFields'));
      return;
    }
    const currentSiteId = member?.siteId || siteInfo?.id;
    if (!currentSiteId) {
      setError(t('failedToSubmit'));
      return;
    }

    setIsLoading(true);
    setError('');
    setAvatarError('');
    try {
      let latestMember: IMember | null = member;
      if (removeExisting && member?.avatarUrl) {
        latestMember = await deleteAvatar(currentSiteId);
        setRemoveExisting(false);
      }
      if (selectedFile) {
        latestMember = await uploadAvatar(currentSiteId);
        if (avatarPreview && avatarPreview.startsWith('blob:')) {
          URL.revokeObjectURL(avatarPreview);
        }
        setSelectedFile(null);
      }
      if (latestMember) {
        setMember(latestMember);
      }
      const payload = await apiFetch<{ member: IMember }>(`/api/user/profile?siteId=${currentSiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (user) {
        setUser({ ...user, name: name.trim() });
      }
      setMember(payload.member);
      close();
    } catch (err) {
      console.error('[edit-user] save failed', err);
      if (err instanceof Error) {
        const msg = err.message;
        if (
          [
            'invalid_type',
            'too_large',
            'upload_failed',
            'delete_failed',
            'no_file',
            'firebase_auth',
            'invalid_payload',
            'missing_avatar',
            'storage_bucket_missing',
            'canvas_unsupported',
            'toBlob_failed',
          ].includes(msg)
        ) {
          setAvatarError(mapAvatarError(msg));
        } else {
          setError(t('failedToSubmit'));
        }
      } else {
        setError(t('failedToSubmit'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md" dir={i18n.dir()} lang={i18n.language}>
      <h2 className="text-xl font-semibold mb-4">{t('editProfile')}</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}
      <div className="space-y-2 mb-6">
        <span className="block text-sm font-medium text-sage-700">{t('avatar')}</span>
        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-sage-200 flex items-center justify-center text-lg font-semibold text-sage-700">
              {avatarInitials || '?'}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center px-3 py-1.5 rounded bg-sage-600 text-white text-sm cursor-pointer hover:bg-sage-500">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={isLoading || profileLoading}
              />
              {t('uploadPhoto')}
            </label>
            {(selectedFile || member?.avatarUrl) && (
              <button
                type="button"
                onClick={handleAvatarToggle}
                className="self-start text-sm text-sage-700 hover:underline disabled:text-gray-400"
                disabled={isLoading || profileLoading}
              >
                {selectedFile
                  ? t('cancelNewPhoto', { defaultValue: 'Cancel new photo' })
                  : removeExisting
                    ? t('undoRemovePhoto', { defaultValue: 'Undo remove' })
                    : t('removePhoto', { defaultValue: 'Remove photo' })}
              </button>
            )}
            <span className="text-xs text-gray-500">{t('avatarRequirements', { defaultValue: 'PNG, JPG, or WEBP up to 4 MB.' })}</span>
            {avatarError ? (
              <span className="text-xs text-red-600">{avatarError}</span>
            ) : null}
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="name">{t('name')}</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            disabled={isLoading || profileLoading}
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="w-full border border-gray-200 bg-gray-100 text-gray-600 rounded px-3 py-2"
            disabled
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 rounded bg-gray-200"
            disabled={isLoading}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-sage-600 text-white disabled:opacity-50"
            disabled={isLoading || profileLoading}
          >
            {isLoading ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
