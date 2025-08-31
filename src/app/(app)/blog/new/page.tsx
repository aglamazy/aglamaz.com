"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import EditorRich from '@/components/EditorRich';
import { useUserStore } from '@/store/UserStore';

export default function NewPostPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id) return;
    setSaving(true);
    try {
      await apiFetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: user.user_id, title, content, isPublic, lang: i18n.language })
      });
      router.push('/blog');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('newPost')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border p-2"
            placeholder={t('title') as string}
          />
          <EditorRich value={content} onChange={setContent} />
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
            />
            <span>{t('public')}</span>
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
